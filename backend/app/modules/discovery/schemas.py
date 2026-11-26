"""Public discovery shapes (milestone 2.5).

These are what any signed-in pet parent sees, so they deliberately leave out
contact details, verification documents, registration numbers, capacity and a
home-visit vet's base coordinates (doc 13, decision 0011).
"""

from __future__ import annotations

import uuid
from datetime import date, time
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field

from app.core.types import UtcDatetime
from app.modules.catalog.models import ConfirmationMode, ServiceCategory, ServiceMode
from app.modules.discovery.areas import AreaKey


class ListingKind(StrEnum):
    CLINIC = "clinic"
    VET = "vet"


class KindFilter(StrEnum):
    ALL = "all"
    CLINIC = "clinic"
    VET = "vet"


class SortOrder(StrEnum):
    DISTANCE = "distance"
    PRICE = "price"


class AreaOut(BaseModel):
    key: AreaKey
    name: str
    state: str
    latitude: float
    longitude: float


class AreasResponse(BaseModel):
    areas: list[AreaOut]
    default_radius_km: int
    max_radius_km: int
    service_radius_choices_km: list[int]


class Origin(BaseModel):
    """Where distances are measured from: a launch area's centre or the device."""

    latitude: float
    longitude: float
    area_key: AreaKey | None
    label: str


class Listing(BaseModel):
    kind: ListingKind
    id: uuid.UUID
    name: str
    subtitle: str | None = Field(description="Clinic locality or a vet's qualifications")
    area_name: str | None
    distance_km: float | None = Field(
        description="Clinics only. Never set for home-visit vets, whose base is private."
    )
    distance_is_approximate: bool = Field(
        description="True when the clinic has no exact pin and its area centre was used"
    )
    service_radius_km: int | None = Field(description="Home-visit vets: how far they travel")
    verified_at: UtcDatetime | None
    emergency: bool
    modes: list[ServiceMode]
    categories: list[ServiceCategory]
    price_from_minor: int | None
    service_count: int
    open_now: bool
    next_slot_at: UtcDatetime | None = Field(description="Earliest bookable slot within 7 days")
    languages: list[str]
    years_experience: int | None


class SearchResponse(BaseModel):
    items: list[Listing]
    total: int
    origin: Origin
    radius_km: int


class PublicService(BaseModel):
    id: uuid.UUID
    category: ServiceCategory
    title: str
    description: str | None
    price_minor: int
    currency: Literal["INR"]
    duration_minutes: int
    service_mode: ServiceMode
    confirmation_mode: ConfirmationMode
    species: list[str]


class HoursRange(BaseModel):
    start_time: time
    end_time: time


class DayHours(BaseModel):
    weekday: int = Field(ge=0, le=6, description="0 = Monday")
    ranges: list[HoursRange]


class Closure(BaseModel):
    on_date: date
    kind: Literal["closed", "custom_hours"]
    start_time: time | None
    end_time: time | None


class Badge(BaseModel):
    verified_at: UtcDatetime | None
    checks: list[str] = Field(description="What Petfinity checked before verifying, in plain words")


class DoctorOut(BaseModel):
    id: uuid.UUID
    display_name: str
    qualifications: str | None
    years_experience: int | None
    languages: list[str]


class ClinicRef(BaseModel):
    id: uuid.UUID
    name: str
    locality: str | None
    city: str


class _Detail(BaseModel):
    id: uuid.UUID
    area_name: str | None
    timezone: str
    badge: Badge
    open_now: bool
    hours: list[DayHours]
    closures: list[Closure] = Field(description="Days off and special hours, next 14 days")
    services: list[PublicService]


class ClinicDetail(_Detail):
    name: str
    description: str | None
    address_line1: str
    address_line2: str | None
    locality: str | None
    city: str
    state: str
    postal_code: str
    latitude: float | None
    longitude: float | None
    distance_km: float | None
    distance_is_approximate: bool
    emergency_services: bool
    doctors: list[DoctorOut]


class VetDetail(_Detail):
    display_name: str
    bio: str | None
    qualifications: str | None
    years_experience: int | None
    languages: list[str]
    service_radius_km: int
    visits_you: bool | None = Field(
        description="Whether the search origin is inside the vet's home-visit radius "
        "(null when no origin was given)"
    )
    clinics: list[ClinicRef]


class PublicSlot(BaseModel):
    start: UtcDatetime
    end: UtcDatetime
    local_start: str = Field(description="HH:MM in the listing's timezone")


class PublicSlots(BaseModel):
    date: date
    timezone: str
    service_id: uuid.UUID
    slots: list[PublicSlot]
