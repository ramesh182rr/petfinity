"""Platform staff roles: audited grants, never derived from email alone (decision 0006)."""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKeyMixin


class StaffRoleName(StrEnum):
    ADMIN = "admin"
    MODERATOR = "moderator"


class StaffRole(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "staff_roles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    # NULL granted_by = bootstrap grant from BOOTSTRAP_ADMIN_EMAILS.
    granted_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    granted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    __table_args__ = (
        CheckConstraint("role IN ('admin', 'moderator')", name="valid_role"),
        # At most one active grant of a role per user.
        Index(
            "uq_staff_roles_active_user_role",
            "user_id",
            "role",
            unique=True,
            postgresql_where=text("revoked_at IS NULL"),
        ),
    )
