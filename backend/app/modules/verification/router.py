"""Verification for provider profiles and clinics (applicant side)."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Response, status

from app.api.deps import AppSettings, CurrentUser, DbSession
from app.core.errors import error_responses
from app.modules.media.models import MediaAsset
from app.modules.pets.router import Storage
from app.modules.pets.schemas import UploadInstructions
from app.modules.verification import service
from app.modules.verification.models import SubjectType, VerificationDocument
from app.modules.verification.schemas import (
    DocumentConfirm,
    DocumentResponse,
    DocumentUploadRequest,
    DocumentUploadResponse,
    SubmissionSummary,
    SubmitRequest,
    VerificationOverview,
)
from app.modules.verification.status import EDITABLE_DOCUMENT_STATES, VerificationStatus

router = APIRouter(prefix="/verification/{subject_type}/{subject_id}", tags=["verification"])
_ERRORS = error_responses(401, 403, 404, 409, 413, 415, 422, 429)


class SubjectPath:
    def __init__(self, subject_type: SubjectType, subject_id: uuid.UUID) -> None:
        self.type = subject_type
        self.id = subject_id


Subject = Annotated[SubjectPath, Depends()]


def _doc(doc: VerificationDocument, asset: MediaAsset) -> DocumentResponse:
    return DocumentResponse(
        id=doc.id,
        doc_type=doc.doc_type,
        content_type=asset.content_type,
        size_bytes=asset.size_bytes,
        uploaded_at=doc.created_at,
        submitted=doc.submission_id is not None,
    )


@router.get(
    "",
    response_model=VerificationOverview,
    summary="Verification status and checklist",
    responses=_ERRORS,
)
def get_overview(subject: Subject, db: DbSession, user: CurrentUser) -> VerificationOverview:
    state = service.overview(db, user.id, subject.type, subject.id)
    latest = state.latest_submission
    status_value = VerificationStatus(state.subject.verification_status)
    return VerificationOverview(
        verification_status=status_value,
        can_edit_documents=status_value in EDITABLE_DOCUMENT_STATES,
        required_documents=state.requirements.documents,
        missing_documents=state.missing_documents,
        missing_fields=state.missing_fields,
        documents=[_doc(d, a) for d, a in state.documents],
        latest_submission=SubmissionSummary(
            id=latest.id,
            status=latest.status,
            submitted_at=latest.submitted_at,
            reviewed_at=latest.reviewed_at,
            decision_reason=latest.decision_reason,
        )
        if latest
        else None,
    )


@router.post(
    "/documents/upload-url",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Get a short-lived URL to upload a private verification document",
    responses=_ERRORS,
)
def create_document_upload(
    subject: Subject,
    body: DocumentUploadRequest,
    db: DbSession,
    settings: AppSettings,
    storage: Storage,
    user: CurrentUser,
) -> DocumentUploadResponse:
    ticket = service.create_document_upload(
        db,
        settings,
        storage,
        user_id=user.id,
        subject_type=subject.type,
        subject_id=subject.id,
        content_type=body.content_type,
        size_bytes=body.size_bytes,
    )
    db.commit()
    return DocumentUploadResponse(
        media_id=ticket.asset.id,
        upload=UploadInstructions(
            url=ticket.upload.url, method=ticket.upload.method, headers=ticket.upload.headers
        ),
        expires_at=ticket.expires_at,
    )


@router.post(
    "/documents",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Confirm an uploaded document",
    responses=_ERRORS,
)
def confirm_document(
    subject: Subject,
    body: DocumentConfirm,
    db: DbSession,
    settings: AppSettings,
    storage: Storage,
    user: CurrentUser,
) -> DocumentResponse:
    doc, asset = service.confirm_document(
        db,
        settings,
        storage,
        user_id=user.id,
        subject_type=subject.type,
        subject_id=subject.id,
        media_id=body.media_id,
        doc_type=body.doc_type,
    )
    db.commit()
    return _doc(doc, asset)


@router.delete(
    "/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a document that hasn't been submitted",
    responses=_ERRORS,
)
def delete_document(
    subject: Subject,
    document_id: uuid.UUID,
    db: DbSession,
    storage: Storage,
    user: CurrentUser,
) -> Response:
    service.delete_document(
        db,
        storage,
        user_id=user.id,
        subject_type=subject.type,
        subject_id=subject.id,
        document_id=document_id,
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/submit",
    response_model=SubmissionSummary,
    status_code=status.HTTP_201_CREATED,
    summary="Send for admin review",
    responses=_ERRORS,
)
def submit(
    subject: Subject, body: SubmitRequest, db: DbSession, user: CurrentUser
) -> SubmissionSummary:
    submission = service.submit(
        db, user_id=user.id, subject_type=subject.type, subject_id=subject.id, note=body.note
    )
    db.commit()
    return SubmissionSummary(
        id=submission.id,
        status=submission.status,
        submitted_at=submission.submitted_at,
        reviewed_at=None,
        decision_reason=None,
    )
