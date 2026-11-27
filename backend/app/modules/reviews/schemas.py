from __future__ import annotations

import uuid
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.core.text import clean_text
from app.core.types import UtcDatetime
from app.modules.reviews.models import ReportReason, ReviewStatus

ReviewText = Annotated[str, StringConstraints(max_length=1000)]


def _clean(value: str | None) -> str | None:
    return clean_text(value)


class ReviewCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rating: int = Field(ge=1, le=5)
    text: ReviewText | None = None

    _text = field_validator("text")(classmethod(lambda cls, v: _clean(v)))


class ReviewUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rating: int | None = Field(default=None, ge=1, le=5)
    text: ReviewText | None = None

    _text = field_validator("text")(classmethod(lambda cls, v: _clean(v)))


class ReplyIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: Annotated[str, StringConstraints(min_length=2, max_length=600)]

    _text = field_validator("text")(classmethod(lambda cls, v: _clean(v)))


class ReportIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: ReportReason
    note: Annotated[str, StringConstraints(max_length=300)] | None = None

    _note = field_validator("note")(classmethod(lambda cls, v: _clean(v)))


class ModerationIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Literal["keep", "remove"]
    note: Annotated[str, StringConstraints(max_length=300)] | None = Field(
        default=None, description="Shown to the author when a review is removed"
    )

    _note = field_validator("note")(classmethod(lambda cls, v: _clean(v)))


class ReplyOut(BaseModel):
    text: str
    replied_at: UtcDatetime


class PublicReview(BaseModel):
    """What any signed-in user sees: no author account details beyond a short name."""

    id: uuid.UUID
    rating: int
    text: str | None
    author_name: str = Field(description='e.g. "Arun K."')
    pets: str | None = Field(description='Species seen, e.g. "Dog"')
    service_title: str
    created_at: UtcDatetime
    edited: bool
    reply: ReplyOut | None
    is_mine: bool = Field(default=False, description="Written by the signed-in user")


class ReviewSummary(BaseModel):
    rating: float | None = Field(description="Average of published reviews, 1 decimal")
    review_count: int


class ReviewPage(BaseModel):
    summary: ReviewSummary
    items: list[PublicReview]
    next_before: UtcDatetime | None


class MyReview(BaseModel):
    """The author's own view (also embedded in their booking)."""

    id: uuid.UUID
    booking_id: uuid.UUID
    rating: int
    text: str | None
    status: ReviewStatus
    status_note: str | None = Field(description="Why it's hidden or was removed")
    can_edit: bool
    edit_until: UtcDatetime
    created_at: UtcDatetime
    edited: bool
    reply: ReplyOut | None


class ProviderReview(PublicReview):
    status: ReviewStatus
    can_reply: bool


class ProviderReviewPage(BaseModel):
    summary: ReviewSummary
    items: list[ProviderReview]


class ReportSummary(BaseModel):
    reason: ReportReason
    note: str | None
    created_at: UtcDatetime


class AdminReview(BaseModel):
    id: uuid.UUID
    status: ReviewStatus
    rating: int
    text: str | None
    reply_text: str | None
    flag_reason: str | None
    listing_name: str
    author_name: str
    author_contact: str | None
    created_at: UtcDatetime
    updated_at: UtcDatetime
    reports: list[ReportSummary]
    moderation_note: str | None


class AdminReviewPage(BaseModel):
    items: list[AdminReview]
