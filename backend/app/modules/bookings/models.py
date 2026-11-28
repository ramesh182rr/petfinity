"""Bookings: one record for every booked service (decision 0005).

Capacity: each opening window allows `capacity` appointments at once. A booking
takes one numbered capacity unit of its listing (clinic or vet profile), and an
exclusion constraint forbids two slot-holding bookings on the same unit at
overlapping times. That makes overbooking impossible even under concurrent
requests; the service also serialises allocation per listing with an advisory
lock so callers get a clean "slot taken" instead of a constraint error.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    PrimaryKeyConstraint,
    SmallInteger,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, ExcludeConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class BookingType(StrEnum):
    VET_APPOINTMENT = "vet_appointment"
    CARE = "care"  # Phase 3 (caretaker offers)


class BookingStatus(StrEnum):
    PENDING_PROVIDER = "pending_provider"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    DECLINED = "declined"
    EXPIRED = "expired"
    CANCELLED_BY_OWNER = "cancelled_by_owner"
    CANCELLED_BY_PROVIDER = "cancelled_by_provider"
    CANCELLED_BY_ADMIN = "cancelled_by_admin"
    NO_SHOW = "no_show"
    DISPUTED = "disputed"


HOLDING_STATUSES = (
    BookingStatus.PENDING_PROVIDER,
    BookingStatus.CONFIRMED,
    BookingStatus.IN_PROGRESS,
)
_HOLDING_SQL = ", ".join(f"'{s.value}'" for s in HOLDING_STATUSES)
_STATUS_SQL = ", ".join(f"'{s.value}'" for s in BookingStatus)


class PaymentStatus(StrEnum):
    NOT_DUE = "not_due"  # waiting for the provider: never charged before confirmation
    UNPAID = "unpaid"  # confirmed, parent hasn't chosen yet
    PAY_AT_VISIT = "pay_at_visit"
    PAID = "paid"  # mock charge succeeded
    REFUNDED = "refunded"  # mock refund
    NOT_REFUNDED = "not_refunded"  # paid, then cancelled late
    PARTIALLY_REFUNDED = "partially_refunded"  # care: paid, cancelled inside 48 h (0015)


class CancellationOutcome(StrEnum):
    NOT_CHARGED = "not_charged"
    FULL_REFUND = "full_refund"
    LATE_NO_REFUND = "late_no_refund"
    LATE_HALF_REFUND = "late_half_refund"  # care, inside 48 h of the start (0015)


class Booking(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "bookings"

    booking_type: Mapped[str] = mapped_column(String(24), nullable=False)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    # The listing booked: exactly one of these (clinic or home-visit vet profile).
    clinic_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("clinics.id", ondelete="RESTRICT")
    )
    provider_profile_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("provider_profiles.id", ondelete="RESTRICT")
    )
    service_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("services.id", ondelete="RESTRICT")
    )
    # Care bookings (decision 0015): created by accepting a caretaker's offer.
    care_request_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("care_requests.id", ondelete="RESTRICT"), index=True
    )
    care_offer_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("care_offers.id", ondelete="RESTRICT"), unique=True
    )
    # Snapshots, so later edits to the service don't rewrite history.
    service_title: Mapped[str] = mapped_column(String(80), nullable=False)
    service_mode: Mapped[str] = mapped_column(String(16), nullable=False)
    confirmation_mode: Mapped[str] = mapped_column(String(16), nullable=False)
    amount_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, server_default="INR")
    cancellation_policy: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)

    status: Mapped[str] = mapped_column(String(24), nullable=False)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    timezone: Mapped[str] = mapped_column(String(40), nullable=False)
    response_deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Capacity bookkeeping (see module docstring).
    resource_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    capacity_unit: Mapped[int] = mapped_column(SmallInteger, nullable=False)

    owner_notes: Mapped[str | None] = mapped_column(String(500))
    # Home visits: shown to the provider only once the booking is confirmed (doc 13).
    visit_address: Mapped[str | None] = mapped_column(String(300))

    payment_status: Mapped[str] = mapped_column(String(20), nullable=False)
    cancellation_outcome: Mapped[str | None] = mapped_column(String(16))
    cancel_reason: Mapped[str | None] = mapped_column(String(300))

    idempotency_key: Mapped[str] = mapped_column(String(64), nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)

    __table_args__ = (
        UniqueConstraint("owner_id", "idempotency_key", name="uq_bookings_owner_idempotency"),
        CheckConstraint(f"status IN ({_STATUS_SQL})", name="valid_status"),
        CheckConstraint("booking_type IN ('vet_appointment', 'care')", name="valid_type"),
        CheckConstraint("(clinic_id IS NULL) <> (provider_profile_id IS NULL)", name="one_listing"),
        CheckConstraint(
            "booking_type <> 'vet_appointment' OR service_id IS NOT NULL", name="vet_has_service"
        ),
        CheckConstraint(
            "booking_type <> 'care' OR (care_offer_id IS NOT NULL AND care_request_id IS NOT NULL)",
            name="care_has_offer",
        ),
        CheckConstraint(
            "resource_id = coalesce(clinic_id, provider_profile_id)", name="resource_is_listing"
        ),
        CheckConstraint("start_at < end_at", name="valid_range"),
        CheckConstraint("capacity_unit BETWEEN 1 AND 20", name="valid_unit"),
        CheckConstraint("amount_minor >= 0", name="valid_amount"),
        CheckConstraint(
            "status <> 'pending_provider' OR response_deadline IS NOT NULL",
            name="pending_has_deadline",
        ),
        CheckConstraint(
            "payment_status IN ('not_due', 'unpaid', 'pay_at_visit', 'paid', 'refunded', "
            "'not_refunded', 'partially_refunded')",
            name="valid_payment_status",
        ),
        ExcludeConstraint(
            ("resource_id", "="),
            ("capacity_unit", "="),
            (text("tstzrange(start_at, end_at, '[)')"), "&&"),
            using="gist",
            where=text(f"status IN ({_HOLDING_SQL})"),
            name="ex_bookings_no_overlap",
        ),
        Index("ix_bookings_owner_start", "owner_id", "start_at"),
        Index("ix_bookings_resource_start", "resource_id", "start_at"),
        Index(
            "ix_bookings_pending_deadline",
            "response_deadline",
            postgresql_where=text("status = 'pending_provider'"),
        ),
    )


class BookingPet(Base):
    __tablename__ = "booking_pets"

    booking_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False
    )
    pet_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("pets.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    __table_args__ = (PrimaryKeyConstraint("booking_id", "pet_id", name="pk_booking_pets"),)


class BookingEvent(UUIDPrimaryKeyMixin, Base):
    """Append-only history: the audit trail and the user-visible timeline (0005)."""

    __tablename__ = "booking_events"

    booking_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    event: Mapped[str] = mapped_column(String(24), nullable=False)
    from_status: Mapped[str | None] = mapped_column(String(24))
    to_status: Mapped[str | None] = mapped_column(String(24))
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    actor_role: Mapped[str] = mapped_column(String(16), nullable=False)
    reason: Mapped[str | None] = mapped_column(String(300))
    details: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint(
            "actor_role IN ('owner', 'provider', 'admin', 'system')", name="valid_actor_role"
        ),
    )


class Payment(UUIDPrimaryKeyMixin, Base):
    """Payment ledger. MVP: provider is always 'mock' and nothing is ever charged."""

    __tablename__ = "payments"

    booking_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("bookings.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    provider: Mapped[str] = mapped_column(String(16), nullable=False)
    kind: Mapped[str] = mapped_column(String(8), nullable=False)
    amount_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    reference: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint("provider IN ('mock')", name="valid_provider"),
        CheckConstraint("kind IN ('charge', 'refund')", name="valid_kind"),
        CheckConstraint("status IN ('succeeded', 'failed')", name="valid_status"),
        CheckConstraint("amount_minor >= 0", name="valid_amount"),
    )
