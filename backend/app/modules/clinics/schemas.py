from __future__ import annotations

import re
import uuid
from decimal import Decimal
from typing import Annotated, Any

from email_validator import EmailNotValidError, validate_email
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

from app.core.errors import AppError
from app.core.text import clean_required, clean_text
from app.core.types import UtcDatetime
from app.modules.auth.identifiers import normalize_contact_phone
from app.modules.clinics.models import MemberRole
from app.modules.discovery.areas import AreaKey
from app.modules.verification.status import ActiveStatus, VerificationStatus

_PIN = re.compile(r"^[1-9][0-9]{5}$")
Lat = Annotated[Decimal, Field(ge=-90, le=90, max_digits=9, decimal_places=6)]
Lng = Annotated[Decimal, Field(ge=-180, le=180, max_digits=9, decimal_places=6)]


def _phone(value: str | None) -> str | None:
    value = clean_text(value)
    if value is None:
        return None
    try:
        return normalize_contact_phone(value)
    except AppError as exc:
        raise ValueError("enter a valid phone number") from exc


def _email(value: str | None) -> str | None:
    value = clean_text(value)
    if value is None:
        return None
    try:
        return validate_email(value, check_deliverability=False).normalized.lower()
    except EmailNotValidError as exc:
        raise ValueError("enter a valid email address") from exc


class _ClinicFields(BaseModel):
    model_config = ConfigDict(extra="forbid")

    description: Annotated[str, StringConstraints(max_length=1000)] | None = None
    email: Annotated[str, StringConstraints(max_length=254)] | None = None
    address_line2: Annotated[str, StringConstraints(max_length=200)] | None = None
    locality: Annotated[str, StringConstraints(max_length=100)] | None = None
    latitude: Lat | None = None
    longitude: Lng | None = None
    area_key: AreaKey | None = None
    emergency_services: bool | None = None

    @field_validator("description", "address_line2", "locality")
    @classmethod
    def _text(cls, value: str | None) -> str | None:
        return clean_text(value)

    @field_validator("email")
    @classmethod
    def _valid_email(cls, value: str | None) -> str | None:
        return _email(value)


class ClinicCreate(_ClinicFields):
    name: Annotated[str, StringConstraints(min_length=2, max_length=120)]
    phone: Annotated[str, StringConstraints(max_length=20)]
    address_line1: Annotated[str, StringConstraints(min_length=3, max_length=200)]
    city: Annotated[str, StringConstraints(min_length=2, max_length=80)]
    state: Annotated[str, StringConstraints(min_length=2, max_length=60)]
    postal_code: str
    practises_here: bool = Field(
        default=False,
        description="Also list me as a veterinarian at this clinic (needs a veterinarian profile)",
    )

    @field_validator("name", "address_line1", "city", "state")
    @classmethod
    def _required(cls, value: str) -> str:
        return clean_required(value)

    @field_validator("phone")
    @classmethod
    def _valid_phone(cls, value: str) -> str:
        phone = _phone(value)
        if phone is None:
            raise ValueError("phone is required")
        return phone

    @field_validator("postal_code")
    @classmethod
    def _pin(cls, value: str) -> str:
        value = value.strip()
        if not _PIN.fullmatch(value):
            raise ValueError("enter a valid 6-digit PIN code")
        return value

    @model_validator(mode="after")
    def _coordinates(self) -> ClinicCreate:
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must be provided together")
        return self


class ClinicUpdate(_ClinicFields):
    name: Annotated[str, StringConstraints(min_length=2, max_length=120)] | None = None
    phone: Annotated[str, StringConstraints(max_length=20)] | None = None
    address_line1: Annotated[str, StringConstraints(min_length=3, max_length=200)] | None = None
    city: Annotated[str, StringConstraints(min_length=2, max_length=80)] | None = None
    state: Annotated[str, StringConstraints(min_length=2, max_length=60)] | None = None
    postal_code: str | None = None

    @field_validator("name", "address_line1", "city", "state", "postal_code", "phone")
    @classmethod
    def _not_null(cls, value: str | None) -> str | None:
        if value is None:
            raise ValueError("cannot be cleared")
        return value

    @field_validator("name", "address_line1", "city", "state")
    @classmethod
    def _required(cls, value: str) -> str:
        return clean_required(value)

    @field_validator("phone")
    @classmethod
    def _valid_phone(cls, value: str) -> str | None:
        return _phone(value)

    @field_validator("postal_code")
    @classmethod
    def _pin(cls, value: str) -> str:
        value = value.strip()
        if not _PIN.fullmatch(value):
            raise ValueError("enter a valid 6-digit PIN code")
        return value

    def changes(self) -> dict[str, Any]:
        return {name: getattr(self, name) for name in self.model_fields_set}


class ClinicResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    phone: str
    email: str | None
    address_line1: str
    address_line2: str | None
    locality: str | None
    city: str
    state: str
    postal_code: str
    latitude: Decimal | None
    longitude: Decimal | None
    area_key: AreaKey | None
    timezone: str
    emergency_services: bool
    verification_status: VerificationStatus
    verified_at: UtcDatetime | None
    status: ActiveStatus
    my_roles: list[MemberRole]
    created_at: UtcDatetime
    updated_at: UtcDatetime
