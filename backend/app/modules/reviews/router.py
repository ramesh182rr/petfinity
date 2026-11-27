"""Review API (milestone 2.10, decision 0014)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession, ModeratorUser
from app.core import clock
from app.core.errors import AppError, error_responses
from app.modules.bookings.models import Booking
from app.modules.catalog.router import ManagedOwner
from app.modules.discovery import service as discovery
from app.modules.discovery.schemas import ListingKind
from app.modules.notifications.router import push_after_response
from app.modules.reviews import service as reviews
from app.modules.reviews.models import Review, ReviewStatus
from app.modules.reviews.present import public_reviews, reply_of
from app.modules.reviews.schemas import (
    AdminReview,
    AdminReviewPage,
    ModerationIn,
    MyReview,
    ProviderReview,
    ProviderReviewPage,
    ReplyIn,
    ReportIn,
    ReportSummary,
    ReviewCreate,
    ReviewPage,
    ReviewSummary,
    ReviewUpdate,
)
from app.modules.users.models import User

router = APIRouter(tags=["reviews"], dependencies=[Depends(push_after_response)])
_ERRORS = error_responses(401, 403, 404, 409, 422)


def to_my_review(review: Review, booking: Booking) -> MyReview:
    end = reviews.window_end(booking)
    note = None
    if review.status == ReviewStatus.PENDING:
        note = reviews.STATUS_NOTES.get(review.flag_reason or "", reviews.STATUS_NOTES["reported"])
    elif review.status == ReviewStatus.REMOVED:
        note = review.moderation_note or "Removed: it didn't meet our review guidelines."
    return MyReview(
        id=review.id,
        booking_id=review.booking_id,
        rating=review.rating,
        text=review.text,
        status=review.status,
        status_note=note,
        can_edit=review.status != ReviewStatus.REMOVED and clock.utcnow() <= end,
        edit_until=end,
        created_at=review.created_at,
        edited=review.edited_at is not None,
        reply=reply_of(review),
    )


def _summary(db: DbSession, listing_id: uuid.UUID) -> ReviewSummary:
    s = reviews.summary(db, listing_id)
    return ReviewSummary(rating=s.rating, review_count=s.count)


def _author_booking(db: DbSession, user: User, booking_id: uuid.UUID) -> Booking:
    booking = db.get(Booking, booking_id)
    if booking is None or booking.owner_id != user.id:
        raise AppError("not_found", "We couldn't find that booking.", status_code=404)
    return booking


@router.post(
    "/bookings/{booking_id}/review",
    response_model=MyReview,
    status_code=status.HTTP_201_CREATED,
    responses=_ERRORS,
    summary="Review a completed visit (within 30 days; one per booking)",
)
def create_review(
    booking_id: uuid.UUID, data: ReviewCreate, db: DbSession, user: CurrentUser
) -> MyReview:
    review = reviews.create(db, user.id, booking_id, data)
    db.commit()
    return to_my_review(review, _author_booking(db, user, booking_id))


@router.get(
    "/bookings/{booking_id}/review",
    response_model=MyReview,
    responses=_ERRORS,
    summary="My review of this booking",
)
def my_review(booking_id: uuid.UUID, db: DbSession, user: CurrentUser) -> MyReview:
    booking = _author_booking(db, user, booking_id)
    review = reviews.by_booking(db, [booking.id]).get(booking.id)
    if review is None:
        raise AppError("not_found", "No review yet.", status_code=404)
    return to_my_review(review, booking)


@router.patch(
    "/reviews/{review_id}",
    response_model=MyReview,
    responses=_ERRORS,
    summary="Edit my review (within 30 days of the visit)",
)
def edit_review(
    review_id: uuid.UUID, data: ReviewUpdate, db: DbSession, user: CurrentUser
) -> MyReview:
    review = reviews.update(db, user.id, review_id, data)
    db.commit()
    return to_my_review(review, _author_booking(db, user, review.booking_id))


@router.post(
    "/reviews/{review_id}/report",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=_ERRORS,
    summary="Report a review (hides it until a moderator decides)",
)
def report_review(
    review_id: uuid.UUID, data: ReportIn, db: DbSession, user: CurrentUser
) -> Response:
    reviews.report(db, user.id, review_id, data)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put(
    "/reviews/{review_id}/reply",
    response_model=ProviderReview,
    responses=_ERRORS,
    summary="Provider's public reply (one per review; editable)",
)
def reply_review(
    review_id: uuid.UUID, data: ReplyIn, db: DbSession, user: CurrentUser
) -> ProviderReview:
    review = reviews.reply(db, user.id, review_id, data.text)
    db.commit()
    public = public_reviews(db, [review])[0]
    return ProviderReview(**public.model_dump(), status=review.status, can_reply=True)


@router.get(
    "/discover/{kind}/{listing_id}/reviews",
    response_model=ReviewPage,
    responses=_ERRORS,
    summary="Published reviews of a listed clinic or vet",
)
def listing_reviews(
    kind: Literal["clinics", "vets"],
    listing_id: uuid.UUID,
    db: DbSession,
    user: CurrentUser,
    before: datetime | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = reviews.PAGE_SIZE,
) -> ReviewPage:
    owner = discovery.public_owner(
        db, ListingKind.CLINIC if kind == "clinics" else ListingKind.VET, listing_id
    )
    items = reviews.published_for(db, owner.id, before=before, limit=limit)
    return ReviewPage(
        summary=_summary(db, owner.id),
        items=public_reviews(db, items, user.id),
        next_before=items[-1].created_at if len(items) == limit else None,
    )


@router.get(
    "/manage/{owner_type}/{owner_id}/reviews",
    response_model=ProviderReviewPage,
    responses=_ERRORS,
    summary="Provider: reviews of this listing, including ones hidden for moderation",
)
def provider_reviews(owner: ManagedOwner, db: DbSession) -> ProviderReviewPage:
    items = reviews.for_provider(db, owner.id)
    public = public_reviews(db, items)
    return ProviderReviewPage(
        summary=_summary(db, owner.id),
        items=[
            ProviderReview(
                **p.model_dump(),
                status=r.status,
                can_reply=r.status == ReviewStatus.PUBLISHED,
            )
            for p, r in zip(public, items, strict=True)
        ],
    )


# ---------------------------------------------------------------- moderation (staff)

admin_router = APIRouter(
    prefix="/admin/reviews", tags=["admin"], dependencies=[Depends(push_after_response)]
)


@admin_router.get(
    "", response_model=AdminReviewPage, responses=_ERRORS, summary="Review moderation queue"
)
def moderation_queue(
    db: DbSession, _: ModeratorUser, status: ReviewStatus = ReviewStatus.PENDING
) -> AdminReviewPage:
    items = reviews.admin_queue(db, status)
    reports = reviews.reports_for(db, [r.id for r in items])
    authors = {
        u.id: u for u in db.scalars(select(User).where(User.id.in_({r.author_id for r in items})))
    }
    return AdminReviewPage(
        items=[
            AdminReview(
                id=r.id,
                status=r.status,
                rating=r.rating,
                text=r.text,
                reply_text=r.reply_text,
                flag_reason=r.flag_reason,
                listing_name=reviews.listing_name(db, r),
                author_name=reviews.short_name(authors.get(r.author_id)),
                author_contact=(
                    (authors[r.author_id].email or authors[r.author_id].phone)
                    if r.author_id in authors
                    else None
                ),
                created_at=r.created_at,
                updated_at=r.updated_at,
                reports=[
                    ReportSummary(reason=rep.reason, note=rep.note, created_at=rep.created_at)
                    for rep in reports.get(r.id, [])
                ],
                moderation_note=r.moderation_note,
            )
            for r in items
        ]
    )


@admin_router.post(
    "/{review_id}/decision",
    response_model=AdminReviewPage,
    responses=_ERRORS,
    summary="Keep (publish) or remove a review",
)
def decide(
    review_id: uuid.UUID, data: ModerationIn, db: DbSession, user: ModeratorUser
) -> AdminReviewPage:
    reviews.moderate(db, user.id, review_id, data.action, data.note)
    db.commit()
    return moderation_queue(db, user, ReviewStatus.PENDING)
