"""Provider profiles: a person's professional identity (decision 0006).

One account can hold a veterinarian profile and a caretaker profile; each is
verified separately. Caretaker-specific fields arrive with Phase 3.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.modules.verification.status import VERIFICATION_SQL, ActiveStatus, VerificationStatus


class ProviderType(StrEnum):
    VETERINARIAN = "veterinarian"
    CARETAKER = "caretaker"


class ProviderProfile(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "provider_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider_type: Mapped[str] = mapped_column(String(16), nullable=False)
    display_name: Mapped[str] = mapped_column(String(80), nullable=False)
    bio: Mapped[str | None] = mapped_column(String(1000))
    years_experience: Mapped[int | None] = mapped_column(Integer)
    languages: Mapped[list[str]] = mapped_column(
        ARRAY(String(30)), nullable=False, server_default="{}", default=list
    )
    city: Mapped[str | None] = mapped_column(String(80))
    # Veterinarian credentials (verified against the state veterinary council register).
    registration_number: Mapped[str | None] = mapped_column(String(50))
    registration_council: Mapped[str | None] = mapped_column(String(120))
    qualifications: Mapped[str | None] = mapped_column(String(200))

    verification_status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=VerificationStatus.DRAFT
    )
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=ActiveStatus.ACTIVE)

    __table_args__ = (
        UniqueConstraint("user_id", "provider_type", name="uq_provider_profiles_user_type"),
        CheckConstraint("provider_type IN ('veterinarian', 'caretaker')", name="valid_type"),
        CheckConstraint(f"verification_status IN ({VERIFICATION_SQL})", name="valid_verification"),
        CheckConstraint("status IN ('active', 'suspended')", name="valid_status"),
        CheckConstraint(
            "years_experience IS NULL OR (years_experience >= 0 AND years_experience <= 70)",
            name="valid_experience",
        ),
    )
