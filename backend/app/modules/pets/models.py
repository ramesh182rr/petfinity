"""Pet profiles: all species supported (product owner decision)."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Species(StrEnum):
    DOG = "dog"
    CAT = "cat"
    BIRD = "bird"
    RABBIT = "rabbit"
    GUINEA_PIG = "guinea_pig"
    HAMSTER = "hamster"
    FISH = "fish"
    TURTLE = "turtle"
    REPTILE = "reptile"
    HORSE = "horse"
    COW = "cow"
    GOAT = "goat"
    OTHER = "other"


class Sex(StrEnum):
    MALE = "male"
    FEMALE = "female"
    UNKNOWN = "unknown"


_SPECIES_SQL = ", ".join(f"'{s.value}'" for s in Species)


class Pet(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "pets"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    species: Mapped[str] = mapped_column(String(16), nullable=False)
    species_other: Mapped[str | None] = mapped_column(String(40))
    breed: Mapped[str | None] = mapped_column(String(80))
    sex: Mapped[str] = mapped_column(String(8), nullable=False, default=Sex.UNKNOWN)
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    date_of_birth_is_estimate: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    weight_kg: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    neutered: Mapped[bool | None] = mapped_column(Boolean)
    temperament: Mapped[str | None] = mapped_column(String(500))
    # Health and care details: sensitive in context, visible to the owner only (doc 13).
    dietary_notes: Mapped[str | None] = mapped_column(String(1000))
    allergies: Mapped[str | None] = mapped_column(String(1000))
    known_conditions: Mapped[str | None] = mapped_column(String(1000))
    medications: Mapped[str | None] = mapped_column(String(1000))
    emergency_contact_name: Mapped[str | None] = mapped_column(String(60))
    emergency_contact_phone: Mapped[str | None] = mapped_column(String(16))
    photo_media_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("media_assets.id", ondelete="SET NULL")
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint(f"species IN ({_SPECIES_SQL})", name="valid_species"),
        CheckConstraint("sex IN ('male', 'female', 'unknown')", name="valid_sex"),
        CheckConstraint(
            "weight_kg IS NULL OR (weight_kg > 0 AND weight_kg <= 2000)", name="valid_weight"
        ),
        CheckConstraint(
            "(species = 'other') = (species_other IS NOT NULL)", name="species_other_matches"
        ),
        Index(
            "ix_pets_owner_active",
            "owner_id",
            "created_at",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )
