"""Admin side of verification (milestone 2.2): queue, review, decisions, suspension.

Rules:
- Only admins decide (decision 0006). Nobody reviews their own submission.
- Documents are shown through 5-minute signed URLs; every detail view is audited.
- The verified badge means: identity and the listed registration documents were
  checked by a Petfinity admin on `verified_at`. It is not a guarantee of service.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.core.errors import AppError
from app.modules.audit import service as audit
from app.modules.clinics.models import Clinic
from app.modules.media.models import MediaAsset
from app.modules.providers.models import ProviderProfile
from app.modules.storage.base import ObjectStorage
from app.modules.users.models import User
from app.modules.verification.models import (
    SubjectType,
    SubmissionStatus,
    VerificationDocument,
    VerificationSubmission,
)
from app.modules.verification.status import ActiveStatus, VerificationStatus

DOCUMENT_URL_TTL_SECONDS = 300


class Decision(StrEnum):
    APPROVE = "approve"
    NEEDS_INFO = "needs_info"
    REJECT = "reject"


_OUTCOME = {
    Decision.APPROVE: (SubmissionStatus.APPROVED, VerificationStatus.VERIFIED),
    Decision.NEEDS_INFO: (SubmissionStatus.NEEDS_INFO, VerificationStatus.NEEDS_INFO),
    Decision.REJECT: (SubmissionStatus.REJECTED, VerificationStatus.REJECTED),
}

Subject = ProviderProfile | Clinic


def _load_subject(
    db: Session, subject_type: str, subject_id: uuid.UUID, *, for_update: bool = False
) -> Subject | None:
    if subject_type == SubjectType.PROVIDER_PROFILE:
        profile_stmt = select(ProviderProfile).where(ProviderProfile.id == subject_id)
        if for_update:
            profile_stmt = profile_stmt.with_for_update()
        return db.scalars(profile_stmt).first()
    clinic_stmt = select(Clinic).where(Clinic.id == subject_id)
    if for_update:
        clinic_stmt = clinic_stmt.with_for_update()
    return db.scalars(clinic_stmt).first()


def subject_label(subject: Subject | None) -> str:
    if subject is None:
        return "(deleted)"
    return subject.name if isinstance(subject, Clinic) else subject.display_name


@dataclass(frozen=True)
class QueueItem:
    submission: VerificationSubmission
    subject: Subject | None
    submitter: User | None


def list_submissions(
    db: Session,
    *,
    status: SubmissionStatus | None,
    subject_type: SubjectType | None,
    limit: int,
    before: datetime | None,
) -> list[QueueItem]:
    stmt = select(VerificationSubmission)
    if status is not None:
        stmt = stmt.where(VerificationSubmission.status == status.value)
    if subject_type is not None:
        stmt = stmt.where(VerificationSubmission.subject_type == subject_type.value)
    if status in (None, SubmissionStatus.PENDING):
        # Pending queue: oldest first (first come, first served).
        stmt = stmt.order_by(VerificationSubmission.submitted_at.asc())
        if before is not None:
            stmt = stmt.where(VerificationSubmission.submitted_at > before)
    else:
        stmt = stmt.order_by(VerificationSubmission.submitted_at.desc())
        if before is not None:
            stmt = stmt.where(VerificationSubmission.submitted_at < before)
    items: list[QueueItem] = []
    for submission in db.scalars(stmt.limit(limit)):
        items.append(
            QueueItem(
                submission,
                _load_subject(db, submission.subject_type, submission.subject_id),
                db.get(User, submission.submitted_by_user_id),
            )
        )
    return items


@dataclass(frozen=True)
class ReviewDocument:
    document: VerificationDocument
    asset: MediaAsset
    url: str


@dataclass(frozen=True)
class SubmissionDetail:
    submission: VerificationSubmission
    subject: Subject | None
    submitter: User | None
    reviewer: User | None
    documents: list[ReviewDocument]
    history: list[VerificationSubmission]


def get_submission(
    db: Session, storage: ObjectStorage, *, admin: User, submission_id: uuid.UUID
) -> SubmissionDetail:
    submission = db.get(VerificationSubmission, submission_id)
    if submission is None:
        raise AppError("not_found", "Submission not found.", status_code=404)
    subject = _load_subject(db, submission.subject_type, submission.subject_id)

    stmt = (
        select(VerificationDocument, MediaAsset)
        .join(MediaAsset, MediaAsset.id == VerificationDocument.media_asset_id)
        .where(VerificationDocument.submission_id == submission.id)
        .order_by(VerificationDocument.created_at)
    )
    documents = [
        ReviewDocument(
            row[0],
            row[1],
            storage.presign_download(row[1].storage_key, expires_in=DOCUMENT_URL_TTL_SECONDS),
        )
        for row in db.execute(stmt).all()
    ]
    history = list(
        db.scalars(
            select(VerificationSubmission)
            .where(
                VerificationSubmission.subject_type == submission.subject_type,
                VerificationSubmission.subject_id == submission.subject_id,
                VerificationSubmission.id != submission.id,
            )
            .order_by(VerificationSubmission.submitted_at.desc())
        )
    )
    audit.record(
        db,
        "verification.submission_viewed",
        actor_user_id=admin.id,
        target_type=submission.subject_type,
        target_id=submission.subject_id,
        details={"submission_id": str(submission.id), "documents": len(documents)},
    )
    return SubmissionDetail(
        submission,
        subject,
        db.get(User, submission.submitted_by_user_id),
        db.get(User, submission.reviewed_by_user_id) if submission.reviewed_by_user_id else None,
        documents,
        history,
    )


def decide(
    db: Session,
    *,
    admin: User,
    submission_id: uuid.UUID,
    decision: Decision,
    reason: str | None,
) -> VerificationSubmission:
    submission = db.scalars(
        select(VerificationSubmission)
        .where(VerificationSubmission.id == submission_id)
        .with_for_update()
    ).first()
    if submission is None:
        raise AppError("not_found", "Submission not found.", status_code=404)
    if submission.submitted_by_user_id == admin.id:
        raise AppError("self_review", "You can't review your own submission.", status_code=403)
    if submission.status != SubmissionStatus.PENDING:
        raise AppError(
            "already_decided", "This submission has already been decided.", status_code=409
        )
    if decision is not Decision.APPROVE and not reason:
        raise AppError(
            "reason_required",
            "Please explain what's missing or why it was rejected; the applicant sees this.",
            status_code=422,
        )
    subject = _load_subject(db, submission.subject_type, submission.subject_id, for_update=True)
    if subject is None:
        raise AppError("not_found", "The profile or clinic no longer exists.", status_code=404)

    submission_status, subject_status = _OUTCOME[decision]
    now = utcnow()
    submission.status = submission_status
    submission.reviewed_by_user_id = admin.id
    submission.reviewed_at = now
    submission.decision_reason = reason
    subject.verification_status = subject_status
    subject.verified_at = now if decision is Decision.APPROVE else None
    audit.record(
        db,
        f"verification.{decision.value}",
        actor_user_id=admin.id,
        target_type=submission.subject_type,
        target_id=submission.subject_id,
        details={"submission_id": str(submission.id)},
    )
    return submission


def set_active_status(
    db: Session,
    *,
    admin: User,
    subject_type: SubjectType,
    subject_id: uuid.UUID,
    status: ActiveStatus,
    reason: str,
) -> Subject:
    subject = _load_subject(db, subject_type.value, subject_id, for_update=True)
    if subject is None:
        raise AppError("not_found", "Not found.", status_code=404)
    if subject.status == status:
        raise AppError("no_change", f"Already {status.value}.", status_code=409)
    subject.status = status
    audit.record(
        db,
        "provider.suspended" if status is ActiveStatus.SUSPENDED else "provider.reactivated",
        actor_user_id=admin.id,
        target_type=subject_type.value,
        target_id=subject_id,
        details={"reason": reason},
    )
    return subject
