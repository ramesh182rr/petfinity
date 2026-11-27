"""Reviews of completed visits, with reports and moderation (milestone 2.10, decision 0014).

Lifecycle: `published` (public) → `pending` (hidden: auto-flagged or reported, waiting
for a moderator) → back to `published` (kept) or `removed` (taken down).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ReviewStatus(StrEnum):
    PUBLISHED = "published"
    PENDING = "pending"
    REMOVED = "removed"


class ReportReason(StrEnum):
    FAKE = "fake"  # not a genuine visit or experience
    ABUSIVE = "abusive"
    PRIVATE_INFO = "private_info"  # phone numbers, addresses, names of staff
    SPAM = "spam"
    OTHER = "other"


class Review(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "reviews"

    booking_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # The listing reviewed (same as the booking's): exactly one.
    clinic_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("clinics.id", ondelete="CASCADE")
    )
    provider_profile_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("provider_profiles.id", ondelete="CASCADE")
    )
    rating: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    text: Mapped[str | None] = mapped_column(String(1000))
    status: Mapped[str] = mapped_column(String(12), nullable=False)
    flag_reason: Mapped[str | None] = mapped_column(String(40))  # why it's pending
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    reply_text: Mapped[str | None] = mapped_column(String(600))
    replied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    replied_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    moderated_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    moderated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    moderation_note: Mapped[str | None] = mapped_column(String(300))

    __table_args__ = (
        CheckConstraint("rating BETWEEN 1 AND 5", name="valid_rating"),
        CheckConstraint("status IN ('published', 'pending', 'removed')", name="valid_status"),
        CheckConstraint("(clinic_id IS NULL) <> (provider_profile_id IS NULL)", name="one_listing"),
        Index("ix_reviews_clinic_status", "clinic_id", "status", "created_at"),
        Index("ix_reviews_profile_status", "provider_profile_id", "status", "created_at"),
        Index("ix_reviews_status_updated", "status", "updated_at"),
    )


class ReviewReport(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "review_reports"

    review_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("reviews.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reporter_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    reason: Mapped[str] = mapped_column(String(16), nullable=False)
    note: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        UniqueConstraint("review_id", "reporter_id", name="uq_review_reports_once"),
        CheckConstraint(
            "reason IN ('fake', 'abusive', 'private_info', 'spam', 'other')", name="valid_reason"
        ),
    )
