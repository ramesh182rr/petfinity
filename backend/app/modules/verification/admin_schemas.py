from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, StringConstraints, field_validator

from app.core.text import clean_text
from app.core.types import UtcDatetime
from app.modules.providers.schemas import ProviderProfileResponse
from app.modules.verification.models import DocumentType, SubjectType, SubmissionStatus
from app.modules.verification.review import Decision
from app.modules.verification.status import ActiveStatus, VerificationStatus


class PersonSummary(BaseModel):
    id: uuid.UUID
    display_name: str | None
    email: str | None
    phone: str | None


class QueueEntry(BaseModel):
    id: uuid.UUID
    subject_type: SubjectType
    subject_id: uuid.UUID
    subject_label: str
    subject_kind: str  # "veterinarian" | "caretaker" | "clinic"
    city: str | None
    status: SubmissionStatus
    submitted_at: UtcDatetime
    reviewed_at: UtcDatetime | None
    submitter: PersonSummary | None


class QueuePage(BaseModel):
    items: list[QueueEntry]
    next_before: UtcDatetime | None


class ClinicAdminView(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    phone: str
    email: str | None
    address_line1: str
    address_line2: str | None
    locality: str | None
    city: str
    state: str
    postal_code: str
    latitude: Decimal | None
    longitude: Decimal | None
    emergency_services: bool
    verification_status: VerificationStatus
    verified_at: UtcDatetime | None
    status: ActiveStatus


class ReviewDocumentView(BaseModel):
    id: uuid.UUID
    doc_type: DocumentType
    content_type: str
    size_bytes: int | None
    uploaded_at: UtcDatetime
    url: str
    url_expires_in: int


class HistoryEntry(BaseModel):
    id: uuid.UUID
    status: SubmissionStatus
    submitted_at: UtcDatetime
    reviewed_at: UtcDatetime | None
    decision_reason: str | None


class SubmissionDetailView(BaseModel):
    id: uuid.UUID
    subject_type: SubjectType
    subject_id: uuid.UUID
    status: SubmissionStatus
    applicant_note: str | None
    submitted_at: UtcDatetime
    reviewed_at: UtcDatetime | None
    decision_reason: str | None
    reviewer: PersonSummary | None
    submitter: PersonSummary | None
    provider: ProviderProfileResponse | None
    clinic: ClinicAdminView | None
    documents: list[ReviewDocumentView]
    history: list[HistoryEntry]


Reason = Annotated[str, StringConstraints(max_length=1000)]


class DecisionRequest(BaseModel):
    decision: Decision
    reason: Reason | None = None

    @field_validator("reason")
    @classmethod
    def _reason(cls, value: str | None) -> str | None:
        return clean_text(value)


class StatusChangeRequest(BaseModel):
    status: ActiveStatus
    reason: Annotated[str, StringConstraints(min_length=3, max_length=500)]

    @field_validator("reason")
    @classmethod
    def _reason(cls, value: str) -> str:
        cleaned = clean_text(value)
        if not cleaned or len(cleaned) < 3:
            raise ValueError("please give a short reason")
        return cleaned


class StatusChangeResponse(BaseModel):
    subject_type: SubjectType
    subject_id: uuid.UUID
    status: ActiveStatus
