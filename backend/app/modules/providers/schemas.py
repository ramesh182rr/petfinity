from __future__ import annotations

import uuid
from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.core.text import clean_required, clean_text
from app.core.types import UtcDatetime
from app.modules.providers.models import ProviderType
from app.modules.verification.status import ActiveStatus, VerificationStatus

Lang = Annotated[str, StringConstraints(min_length=2, max_length=30)]

CREDENTIAL_FIELDS = ("registration_number", "registration_council", "qualifications")


class _ProfileFields(BaseModel):
    model_config = ConfigDict(extra="forbid")

    bio: Annotated[str, StringConstraints(max_length=1000)] | None = None
    years_experience: int | None = Field(default=None, ge=0, le=70)
    languages: list[Lang] | None = Field(default=None, max_length=10)
    city: Annotated[str, StringConstraints(max_length=80)] | None = None
    registration_number: Annotated[str, StringConstraints(max_length=50)] | None = None
    registration_council: Annotated[str, StringConstraints(max_length=120)] | None = None
    qualifications: Annotated[str, StringConstraints(max_length=200)] | None = None

    @field_validator("bio", "city", "registration_number", "registration_council", "qualifications")
    @classmethod
    def _text(cls, value: str | None) -> str | None:
        return clean_text(value)

    @field_validator("languages")
    @classmethod
    def _languages(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        seen: list[str] = []
        for item in value:
            cleaned = clean_required(item).title()
            if cleaned not in seen:
                seen.append(cleaned)
        return seen


class ProviderProfileCreate(_ProfileFields):
    provider_type: ProviderType
    display_name: Annotated[str, StringConstraints(min_length=2, max_length=80)]

    @field_validator("display_name")
    @classmethod
    def _name(cls, value: str) -> str:
        return clean_required(value)


class ProviderProfileUpdate(_ProfileFields):
    display_name: Annotated[str, StringConstraints(min_length=2, max_length=80)] | None = None

    @field_validator("display_name")
    @classmethod
    def _name(cls, value: str | None) -> str | None:
        if value is None:
            raise ValueError("display name cannot be cleared")
        return clean_required(value)

    def changes(self) -> dict[str, Any]:
        return {name: getattr(self, name) for name in self.model_fields_set}


class ProviderProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    provider_type: ProviderType
    display_name: str
    bio: str | None
    years_experience: int | None
    languages: list[str]
    city: str | None
    registration_number: str | None
    registration_council: str | None
    qualifications: str | None
    verification_status: VerificationStatus
    verified_at: UtcDatetime | None
    status: ActiveStatus
    created_at: UtcDatetime
    updated_at: UtcDatetime
