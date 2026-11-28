from __future__ import annotations

import uuid
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.core.text import clean_text
from app.core.types import UtcDatetime
from app.modules.care.models import CareType

CareSpecies = Literal["dog", "cat", "other"]


class CareServiceIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    care_type: CareType
    rate_minor: int = Field(ge=0, le=5_000_000, description="Paise per visit / day / night")
    species: list[CareSpecies] = Field(min_length=1, max_length=3)
    max_pets: int = Field(default=2, ge=1, le=10, description="Pets in one booking")
    notes: Annotated[str, StringConstraints(max_length=300)] | None = None
    active: bool = True

    @field_validator("species")
    @classmethod
    def _unique(cls, value: list[str]) -> list[str]:
        return list(dict.fromkeys(value))

    @field_validator("notes")
    @classmethod
    def _text(cls, value: str | None) -> str | None:
        return clean_text(value)


class CareServicesIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    services: list[CareServiceIn] = Field(max_length=4)


class CareServiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    care_type: CareType
    rate_minor: int
    rate_unit: Literal["visit", "day", "night"]
    species: list[str]
    max_pets: int
    notes: str | None
    active: bool
    updated_at: UtcDatetime


ReadinessItem = Literal["services", "service_area", "home_details", "capacity", "verification"]


class CareWorkspace(BaseModel):
    services: list[CareServiceOut]
    missing: list[ReadinessItem] = Field(
        description="What still stops this caretaker from receiving requests"
    )
    receiving_requests: bool
