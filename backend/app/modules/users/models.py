"""User accounts (decision 0006: one account per person, additive capabilities)."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from sqlalchemy import CheckConstraint, DateTime, String
from sqlalchemy.dialects.postgresql import CITEXT
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class UserStatus(StrEnum):
    ACTIVE = "active"
    SUSPENDED = "suspended"


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str | None] = mapped_column(CITEXT, unique=True, nullable=True)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # E.164, e.g. +919876543210
    phone: Mapped[str | None] = mapped_column(String(16), unique=True, nullable=True)
    phone_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    display_name: Mapped[str | None] = mapped_column(String(60), nullable=True)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=UserStatus.ACTIVE, server_default=UserStatus.ACTIVE
    )

    __table_args__ = (
        CheckConstraint("email IS NOT NULL OR phone IS NOT NULL", name="has_identifier"),
        CheckConstraint("status IN ('active', 'suspended')", name="valid_status"),
    )

    @property
    def is_active(self) -> bool:
        return self.status == UserStatus.ACTIVE
