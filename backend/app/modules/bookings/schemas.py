"""Booking API shapes (milestone 2.6)."""

from __future__ import annotations

import uuid
from enum import StrEnum
from typing import Annotated, Any, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.core.text import clean_text
from app.core.types import UtcDatetime
from app.modules.bookings.models import BookingStatus, CancellationOutcome, PaymentStatus
from app.modules.catalog.models import ConfirmationMode, ServiceMode
from app.modules.discovery.schemas import ListingKind
from app.modules.reviews.schemas import MyReview

Note = Annotated[str, StringConstraints(max_length=500)]
Reason = Annotated[str, StringConstraints(max_length=300)]


class BookingAction(StrEnum):
    """What the current viewer may do next. The app shows buttons from this list."""

    CANCEL = "cancel"
    RESCHEDULE = "reschedule"
    PAY = "pay"
    PAY_AT_VISIT = "pay_at_visit"
    CONFIRM = "confirm"
    DECLINE = "decline"
    CHECK_IN = "check_in"
    COMPLETE = "complete"
    NO_SHOW = "no_show"
    REVIEW = "review"  # parent: rate a completed visit (within 30 days)


class ViewerRole(StrEnum):
    OWNER = "owner"
    PROVIDER = "provider"
    ADMIN = "admin"


class BookingCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    listing_kind: ListingKind
    listing_id: uuid.UUID
    service_id: uuid.UUID
    start_at: AwareDatetime = Field(description="A slot start from the open-times endpoint")
    pet_ids: list[uuid.UUID] = Field(
        min_length=1, max_length=1, description="One pet per vet appointment"
    )
    owner_notes: Note | None = None
    visit_address: Annotated[str, StringConstraints(max_length=300)] | None = Field(
        default=None,
        description="Required for home visits. Shared with the vet only once they confirm.",
    )

    @field_validator("owner_notes", "visit_address")
    @classmethod
    def _text(cls, value: str | None) -> str | None:
        return clean_text(value)


class RescheduleIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start_at: AwareDatetime


class ReasonIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: Reason | None = None

    @field_validator("reason")
    @classmethod
    def _text(cls, value: str | None) -> str | None:
        return clean_text(value)


class PaymentIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    method: Literal["pay_now", "pay_at_visit"] = Field(
        description="pay_now runs the MOCK payment adapter: nothing is ever charged"
    )


class ListingRef(BaseModel):
    kind: ListingKind
    id: uuid.UUID
    name: str
    locality: str | None


class BookingPetOut(BaseModel):
    id: uuid.UUID
    name: str
    species: str
    breed: str | None


class PolicyOut(BaseModel):
    free_cancellation_until: UtcDatetime
    free_cancellation_hours_before: int
    late_cancellation: str
    provider_cancellation: str


class BookingEventOut(BaseModel):
    event: str
    from_status: BookingStatus | None
    to_status: BookingStatus | None
    actor_role: str
    reason: str | None
    details: dict[str, Any] | None
    created_at: UtcDatetime


class PaymentOut(BaseModel):
    kind: Literal["charge", "refund"]
    amount_minor: int
    currency: str
    status: str
    reference: str
    provider: Literal["mock"]
    created_at: UtcDatetime


class BookingOut(BaseModel):
    id: uuid.UUID
    booking_type: str
    status: BookingStatus
    listing: ListingRef
    service_id: uuid.UUID | None
    service_title: str
    service_mode: ServiceMode
    confirmation_mode: ConfirmationMode
    start_at: UtcDatetime
    end_at: UtcDatetime
    timezone: str
    response_deadline: UtcDatetime | None
    amount_minor: int
    currency: str
    payment_status: PaymentStatus
    payment_is_mock: bool = Field(default=True, description="Always true in the MVP")
    pets: list[BookingPetOut]
    owner_name: str | None = Field(description="Shown to the provider only")
    owner_notes: str | None
    visit_address: str | None = Field(
        description="Home visits: hidden from the provider until the booking is confirmed"
    )
    policy: PolicyOut
    cancellation_outcome: CancellationOutcome | None
    cancel_reason: str | None
    review: MyReview | None = Field(
        default=None, description="The parent's review of this visit (parent view only)"
    )
    viewer_role: ViewerRole
    allowed_actions: list[BookingAction]
    created_at: UtcDatetime
    updated_at: UtcDatetime


class BookingDetail(BookingOut):
    events: list[BookingEventOut]
    payments: list[PaymentOut]


class BookingList(BaseModel):
    items: list[BookingOut]
