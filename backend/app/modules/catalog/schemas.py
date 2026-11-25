from __future__ import annotations

import uuid
from datetime import date, time
from typing import Annotated, Any, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

from app.core.text import clean_required, clean_text
from app.core.types import UtcDatetime
from app.modules.catalog.models import ConfirmationMode, ExceptionKind, ServiceCategory, ServiceMode

Species = Literal["dog", "cat", "other"]


def _on_grid(value: time) -> time:
    if value.second or value.microsecond or value.minute % 5:
        raise ValueError("times must be on 5-minute boundaries")
    return value


class _ServiceFields(BaseModel):
    model_config = ConfigDict(extra="forbid")

    description: Annotated[str, StringConstraints(max_length=500)] | None = None
    species: list[Species] | None = Field(default=None, min_length=1, max_length=3)
    active: bool | None = None

    @field_validator("description")
    @classmethod
    def _desc(cls, value: str | None) -> str | None:
        return clean_text(value)

    @field_validator("species")
    @classmethod
    def _species(cls, value: list[str] | None) -> list[str] | None:
        return sorted(set(value)) if value is not None else None


class ServiceCreate(_ServiceFields):
    category: ServiceCategory
    title: Annotated[str, StringConstraints(min_length=2, max_length=80)]
    price_minor: int = Field(ge=0, le=10_000_000, description="Price in paise (₹1 = 100)")
    duration_minutes: int = Field(ge=5, le=480, multiple_of=5)
    service_mode: ServiceMode
    confirmation_mode: ConfirmationMode | None = Field(
        default=None,
        description="Defaults: in_clinic → instant, home_visit → request (decision 0004)",
    )

    @field_validator("title")
    @classmethod
    def _title(cls, value: str) -> str:
        return clean_required(value)


class ServiceUpdate(_ServiceFields):
    category: ServiceCategory | None = None
    title: Annotated[str, StringConstraints(min_length=2, max_length=80)] | None = None
    price_minor: int | None = Field(default=None, ge=0, le=10_000_000)
    duration_minutes: int | None = Field(default=None, ge=5, le=480, multiple_of=5)
    service_mode: ServiceMode | None = None
    confirmation_mode: ConfirmationMode | None = None

    @field_validator("title")
    @classmethod
    def _title(cls, value: str | None) -> str | None:
        return clean_required(value) if value is not None else None

    @model_validator(mode="after")
    def _no_null_required(self) -> ServiceUpdate:
        for name in (
            "category",
            "title",
            "price_minor",
            "duration_minutes",
            "service_mode",
            "confirmation_mode",
            "species",
            "active",
        ):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} cannot be cleared")
        return self

    def changes(self) -> dict[str, Any]:
        return {name: getattr(self, name) for name in self.model_fields_set}


class ServiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    category: ServiceCategory
    title: str
    description: str | None
    price_minor: int
    currency: str
    duration_minutes: int
    service_mode: ServiceMode
    confirmation_mode: ConfirmationMode
    species: list[Species]
    active: bool
    created_at: UtcDatetime
    updated_at: UtcDatetime


class RuleIn(BaseModel):
    weekday: int = Field(ge=0, le=6, description="0 = Monday … 6 = Sunday")
    start_time: time
    end_time: time
    capacity: int = Field(default=1, ge=1, le=20)

    @field_validator("start_time", "end_time")
    @classmethod
    def _grid(cls, value: time) -> time:
        return _on_grid(value)

    @model_validator(mode="after")
    def _order(self) -> RuleIn:
        if self.start_time >= self.end_time:
            raise ValueError("start_time must be before end_time")
        return self


class WeeklyHours(BaseModel):
    rules: list[RuleIn] = Field(max_length=42)


class RuleOut(RuleIn):
    model_config = ConfigDict(from_attributes=True)


class WeeklyHoursResponse(BaseModel):
    timezone: str
    rules: list[RuleOut]


class ExceptionIn(BaseModel):
    on_date: date
    kind: ExceptionKind
    start_time: time | None = None
    end_time: time | None = None
    capacity: int | None = Field(default=None, ge=1, le=20)
    note: Annotated[str, StringConstraints(max_length=120)] | None = None

    @field_validator("note")
    @classmethod
    def _note(cls, value: str | None) -> str | None:
        return clean_text(value)

    @field_validator("start_time", "end_time")
    @classmethod
    def _grid(cls, value: time | None) -> time | None:
        return _on_grid(value) if value is not None else None

    @model_validator(mode="after")
    def _shape(self) -> ExceptionIn:
        if self.kind is ExceptionKind.CLOSED:
            self.start_time = self.end_time = self.capacity = None
        else:
            if self.start_time is None or self.end_time is None or self.start_time >= self.end_time:
                raise ValueError("special hours need a start time before the end time")
            self.capacity = self.capacity or 1
        return self


class ExceptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    on_date: date
    kind: ExceptionKind
    start_time: time | None
    end_time: time | None
    capacity: int | None
    note: str | None


class SlotOut(BaseModel):
    start: UtcDatetime
    end: UtcDatetime
    local_start: str = Field(description="HH:MM in the owner's timezone")
    capacity: int


class SlotPreview(BaseModel):
    date: date
    timezone: str
    service_id: uuid.UUID
    slots: list[SlotOut]
