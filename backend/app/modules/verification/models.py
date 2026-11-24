"""Verification documents and submissions. Documents are PRIVATE (doc 13)."""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKeyMixin


class SubjectType(StrEnum):
    PROVIDER_PROFILE = "provider_profile"
    CLINIC = "clinic"


class DocumentType(StrEnum):
    IDENTITY = "identity"  # government ID of the person
    VET_REGISTRATION = "vet_registration"  # state veterinary council registration
    QUALIFICATION = "qualification"  # degree certificate (B.V.Sc. etc.)
    CLINIC_REGISTRATION = "clinic_registration"  # shop & establishment / trade licence
    ADDRESS_PROOF = "address_proof"
    OTHER = "other"


class SubmissionStatus(StrEnum):
    PENDING = "pending"  # waiting for review
    APPROVED = "approved"
    NEEDS_INFO = "needs_info"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


_SUBJECTS = "'provider_profile', 'clinic'"


class VerificationDocument(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "verification_documents"

    subject_type: Mapped[str] = mapped_column(String(20), nullable=False)
    subject_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    doc_type: Mapped[str] = mapped_column(String(32), nullable=False)
    media_asset_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("media_assets.id", ondelete="RESTRICT"), nullable=False, unique=True
    )
    uploaded_by_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    submission_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("verification_submissions.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint(f"subject_type IN ({_SUBJECTS})", name="valid_subject"),
        CheckConstraint(
            "doc_type IN ('identity', 'vet_registration', 'qualification', "
            "'clinic_registration', 'address_proof', 'other')",
            name="valid_doc_type",
        ),
        Index("ix_verification_documents_subject", "subject_type", "subject_id"),
    )


class VerificationSubmission(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "verification_submissions"

    subject_type: Mapped[str] = mapped_column(String(20), nullable=False)
    subject_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    submitted_by_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    applicant_note: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=SubmissionStatus.PENDING
    )
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    # Review fields are written by the admin verification flow (milestone 2.2).
    reviewed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decision_reason: Mapped[str | None] = mapped_column(String(1000))

    __table_args__ = (
        CheckConstraint(f"subject_type IN ({_SUBJECTS})", name="valid_subject"),
        CheckConstraint(
            "status IN ('pending', 'approved', 'needs_info', 'rejected', 'withdrawn')",
            name="valid_status",
        ),
        Index("ix_verification_submissions_queue", "status", "submitted_at"),
        Index("ix_verification_submissions_subject", "subject_type", "subject_id"),
    )
