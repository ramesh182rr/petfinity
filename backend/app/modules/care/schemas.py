from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
)

from app.core.text import clean_text
from app.core.types import UtcDatetime
from app.modules.care.models import CareOfferStatus, CareRequestStatus, CareType
from app.modules.discovery.areas import AreaKey

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


# ---------------------------------------------------------------- requests and offers (3.2-3.3)

Lat = Annotated[Decimal, Field(ge=-90, le=90, max_digits=9, decimal_places=6)]
Lng = Annotated[Decimal, Field(ge=-180, le=180, max_digits=9, decimal_places=6)]


class CareRequestIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    care_type: CareType
    pet_ids: list[uuid.UUID] = Field(min_length=1, max_length=5)
    start_at: AwareDatetime = Field(description="Drop-off / first visit / check-in")
    end_at: AwareDatetime = Field(description="Pick-up / last visit day / check-out")
    visits_per_day: int | None = Field(
        default=None, ge=1, le=3, description="Home visits only (required for them)"
    )
    area_key: AreaKey
    locality: Annotated[str, StringConstraints(min_length=2, max_length=100)]
    latitude: Lat | None = None
    longitude: Lng | None = None
    address: Annotated[str, StringConstraints(max_length=300)] | None = Field(
        default=None,
        description="Home visits and house sitting. Shared only with the caretaker you book.",
    )
    notes: Annotated[str, StringConstraints(max_length=1000)] | None = None
    budget_minor: int | None = Field(default=None, ge=0, le=20_000_000)

    @field_validator("locality", "address", "notes")
    @classmethod
    def _text(cls, value: str | None) -> str | None:
        return clean_text(value)

    @field_validator("pet_ids")
    @classmethod
    def _unique_pets(cls, value: list[uuid.UUID]) -> list[uuid.UUID]:
        return list(dict.fromkeys(value))


class CarePetOut(BaseModel):
    id: uuid.UUID
    name: str
    species: str
    breed: str | None
    sex: str
    age_years: int | None
    weight_kg: float | None
    neutered: bool | None
    temperament: str | None


class OfferCaretaker(BaseModel):
    """What a parent sees when comparing offers (no address, no pin, no contact)."""

    id: uuid.UUID
    display_name: str
    years_experience: int | None
    languages: list[str]
    bio: str | None
    area_name: str | None
    verified_at: UtcDatetime | None
    rating: float | None
    review_count: int
    completed_care: int = Field(description="Completed care bookings on Petfinity")
    home_type: str | None
    outdoor_space: bool | None
    pets_at_home: str | None
    rate_minor: int | None = Field(description="Their starting rate for this care type")


class CareOfferOut(BaseModel):
    id: uuid.UUID
    status: CareOfferStatus
    price_minor: int
    message: str | None
    created_at: UtcDatetime
    updated_at: UtcDatetime
    caretaker: OfferCaretaker


class CareRequestOut(BaseModel):
    """The parent's own view."""

    id: uuid.UUID
    care_type: CareType
    status: CareRequestStatus
    start_at: UtcDatetime
    end_at: UtcDatetime
    visits_per_day: int | None
    units: int
    unit: Literal["visit", "day", "night"]
    pets: list[CarePetOut]
    area_key: str
    area_name: str | None
    locality: str
    address: str | None
    latitude: float | None
    longitude: float | None
    notes: str | None
    budget_minor: int | None
    offers_close_at: UtcDatetime
    accepting_offers: bool
    offer_count: int
    offers: list[CareOfferOut]
    booking_id: uuid.UUID | None
    created_at: UtcDatetime


class CareRequestList(BaseModel):
    items: list[CareRequestOut]


class MyOffer(BaseModel):
    id: uuid.UUID
    status: CareOfferStatus
    price_minor: int
    message: str | None
    updated_at: UtcDatetime


class CareRequestForCaretaker(BaseModel):
    """A caretaker's view: the area, never the address, pin or the parent's name."""

    id: uuid.UUID
    care_type: CareType
    status: CareRequestStatus
    start_at: UtcDatetime
    end_at: UtcDatetime
    visits_per_day: int | None
    units: int
    unit: Literal["visit", "day", "night"]
    pets: list[CarePetOut]
    area_name: str | None
    locality: str
    distance_km: int = Field(description="Rounded to whole km, at least 1")
    notes: str | None
    budget_minor: int | None
    offers_close_at: UtcDatetime
    accepting_offers: bool
    offer_count: int
    suggested_price_minor: int | None = Field(description="Your starting rate times the units")
    my_offer: MyOffer | None
    booking_id: uuid.UUID | None = Field(description="Set when your offer was accepted")


class CareRequestFeed(BaseModel):
    items: list[CareRequestForCaretaker]


class OfferIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    price_minor: int = Field(ge=0, le=20_000_000, description="Total for the whole request")
    message: Annotated[str, StringConstraints(max_length=500)] | None = None

    @field_validator("message")
    @classmethod
    def _text(cls, value: str | None) -> str | None:
        return clean_text(value)
