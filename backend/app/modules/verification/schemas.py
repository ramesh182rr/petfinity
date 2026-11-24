from __future__ import annotations

import uuid
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints, field_validator

from app.core.text import clean_text
from app.core.types import UtcDatetime
from app.modules.pets.schemas import UploadInstructions
from app.modules.verification.models import DocumentType, SubmissionStatus
from app.modules.verification.status import VerificationStatus


class DocumentUploadRequest(BaseModel):
    doc_type: DocumentType
    content_type: str = Field(description="application/pdf, image/jpeg, image/png or image/webp")
    size_bytes: int = Field(gt=0)


class DocumentUploadResponse(BaseModel):
    media_id: uuid.UUID
    upload: UploadInstructions
    expires_at: UtcDatetime


class DocumentConfirm(BaseModel):
    media_id: uuid.UUID
    doc_type: DocumentType


class DocumentResponse(BaseModel):
    """Metadata only: document contents are never returned to applicants or the public."""

    id: uuid.UUID
    doc_type: DocumentType
    content_type: str
    size_bytes: int | None
    uploaded_at: UtcDatetime
    submitted: bool


class SubmitRequest(BaseModel):
    note: Annotated[str, StringConstraints(max_length=500)] | None = None

    @field_validator("note")
    @classmethod
    def _note(cls, value: str | None) -> str | None:
        return clean_text(value)


class SubmissionSummary(BaseModel):
    id: uuid.UUID
    status: SubmissionStatus
    submitted_at: UtcDatetime
    reviewed_at: UtcDatetime | None
    decision_reason: str | None


class VerificationOverview(BaseModel):
    verification_status: VerificationStatus
    can_edit_documents: bool
    required_documents: list[DocumentType]
    missing_documents: list[DocumentType]
    missing_fields: list[str]
    documents: list[DocumentResponse]
    latest_submission: SubmissionSummary | None
