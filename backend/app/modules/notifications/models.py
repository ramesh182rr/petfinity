"""In-app notifications and push devices (milestone 2.9, decision 0013).

Every notification is stored first (the in-app inbox is the source of truth),
then pushed from the outbox: `push_status` starts `pending` and the delivery step
marks it `sent`, `failed` or `skipped`. A missed push never loses the message.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKeyMixin


class PushStatus(StrEnum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    SKIPPED = "skipped"  # no device, or push not wanted for this kind


class Notification(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "notifications"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    kind: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    body: Mapped[str] = mapped_column(String(300), nullable=False)
    # Where tapping it goes in the app, e.g. {"route": "/bookings/<id>", "booking_id": ...}
    data: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    # Makes scheduled sends idempotent, e.g. "booking:<id>:reminder_24h" (unique per user).
    dedupe_key: Mapped[str | None] = mapped_column(String(120))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    push_status: Mapped[str] = mapped_column(String(12), nullable=False)
    push_attempts: Mapped[int] = mapped_column(nullable=False, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint(
            "push_status IN ('pending', 'sent', 'failed', 'skipped')", name="valid_push_status"
        ),
        Index("ix_notifications_user_created", "user_id", "created_at"),
        Index(
            "ix_notifications_user_unread",
            "user_id",
            postgresql_where=text("read_at IS NULL"),
        ),
        Index(
            "ix_notifications_push_pending",
            "created_at",
            postgresql_where=text("push_status = 'pending'"),
        ),
        Index(
            "uq_notifications_user_dedupe",
            "user_id",
            "dedupe_key",
            unique=True,
            postgresql_where=text("dedupe_key IS NOT NULL"),
        ),
    )


class PushDevice(UUIDPrimaryKeyMixin, Base):
    """An Expo push token for one install. Tokens move between accounts on sign-in."""

    __tablename__ = "push_devices"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    platform: Mapped[str] = mapped_column(String(10), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    disabled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (CheckConstraint("platform IN ('android', 'ios')", name="valid_platform"),)
