"""Services and availability (milestone 2.4; decisions 0004, 0005).

Owner = a clinic (managed by its operators) OR an independent veterinarian's
provider profile (e.g. home visits). Exactly one is set on every row.
Money is stored in minor units (paise) to avoid rounding errors.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, time
from enum import StrEnum

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Time,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class OwnerType(StrEnum):
    CLINIC = "clinic"
    PROVIDER_PROFILE = "provider_profile"


class ServiceCategory(StrEnum):
    GENERAL_CONSULTATION = "general_consultation"
    VACCINATION = "vaccination"
    DEWORMING = "deworming"
    SKIN_EAR = "skin_ear"
    DENTAL = "dental"
    SURGERY = "surgery"
    DIAGNOSTICS = "diagnostics"
    BLOOD_TEST = "blood_test"
    IMAGING = "imaging"
    STERILISATION = "sterilisation"
    EMERGENCY = "emergency"
    PREVENTIVE_CHECK = "preventive_check"


class ServiceMode(StrEnum):
    IN_CLINIC = "in_clinic"
    HOME_VISIT = "home_visit"
    TELECONSULT = "teleconsult"  # modelled; enabled only after compliance review


class ConfirmationMode(StrEnum):
    INSTANT = "instant"
    REQUEST = "request"


class ExceptionKind(StrEnum):
    CLOSED = "closed"  # no slots that day
    CUSTOM_HOURS = "custom_hours"  # these ranges replace the weekly hours that day


_OWNER_CHECK = "(clinic_id IS NULL) <> (provider_profile_id IS NULL)"


def _enum_sql(enum: type[StrEnum]) -> str:
    return ", ".join(f"'{member.value}'" for member in enum)


class _Owned:
    clinic_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("clinics.id", ondelete="CASCADE"), index=True
    )
    provider_profile_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("provider_profiles.id", ondelete="CASCADE"), index=True
    )


class Service(UUIDPrimaryKeyMixin, TimestampMixin, _Owned, Base):
    __tablename__ = "services"

    category: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500))
    price_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, server_default="INR")
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    service_mode: Mapped[str] = mapped_column(String(16), nullable=False)
    confirmation_mode: Mapped[str] = mapped_column(String(16), nullable=False)
    species: Mapped[list[str]] = mapped_column(ARRAY(String(16)), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint(_OWNER_CHECK, name="one_owner"),
        CheckConstraint(f"category IN ({_enum_sql(ServiceCategory)})", name="valid_category"),
        CheckConstraint(f"service_mode IN ({_enum_sql(ServiceMode)})", name="valid_mode"),
        CheckConstraint(
            f"confirmation_mode IN ({_enum_sql(ConfirmationMode)})", name="valid_confirmation"
        ),
        CheckConstraint("price_minor >= 0 AND price_minor <= 10000000", name="valid_price"),
        CheckConstraint(
            "duration_minutes BETWEEN 5 AND 480 AND mod(duration_minutes, 5) = 0",
            name="valid_duration",
        ),
        CheckConstraint("currency = 'INR'", name="inr_only"),
    )


class AvailabilityRule(UUIDPrimaryKeyMixin, _Owned, Base):
    """Weekly opening range. Several per weekday = breaks between them."""

    __tablename__ = "availability_rules"

    weekday: Mapped[int] = mapped_column(Integer, nullable=False)  # 0 = Monday … 6 = Sunday
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint(_OWNER_CHECK, name="one_owner"),
        CheckConstraint("weekday BETWEEN 0 AND 6", name="valid_weekday"),
        CheckConstraint("start_time < end_time", name="valid_range"),
        CheckConstraint("capacity BETWEEN 1 AND 20", name="valid_capacity"),
    )


class AvailabilityException(UUIDPrimaryKeyMixin, _Owned, Base):
    """Day off, or special hours replacing the weekly hours on one date."""

    __tablename__ = "availability_exceptions"

    on_date: Mapped[date] = mapped_column(Date, nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    start_time: Mapped[time | None] = mapped_column(Time)
    end_time: Mapped[time | None] = mapped_column(Time)
    capacity: Mapped[int | None] = mapped_column(Integer)
    note: Mapped[str | None] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint(_OWNER_CHECK, name="one_owner"),
        CheckConstraint(f"kind IN ({_enum_sql(ExceptionKind)})", name="valid_kind"),
        CheckConstraint(
            "(kind = 'closed' AND start_time IS NULL AND end_time IS NULL) OR "
            "(kind = 'custom_hours' AND start_time < end_time AND capacity BETWEEN 1 AND 20)",
            name="valid_shape",
        ),
        Index("ix_availability_exceptions_date", "on_date"),
    )
