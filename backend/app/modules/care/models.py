"""Caretaker services (milestone 3.1, decision 0015).

A caretaker lists which of the four care types they offer, with a base rate,
the species they take and how many pets fit in one booking. Each request is
still priced through an offer (3.3); the rate is a "from" guide for parents.
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
    Index,
    Integer,
    Numeric,
    PrimaryKeyConstraint,
    SmallInteger,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class CareType(StrEnum):
    HOME_VISIT = "home_visit"  # drop-in at the parent's home; priced per visit
    DAY_CARE = "day_care"  # at the caretaker's home; per day
    BOARDING = "boarding"  # overnight at the caretaker's home; per night
    HOUSE_SITTING = "house_sitting"  # caretaker stays at the parent's home; per night


RATE_UNIT = {
    CareType.HOME_VISIT: "visit",
    CareType.DAY_CARE: "day",
    CareType.BOARDING: "night",
    CareType.HOUSE_SITTING: "night",
}
# Care that happens at the caretaker's own home (their home details matter).
AT_CARETAKER_HOME = {CareType.DAY_CARE, CareType.BOARDING}

_TYPES_SQL = ", ".join(f"'{t.value}'" for t in CareType)


class HomeType(StrEnum):
    APARTMENT = "apartment"
    INDEPENDENT_HOUSE = "independent_house"


class CareService(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "care_services"

    provider_profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("provider_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    care_type: Mapped[str] = mapped_column(String(16), nullable=False)
    rate_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    species: Mapped[list[str]] = mapped_column(ARRAY(String(16)), nullable=False)
    max_pets: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default="2")
    notes: Mapped[str | None] = mapped_column(String(300))
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))

    __table_args__ = (
        UniqueConstraint("provider_profile_id", "care_type", name="uq_care_services_type"),
        CheckConstraint(f"care_type IN ({_TYPES_SQL})", name="valid_type"),
        CheckConstraint("rate_minor >= 0 AND rate_minor <= 5000000", name="valid_rate"),
        CheckConstraint("max_pets BETWEEN 1 AND 10", name="valid_max_pets"),
    )


class CareRequestStatus(StrEnum):
    OPEN = "open"  # caretakers may offer (until it closes); the parent may accept an offer
    BOOKED = "booked"  # an offer was accepted; see bookings.care_request_id
    CANCELLED = "cancelled"  # the parent withdrew it
    EXPIRED = "expired"  # no offers by the close, or nothing accepted before the start


class CareOfferStatus(StrEnum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"  # another offer was chosen, or the request ended
    WITHDRAWN = "withdrawn"  # the caretaker took it back


class CareRequest(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A pet parent's open request (milestone 3.2, decision 0015)."""

    __tablename__ = "care_requests"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    care_type: Mapped[str] = mapped_column(String(16), nullable=False)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    visits_per_day: Mapped[int | None] = mapped_column(SmallInteger)
    # Where: the area and locality are shown to caretakers; the pin and address are private.
    area_key: Mapped[str] = mapped_column(String(32), nullable=False)
    locality: Mapped[str] = mapped_column(String(100), nullable=False)
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    address: Mapped[str | None] = mapped_column(String(300))
    notes: Mapped[str | None] = mapped_column(String(1000))
    budget_minor: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(12), nullable=False)
    offers_close_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        CheckConstraint(f"care_type IN ({_TYPES_SQL})", name="valid_type"),
        CheckConstraint(
            "status IN ('open', 'booked', 'cancelled', 'expired')", name="valid_status"
        ),
        CheckConstraint("start_at < end_at", name="valid_range"),
        CheckConstraint(
            "(care_type = 'home_visit') = (visits_per_day IS NOT NULL)", name="visits_for_visits"
        ),
        CheckConstraint(
            "visits_per_day IS NULL OR visits_per_day BETWEEN 1 AND 3", name="valid_visits"
        ),
        CheckConstraint("budget_minor IS NULL OR budget_minor >= 0", name="valid_budget"),
        CheckConstraint("(latitude IS NULL) = (longitude IS NULL)", name="valid_coordinates"),
        Index("ix_care_requests_status_start", "status", "start_at"),
        Index("ix_care_requests_area_status", "area_key", "status"),
    )


class CareRequestPet(Base):
    __tablename__ = "care_request_pets"

    request_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("care_requests.id", ondelete="CASCADE"), nullable=False
    )
    pet_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("pets.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    __table_args__ = (PrimaryKeyConstraint("request_id", "pet_id", name="pk_care_request_pets"),)


class CareOffer(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A caretaker's priced answer to a request (milestone 3.3). One per caretaker."""

    __tablename__ = "care_offers"

    request_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("care_requests.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider_profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("provider_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    price_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    message: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(12), nullable=False)

    __table_args__ = (
        UniqueConstraint("request_id", "provider_profile_id", name="uq_care_offers_once"),
        CheckConstraint(
            "status IN ('pending', 'accepted', 'declined', 'withdrawn')", name="valid_status"
        ),
        CheckConstraint("price_minor >= 0 AND price_minor <= 20000000", name="valid_price"),
    )
