"""Public review shapes, shared by the reviews and discovery modules (no router imports)."""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy.orm import Session

from app.modules.reviews import service as reviews
from app.modules.reviews.models import Review
from app.modules.reviews.schemas import PublicReview, ReplyOut


def reply_of(review: Review) -> ReplyOut | None:
    if review.reply_text and review.replied_at:
        return ReplyOut(text=review.reply_text, replied_at=review.replied_at)
    return None


def public_reviews(
    db: Session, items: Sequence[Review], viewer_id: uuid.UUID | None = None
) -> list[PublicReview]:
    if not items:
        return []
    authors, species, titles = reviews.context(db, items)
    return [
        PublicReview(
            id=r.id,
            rating=r.rating,
            text=r.text,
            author_name=authors.get(r.author_id, "Pet parent"),
            pets=species.get(r.booking_id),
            service_title=titles.get(r.booking_id, ""),
            created_at=r.created_at,
            edited=r.edited_at is not None,
            reply=reply_of(r),
            is_mine=r.author_id == viewer_id,
        )
        for r in items
    ]
