from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Annotated, Any

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

from app.core.clock import utcnow
from app.core.errors import AppError
from app.core.types import UtcDatetime
from app.modules.auth.identifiers import normalize_phone
from app.modules.pets.models import Sex, Species


def _clean_text(value: str | None) -> str | None:
    """Collapse surrounding whitespace; blank becomes None; reject control characters."""
    if value is None:
        return None
    cleaned = value.strip()
    if any(ord(ch) < 32 and ch not in "\n\t" for ch in cleaned):
        raise ValueError("contains invalid characters")
    return cleaned or None


Name = Annotated[str, StringConstraints(min_length=1, max_length=50)]
Short = Annotated[str, StringConstraints(max_length=80)]


class _PetFields(BaseModel):
    model_config = ConfigDict(extra="forbid")

    species_other: Annotated[str, StringConstraints(max_length=40)] | None = None
    breed: Short | None = None
    sex: Sex | None = None
    date_of_birth: date | None = None
    date_of_birth_is_estimate: bool | None = None
    weight_kg: Decimal | None = Field(default=None, gt=0, le=2000, decimal_places=2)
    neutered: bool | None = None
    temperament: Annotated[str, StringConstraints(max_length=500)] | None = None
    dietary_notes: Annotated[str, StringConstraints(max_length=1000)] | None = None
    allergies: Annotated[str, StringConstraints(max_length=1000)] | None = None
    known_conditions: Annotated[str, StringConstraints(max_length=1000)] | None = None
    medications: Annotated[str, StringConstraints(max_length=1000)] | None = None
    emergency_contact_name: Annotated[str, StringConstraints(max_length=60)] | None = None
    emergency_contact_phone: Annotated[str, StringConstraints(max_length=20)] | None = None

    @field_validator(
        "species_other",
        "breed",
        "temperament",
        "dietary_notes",
        "allergies",
        "known_conditions",
        "medications",
        "emergency_contact_name",
    )
    @classmethod
    def _text(cls, value: str | None) -> str | None:
        return _clean_text(value)

    @field_validator("date_of_birth")
    @classmethod
    def _dob(cls, value: date | None) -> date | None:
        if value is not None and (value > utcnow().date() or value.year < 1900):
            raise ValueError("date of birth must be in the past")
        return value

    @field_validator("emergency_contact_phone")
    @classmethod
    def _phone(cls, value: str | None) -> str | None:
        value = _clean_text(value)
        if value is None:
            return None
        try:
            return normalize_phone(value)
        except AppError as exc:
            raise ValueError("enter a valid phone number") from exc


class PetCreate(_PetFields):
    name: Name
    species: Species

    @field_validator("name")
    @classmethod
    def _name(cls, value: str) -> str:
        cleaned = _clean_text(value)
        if not cleaned:
            raise ValueError("name is required")
        return cleaned

    @model_validator(mode="after")
    def _species_other(self) -> PetCreate:
        if self.species is Species.OTHER and not self.species_other:
            raise ValueError("species_other is required when species is 'other'")
        if self.species is not Species.OTHER:
            self.species_other = None
        return self


class PetUpdate(_PetFields):
    """Partial update: omitted fields are unchanged; explicit null clears optional fields."""

    name: Name | None = None
    species: Species | None = None

    @field_validator("name")
    @classmethod
    def _name(cls, value: str | None) -> str | None:
        if value is None:
            raise ValueError("name cannot be cleared")
        cleaned = _clean_text(value)
        if not cleaned:
            raise ValueError("name is required")
        return cleaned

    @field_validator("species")
    @classmethod
    def _species(cls, value: Species | None) -> Species | None:
        if value is None:
            raise ValueError("species cannot be cleared")
        return value

    def changes(self) -> dict[str, Any]:
        return {name: getattr(self, name) for name in self.model_fields_set}


class PetResponse(BaseModel):
    id: uuid.UUID
    name: str
    species: Species
    species_other: str | None
    breed: str | None
    sex: Sex
    date_of_birth: date | None
    date_of_birth_is_estimate: bool
    weight_kg: Decimal | None
    neutered: bool | None
    temperament: str | None
    dietary_notes: str | None
    allergies: str | None
    known_conditions: str | None
    medications: str | None
    emergency_contact_name: str | None
    emergency_contact_phone: str | None
    photo_url: str | None = Field(
        description="Short-lived signed URL (absolute, or API-relative in local dev)"
    )
    created_at: UtcDatetime
    updated_at: UtcDatetime


class PhotoUploadRequest(BaseModel):
    content_type: str = Field(description="image/jpeg, image/png or image/webp")
    size_bytes: int = Field(gt=0)


class UploadInstructions(BaseModel):
    url: str
    method: str
    headers: dict[str, str]


class PhotoUploadResponse(BaseModel):
    media_id: uuid.UUID
    upload: UploadInstructions
    expires_at: UtcDatetime


class PhotoConfirm(BaseModel):
    media_id: uuid.UUID
