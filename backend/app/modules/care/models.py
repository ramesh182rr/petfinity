"""Caretaker services (milestone 3.1, decision 0015).

A caretaker lists which of the four care types they offer, with a base rate,
the species they take and how many pets fit in one booking. Each request is
still priced through an offer (3.3); the rate is a "from" guide for parents.
"""

from __future__ import annotations

import uuid
from enum import StrEnum

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Integer,
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
