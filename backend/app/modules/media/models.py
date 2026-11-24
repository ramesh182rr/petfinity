"""Uploaded files: metadata here, bytes in object storage (decision 0008)."""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKeyMixin


class MediaPurpose(StrEnum):
    PET_PHOTO = "pet_photo"


class MediaStatus(StrEnum):
    PENDING = "pending"  # upload URL issued, not yet confirmed
    READY = "ready"  # uploaded, verified and attached
    DELETED = "deleted"


class MediaAsset(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "media_assets"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    purpose: Mapped[str] = mapped_column(String(32), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    content_type: Mapped[str] = mapped_column(String(64), nullable=False)
    declared_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    size_bytes: Mapped[int | None] = mapped_column(BigInteger)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=MediaStatus.PENDING)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    uploaded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint("purpose IN ('pet_photo')", name="valid_purpose"),
        CheckConstraint("status IN ('pending', 'ready', 'deleted')", name="valid_status"),
        Index("ix_media_assets_owner_created", "owner_id", "created_at"),
        Index("ix_media_assets_status_created", "status", "created_at"),
    )
