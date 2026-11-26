"""Clinics (businesses) and their members (decision 0006)."""

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
    Index,
    Numeric,
    String,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.modules.verification.status import VERIFICATION_SQL, ActiveStatus, VerificationStatus


class MemberRole(StrEnum):
    OPERATOR = "operator"  # manages the clinic listing, services, hours and bookings
    VETERINARIAN = "veterinarian"  # practises here; must hold a veterinarian profile


class Clinic(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "clinics"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000))
    phone: Mapped[str] = mapped_column(String(16), nullable=False)
    email: Mapped[str | None] = mapped_column(String(254))
    address_line1: Mapped[str] = mapped_column(String(200), nullable=False)
    address_line2: Mapped[str | None] = mapped_column(String(200))
    locality: Mapped[str | None] = mapped_column(String(100))
    city: Mapped[str] = mapped_column(String(80), nullable=False)
    state: Mapped[str] = mapped_column(String(60), nullable=False)
    postal_code: Mapped[str] = mapped_column(String(6), nullable=False)
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    # Launch area (decision 0011). Discovery uses the exact coordinates when set,
    # otherwise the area's centre (shown as an approximate distance).
    area_key: Mapped[str | None] = mapped_column(String(32))
    timezone: Mapped[str] = mapped_column(
        String(40), nullable=False, default="Asia/Kolkata", server_default="Asia/Kolkata"
    )
    emergency_services: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    verification_status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=VerificationStatus.DRAFT
    )
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=ActiveStatus.ACTIVE)

    __table_args__ = (
        CheckConstraint(f"verification_status IN ({VERIFICATION_SQL})", name="valid_verification"),
        CheckConstraint("status IN ('active', 'suspended')", name="valid_status"),
        CheckConstraint("postal_code ~ '^[1-9][0-9]{5}$'", name="valid_postal_code"),
        CheckConstraint(
            "(latitude IS NULL) = (longitude IS NULL) AND "
            "(latitude IS NULL OR "
            "(latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180))",
            name="valid_coordinates",
        ),
        Index("ix_clinics_city_verification", "city", "verification_status"),
        Index("ix_clinics_area_verification", "area_key", "verification_status"),
    )


class ClinicMember(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "clinic_members"

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    member_role: Mapped[str] = mapped_column(String(16), nullable=False)
    added_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    removed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint("member_role IN ('operator', 'veterinarian')", name="valid_role"),
        Index(
            "uq_clinic_members_active",
            "clinic_id",
            "user_id",
            "member_role",
            unique=True,
            postgresql_where=text("removed_at IS NULL"),
        ),
    )
