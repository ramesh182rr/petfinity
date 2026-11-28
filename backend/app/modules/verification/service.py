"""Applicant side of verification: private documents and submission for review.

Admin review (approve / needs info / reject) is milestone 2.2.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.core.config import Settings
from app.core.errors import AppError
from app.modules.audit import service as audit
from app.modules.clinics import service as clinics
from app.modules.clinics.models import Clinic
from app.modules.media import service as media
from app.modules.media.models import MediaAsset, MediaPurpose
from app.modules.providers import service as providers
from app.modules.providers.models import ProviderProfile, ProviderType
from app.modules.storage.base import ObjectStorage
from app.modules.verification.models import (
    DocumentType,
    SubjectType,
    SubmissionStatus,
    VerificationDocument,
    VerificationSubmission,
)
from app.modules.verification.status import EDITABLE_DOCUMENT_STATES, VerificationStatus

MAX_DOCUMENTS = 20

Subject = ProviderProfile | Clinic


@dataclass(frozen=True)
class Requirements:
    documents: list[DocumentType]
    fields: list[str]


def requirements(subject: Subject) -> Requirements:
    if isinstance(subject, Clinic):
        return Requirements([DocumentType.CLINIC_REGISTRATION], [])
    if subject.provider_type == ProviderType.VETERINARIAN:
        return Requirements(
            [DocumentType.IDENTITY, DocumentType.VET_REGISTRATION],
            ["registration_number", "registration_council"],
        )
    # Caretakers enter homes or host pets (decision 0015): identity and address proof.
    return Requirements([DocumentType.IDENTITY, DocumentType.ADDRESS_PROOF], [])


def resolve_subject(
    db: Session,
    user_id: uuid.UUID,
    subject_type: SubjectType,
    subject_id: uuid.UUID,
    *,
    for_update: bool = False,
) -> Subject:
    """Applicants act only on their own profile, or a clinic they operate."""
    if subject_type is SubjectType.PROVIDER_PROFILE:
        return providers.get_owned(db, user_id, subject_id, for_update=for_update)
    return clinics.require_operator(db, user_id, subject_id, for_update=for_update)


def _key_prefix(subject_type: SubjectType, subject_id: uuid.UUID) -> str:
    return f"verification/{subject_type.value}/{subject_id}"


def _require_editable(subject: Subject) -> None:
    if subject.verification_status not in EDITABLE_DOCUMENT_STATES:
        raise AppError(
            "verification_locked",
            "Documents can't be changed while under review or after verification.",
            status_code=409,
        )


def _documents(
    db: Session, subject_type: SubjectType, subject_id: uuid.UUID
) -> list[tuple[VerificationDocument, MediaAsset]]:
    stmt = (
        select(VerificationDocument, MediaAsset)
        .join(MediaAsset, MediaAsset.id == VerificationDocument.media_asset_id)
        .where(
            VerificationDocument.subject_type == subject_type.value,
            VerificationDocument.subject_id == subject_id,
            VerificationDocument.deleted_at.is_(None),
        )
        .order_by(VerificationDocument.created_at)
    )
    return [(row[0], row[1]) for row in db.execute(stmt).all()]


def create_document_upload(
    db: Session,
    settings: Settings,
    storage: ObjectStorage,
    *,
    user_id: uuid.UUID,
    subject_type: SubjectType,
    subject_id: uuid.UUID,
    content_type: str,
    size_bytes: int,
) -> media.UploadTicket:
    subject = resolve_subject(db, user_id, subject_type, subject_id)
    _require_editable(subject)
    if len(_documents(db, subject_type, subject_id)) >= MAX_DOCUMENTS:
        raise AppError("document_limit_reached", "Too many documents.", status_code=409)
    return media.create_upload(
        db,
        settings,
        storage,
        owner_id=user_id,
        purpose=MediaPurpose.VERIFICATION_DOCUMENT,
        key_prefix=_key_prefix(subject_type, subject_id),
        content_type=content_type,
        size_bytes=size_bytes,
    )


def confirm_document(
    db: Session,
    settings: Settings,
    storage: ObjectStorage,
    *,
    user_id: uuid.UUID,
    subject_type: SubjectType,
    subject_id: uuid.UUID,
    media_id: uuid.UUID,
    doc_type: DocumentType,
) -> tuple[VerificationDocument, MediaAsset]:
    subject = resolve_subject(db, user_id, subject_type, subject_id, for_update=True)
    _require_editable(subject)
    asset = media.confirm_upload(
        db,
        settings,
        storage,
        owner_id=user_id,
        media_id=media_id,
        purpose=MediaPurpose.VERIFICATION_DOCUMENT,
        key_prefix=_key_prefix(subject_type, subject_id),
    )
    document = VerificationDocument(
        subject_type=subject_type.value,
        subject_id=subject_id,
        doc_type=doc_type.value,
        media_asset_id=asset.id,
        uploaded_by_user_id=user_id,
    )
    db.add(document)
    db.flush()
    audit.record(
        db,
        "verification.document_added",
        actor_user_id=user_id,
        target_type=subject_type.value,
        target_id=subject_id,
        details={"doc_type": doc_type.value, "document_id": str(document.id)},
    )
    return document, asset


def delete_document(
    db: Session,
    storage: ObjectStorage,
    *,
    user_id: uuid.UUID,
    subject_type: SubjectType,
    subject_id: uuid.UUID,
    document_id: uuid.UUID,
) -> None:
    subject = resolve_subject(db, user_id, subject_type, subject_id, for_update=True)
    _require_editable(subject)
    for doc, asset in _documents(db, subject_type, subject_id):
        if doc.id == document_id:
            if doc.submission_id is not None:
                raise AppError(
                    "document_submitted",
                    "Documents already sent for review can't be removed.",
                    status_code=409,
                )
            doc.deleted_at = utcnow()
            media.discard(db, storage, asset)
            audit.record(
                db,
                "verification.document_removed",
                actor_user_id=user_id,
                target_type=subject_type.value,
                target_id=subject_id,
                details={"document_id": str(doc.id)},
            )
            return
    raise AppError("not_found", "Document not found.", status_code=404)


def _latest_submission(
    db: Session, subject_type: SubjectType, subject_id: uuid.UUID
) -> VerificationSubmission | None:
    stmt = (
        select(VerificationSubmission)
        .where(
            VerificationSubmission.subject_type == subject_type.value,
            VerificationSubmission.subject_id == subject_id,
        )
        .order_by(VerificationSubmission.submitted_at.desc())
        .limit(1)
    )
    return db.scalars(stmt).first()


@dataclass(frozen=True)
class Overview:
    subject: Subject
    requirements: Requirements
    missing_documents: list[DocumentType]
    missing_fields: list[str]
    documents: list[tuple[VerificationDocument, MediaAsset]]
    latest_submission: VerificationSubmission | None


def overview(
    db: Session, user_id: uuid.UUID, subject_type: SubjectType, subject_id: uuid.UUID
) -> Overview:
    subject = resolve_subject(db, user_id, subject_type, subject_id)
    reqs = requirements(subject)
    docs = _documents(db, subject_type, subject_id)
    present = {DocumentType(doc.doc_type) for doc, _ in docs}
    missing_docs = [d for d in reqs.documents if d not in present]
    missing_fields = [f for f in reqs.fields if not getattr(subject, f, None)]
    return Overview(
        subject,
        reqs,
        missing_docs,
        missing_fields,
        docs,
        _latest_submission(db, subject_type, subject_id),
    )


def submit(
    db: Session,
    *,
    user_id: uuid.UUID,
    subject_type: SubjectType,
    subject_id: uuid.UUID,
    note: str | None,
) -> VerificationSubmission:
    subject = resolve_subject(db, user_id, subject_type, subject_id, for_update=True)
    if subject.verification_status == VerificationStatus.SUBMITTED:
        raise AppError("already_submitted", "This is already waiting for review.", status_code=409)
    if subject.verification_status == VerificationStatus.VERIFIED:
        raise AppError("already_verified", "This is already verified.", status_code=409)
    state = overview(db, user_id, subject_type, subject_id)
    if state.missing_documents or state.missing_fields:
        raise AppError(
            "verification_incomplete",
            "Please add the missing details and documents before submitting.",
            status_code=422,
            details={
                "missing_documents": [d.value for d in state.missing_documents],
                "missing_fields": state.missing_fields,
            },
        )
    pending = db.scalar(
        select(func.count())
        .select_from(VerificationSubmission)
        .where(
            VerificationSubmission.subject_type == subject_type.value,
            VerificationSubmission.subject_id == subject_id,
            VerificationSubmission.status == SubmissionStatus.PENDING,
        )
    )
    if pending:
        raise AppError("already_submitted", "This is already waiting for review.", status_code=409)

    submission = VerificationSubmission(
        subject_type=subject_type.value,
        subject_id=subject_id,
        submitted_by_user_id=user_id,
        applicant_note=note,
        status=SubmissionStatus.PENDING,
        submitted_at=utcnow(),
    )
    db.add(submission)
    db.flush()
    db.execute(
        update(VerificationDocument)
        .where(
            VerificationDocument.subject_type == subject_type.value,
            VerificationDocument.subject_id == subject_id,
            VerificationDocument.deleted_at.is_(None),
            VerificationDocument.submission_id.is_(None),
        )
        .values(submission_id=submission.id)
    )
    subject.verification_status = VerificationStatus.SUBMITTED
    audit.record(
        db,
        "verification.submitted",
        actor_user_id=user_id,
        target_type=subject_type.value,
        target_id=subject_id,
        details={"submission_id": str(submission.id)},
    )
    return submission
