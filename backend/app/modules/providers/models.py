"""Provider profiles: a person's professional identity (decision 0006).

One account can hold a veterinarian profile and a caretaker profile; each is
verified separately. Caretaker-specific fields arrive with Phase 3.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
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
    # Home-visit base (decision 0011). Private: discovery never returns these
    # coordinates, only the area name and the service radius.
    area_key: Mapped[str | None] = mapped_column(String(32))
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    service_radius_km: Mapped[int | None] = mapped_column(Integer)
    # Caretakers only (decision 0015): their home, for day care and boarding, and capacity.
    home_type: Mapped[str | None] = mapped_column(String(20))
    outdoor_space: Mapped[bool | None] = mapped_column(Boolean)
    pets_at_home: Mapped[str | None] = mapped_column(String(120))
    max_concurrent: Mapped[int | None] = mapped_column(Integer)
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
        CheckConstraint(
            "(latitude IS NULL) = (longitude IS NULL) AND "
            "(latitude IS NULL OR "
            "(latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180))",
            name="valid_coordinates",
        ),
        CheckConstraint(
            "home_type IS NULL OR home_type IN ('apartment', 'independent_house')",
            name="valid_home_type",
        ),
        CheckConstraint(
            "max_concurrent IS NULL OR max_concurrent BETWEEN 1 AND 5", name="valid_max_concurrent"
        ),
        CheckConstraint(
            "service_radius_km IS NULL OR service_radius_km BETWEEN 1 AND 50",
            name="valid_service_radius",
        ),
    )
