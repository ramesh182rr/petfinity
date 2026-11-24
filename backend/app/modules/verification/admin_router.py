"""Admin verification endpoints (milestone 2.2). Admin role required for everything."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import AdminUser, DbSession
from app.core.errors import error_responses
from app.modules.clinics.models import Clinic
from app.modules.pets.router import Storage
from app.modules.providers.models import ProviderProfile
from app.modules.providers.schemas import ProviderProfileResponse
from app.modules.users.models import User
from app.modules.verification import review
from app.modules.verification.admin_schemas import (
    ClinicAdminView,
    DecisionRequest,
    HistoryEntry,
    PersonSummary,
    QueueEntry,
    QueuePage,
    ReviewDocumentView,
    StatusChangeRequest,
    StatusChangeResponse,
    SubmissionDetailView,
)
from app.modules.verification.models import SubjectType, SubmissionStatus

router = APIRouter(prefix="/admin", tags=["admin"])
_ERRORS = error_responses(401, 403, 404, 409, 422)


def _person(user: User | None) -> PersonSummary | None:
    if user is None:
        return None
    return PersonSummary(
        id=user.id, display_name=user.display_name, email=user.email, phone=user.phone
    )


def _kind(subject: review.Subject | None, subject_type: str) -> str:
    if isinstance(subject, ProviderProfile):
        return subject.provider_type
    return "clinic" if subject_type == SubjectType.CLINIC else "unknown"


@router.get(
    "/verification/submissions",
    response_model=QueuePage,
    responses=_ERRORS,
    summary="Verification queue (pending: oldest first; others: newest first)",
)
def list_submissions(
    db: DbSession,
    _admin: AdminUser,
    status: SubmissionStatus | None = SubmissionStatus.PENDING,
    subject_type: SubjectType | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    before: datetime | None = None,
) -> QueuePage:
    items = review.list_submissions(
        db, status=status, subject_type=subject_type, limit=limit, before=before
    )
    entries = [
        QueueEntry(
            id=i.submission.id,
            subject_type=SubjectType(i.submission.subject_type),
            subject_id=i.submission.subject_id,
            subject_label=review.subject_label(i.subject),
            subject_kind=_kind(i.subject, i.submission.subject_type),
            city=getattr(i.subject, "city", None),
            status=SubmissionStatus(i.submission.status),
            submitted_at=i.submission.submitted_at,
            reviewed_at=i.submission.reviewed_at,
            submitter=_person(i.submitter),
        )
        for i in items
    ]
    next_before = entries[-1].submitted_at if len(entries) == limit else None
    return QueuePage(items=entries, next_before=next_before)


@router.get(
    "/verification/submissions/{submission_id}",
    response_model=SubmissionDetailView,
    responses=_ERRORS,
    summary="Review a submission (document links expire in 5 min)",
)
def get_submission(
    submission_id: uuid.UUID, db: DbSession, storage: Storage, admin: AdminUser
) -> SubmissionDetailView:
    detail = review.get_submission(db, storage, admin=admin, submission_id=submission_id)
    db.commit()  # persist the view audit entry
    s = detail.submission
    subject = detail.subject
    return SubmissionDetailView(
        id=s.id,
        subject_type=SubjectType(s.subject_type),
        subject_id=s.subject_id,
        status=SubmissionStatus(s.status),
        applicant_note=s.applicant_note,
        submitted_at=s.submitted_at,
        reviewed_at=s.reviewed_at,
        decision_reason=s.decision_reason,
        reviewer=_person(detail.reviewer),
        submitter=_person(detail.submitter),
        provider=ProviderProfileResponse.model_validate(subject)
        if isinstance(subject, ProviderProfile)
        else None,
        clinic=ClinicAdminView.model_validate(subject, from_attributes=True)
        if isinstance(subject, Clinic)
        else None,
        documents=[
            ReviewDocumentView(
                id=d.document.id,
                doc_type=d.document.doc_type,
                content_type=d.asset.content_type,
                size_bytes=d.asset.size_bytes,
                uploaded_at=d.document.created_at,
                url=d.url,
                url_expires_in=review.DOCUMENT_URL_TTL_SECONDS,
            )
            for d in detail.documents
        ],
        history=[
            HistoryEntry(
                id=h.id,
                status=SubmissionStatus(h.status),
                submitted_at=h.submitted_at,
                reviewed_at=h.reviewed_at,
                decision_reason=h.decision_reason,
            )
            for h in detail.history
        ],
    )


@router.post(
    "/verification/submissions/{submission_id}/decision",
    response_model=HistoryEntry,
    responses=_ERRORS,
    summary="Approve, ask for more information, or reject",
)
def decide(
    submission_id: uuid.UUID, body: DecisionRequest, db: DbSession, admin: AdminUser
) -> HistoryEntry:
    s = review.decide(
        db, admin=admin, submission_id=submission_id, decision=body.decision, reason=body.reason
    )
    db.commit()
    return HistoryEntry(
        id=s.id,
        status=SubmissionStatus(s.status),
        submitted_at=s.submitted_at,
        reviewed_at=s.reviewed_at,
        decision_reason=s.decision_reason,
    )


@router.post(
    "/verification/{subject_type}/{subject_id}/status",
    response_model=StatusChangeResponse,
    responses=_ERRORS,
    summary="Suspend or reactivate a provider profile or clinic",
)
def change_status(
    subject_type: SubjectType,
    subject_id: uuid.UUID,
    body: StatusChangeRequest,
    db: DbSession,
    admin: AdminUser,
) -> StatusChangeResponse:
    subject = review.set_active_status(
        db,
        admin=admin,
        subject_type=subject_type,
        subject_id=subject_id,
        status=body.status,
        reason=body.reason,
    )
    db.commit()
    return StatusChangeResponse(
        subject_type=subject_type, subject_id=subject_id, status=subject.status
    )
