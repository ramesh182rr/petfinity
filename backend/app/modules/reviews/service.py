"""Reviews (milestone 2.10, decision 0014).

- Only the pet parent of a `completed` booking, within 30 days of the visit, one per booking.
- Published at once; the automatic check or any report holds it (`pending`) for a moderator.
- The provider can post one public reply (editable); the author can edit within the window.
"""

from __future__ import annotations

import uuid
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import ColumnElement, func, select
from sqlalchemy import update as sql_update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import clock
from app.core.errors import AppError
from app.modules.audit import service as audit
from app.modules.bookings.models import Booking, BookingPet, BookingStatus
from app.modules.clinics import service as clinics
from app.modules.clinics.models import Clinic, ClinicMember, MemberRole
from app.modules.notifications.service import notify
from app.modules.pets.models import Pet
from app.modules.providers.models import ProviderProfile
from app.modules.reviews.models import Review, ReviewReport, ReviewStatus
from app.modules.reviews.schemas import ReportIn, ReviewCreate, ReviewUpdate
from app.modules.reviews.screening import flag_reason
from app.modules.users.models import User

REVIEW_WINDOW = timedelta(days=30)
PAGE_SIZE = 20

STATUS_NOTES = {
    "contact_details": "Hidden while we check it: reviews can't include phone numbers or emails.",
    "link": "Hidden while we check it: reviews can't include links.",
    "language": "Hidden while we check the wording.",
    "reported": "Hidden while our team looks at a report.",
}


def _not_found() -> AppError:
    return AppError("not_found", "We couldn't find that review.", status_code=404)


def window_end(booking: Booking) -> datetime:
    return booking.end_at + REVIEW_WINDOW


def short_name(user: User | None) -> str:
    """'Arun Kumar' → 'Arun K.'; never an email or phone."""
    name = (user.display_name or "").strip() if user else ""
    if not name:
        return "Pet parent"
    parts = name.split()
    return parts[0] if len(parts) == 1 else f"{parts[0]} {parts[-1][0].upper()}."


# ---------------------------------------------------------------- who manages the listing


def provider_user_ids(db: Session, review: Review | Booking) -> list[uuid.UUID]:
    if review.clinic_id is not None:
        return list(
            db.scalars(
                select(ClinicMember.user_id).where(
                    ClinicMember.clinic_id == review.clinic_id,
                    ClinicMember.member_role == MemberRole.OPERATOR,
                    ClinicMember.removed_at.is_(None),
                )
            )
        )
    profile = db.get(ProviderProfile, review.provider_profile_id)
    return [profile.user_id] if profile else []


def manages(db: Session, user_id: uuid.UUID, review: Review) -> bool:
    if review.clinic_id is not None:
        roles = clinics.roles_by_clinic(db, user_id).get(review.clinic_id, [])
        return MemberRole.OPERATOR in roles
    profile = db.get(ProviderProfile, review.provider_profile_id)
    return profile is not None and profile.user_id == user_id


def listing_name(db: Session, review: Review | Booking) -> str:
    if review.clinic_id is not None:
        clinic = db.get(Clinic, review.clinic_id)
        return clinic.name if clinic else "the clinic"
    profile = db.get(ProviderProfile, review.provider_profile_id)
    return profile.display_name if profile else "your vet"


def _manage_route(review: Review) -> str:
    if review.clinic_id is not None:
        return f"/provider/manage/clinic/{review.clinic_id}/reviews"
    return f"/provider/manage/provider_profile/{review.provider_profile_id}/reviews"


# ---------------------------------------------------------------- write


def create(db: Session, user_id: uuid.UUID, booking_id: uuid.UUID, data: ReviewCreate) -> Review:
    booking = db.scalars(select(Booking).where(Booking.id == booking_id).with_for_update()).first()
    if booking is None or booking.owner_id != user_id:
        raise AppError("not_found", "We couldn't find that booking.", status_code=404)
    if booking.status != BookingStatus.COMPLETED:
        raise AppError(
            "not_reviewable", "You can review a visit once it's completed.", status_code=409
        )
    if clock.utcnow() > window_end(booking):
        raise AppError(
            "review_window_closed",
            "Reviews can be written up to 30 days after the visit.",
            status_code=409,
        )
    reason = flag_reason(data.text)
    review = Review(
        booking_id=booking.id,
        author_id=user_id,
        clinic_id=booking.clinic_id,
        provider_profile_id=booking.provider_profile_id,
        rating=data.rating,
        text=data.text,
        status=ReviewStatus.PENDING if reason else ReviewStatus.PUBLISHED,
        flag_reason=reason,
    )
    try:
        with db.begin_nested():
            db.add(review)
            db.flush()
    except IntegrityError as exc:
        raise AppError(
            "already_reviewed", "You've already reviewed this visit.", status_code=409
        ) from exc
    if review.status == ReviewStatus.PUBLISHED:
        _tell_providers_new(db, review, booking)
    return review


def _tell_providers_new(db: Session, review: Review, booking: Booking) -> None:
    author = short_name(db.get(User, review.author_id))
    stars = "★" * review.rating
    for provider in provider_user_ids(db, booking):
        notify(
            db,
            provider,
            "review_new",
            f"New {review.rating}-star review {stars}",
            f"{author} reviewed {booking.service_title}."
            + (f" “{review.text[:80]}”" if review.text else ""),
            {"route": _manage_route(review), "review_id": str(review.id)},
            dedupe_key=f"review:{review.id}:new",
        )


def update(db: Session, user_id: uuid.UUID, review_id: uuid.UUID, data: ReviewUpdate) -> Review:
    review = _locked(db, review_id)
    if review.author_id != user_id:
        raise _not_found()
    booking = db.get(Booking, review.booking_id)
    if review.status == ReviewStatus.REMOVED:
        raise AppError("review_removed", "This review was removed.", status_code=409)
    if booking is None or clock.utcnow() > window_end(booking):
        raise AppError(
            "review_window_closed",
            "Reviews can be edited up to 30 days after the visit.",
            status_code=409,
        )
    changes = data.model_dump(exclude_unset=True)
    if "rating" in changes and changes["rating"] is None:
        changes.pop("rating")
    for field, value in changes.items():
        setattr(review, field, value)
    review.edited_at = clock.utcnow()
    was_published = review.status == ReviewStatus.PUBLISHED
    reason = flag_reason(review.text)
    if reason:
        review.status, review.flag_reason = ReviewStatus.PENDING, reason
    elif review.status == ReviewStatus.PENDING and review.flag_reason != "reported":
        review.status, review.flag_reason = ReviewStatus.PUBLISHED, None
    db.flush()
    if not was_published and review.status == ReviewStatus.PUBLISHED and booking is not None:
        _tell_providers_new(db, review, booking)
    return review


def report(db: Session, user_id: uuid.UUID, review_id: uuid.UUID, data: ReportIn) -> None:
    """Idempotent per person. The first report hides a published review for moderation."""
    review = _locked(db, review_id)
    if review.status == ReviewStatus.REMOVED:
        raise _not_found()
    if review.author_id == user_id:
        raise AppError("own_review", "You can't report your own review.", status_code=422)
    try:
        with db.begin_nested():
            db.add(
                ReviewReport(
                    review_id=review.id, reporter_id=user_id, reason=data.reason, note=data.note
                )
            )
            db.flush()
    except IntegrityError:
        return  # already reported by this person
    if review.status == ReviewStatus.PUBLISHED:
        review.status, review.flag_reason = ReviewStatus.PENDING, "reported"
    db.flush()


def reply(db: Session, user_id: uuid.UUID, review_id: uuid.UUID, text: str) -> Review:
    review = _locked(db, review_id)
    if review.status == ReviewStatus.REMOVED or not manages(db, user_id, review):
        raise _not_found()
    if flag_reason(text):
        raise AppError(
            "reply_not_allowed",
            "Replies can't include phone numbers, emails, links or abusive words.",
            status_code=422,
        )
    first = review.reply_text is None
    review.reply_text, review.replied_at, review.replied_by = text, clock.utcnow(), user_id
    db.flush()
    if first:
        notify(
            db,
            review.author_id,
            "review_reply",
            f"{listing_name(db, review)} replied to your review",
            f"“{text[:100]}”",
            {"route": f"/bookings/{review.booking_id}", "review_id": str(review.id)},
        )
    return review


def moderate(
    db: Session, moderator_id: uuid.UUID, review_id: uuid.UUID, action: str, note: str | None
) -> Review:
    review = _locked(db, review_id)
    if review.status == ReviewStatus.REMOVED:
        raise AppError("already_removed", "This review was already removed.", status_code=409)
    now = clock.utcnow()
    review.status = ReviewStatus.PUBLISHED if action == "keep" else ReviewStatus.REMOVED
    if action == "keep":
        review.flag_reason = None
    review.moderated_by, review.moderated_at, review.moderation_note = moderator_id, now, note
    db.execute(
        sql_update(ReviewReport)
        .where(ReviewReport.review_id == review.id, ReviewReport.resolved_at.is_(None))
        .values(resolved_at=now)
    )
    audit.record(
        db,
        f"review.{'kept' if action == 'keep' else 'removed'}",
        actor_user_id=moderator_id,
        target_type="review",
        target_id=review.id,
        details={"note": note or ""},
    )
    if action == "remove":
        notify(
            db,
            review.author_id,
            "review_removed",
            "Your review was removed",
            note or "It didn't meet our review guidelines.",
            {"route": f"/bookings/{review.booking_id}", "review_id": str(review.id)},
        )
    db.flush()
    return review


def _locked(db: Session, review_id: uuid.UUID) -> Review:
    review = db.scalars(select(Review).where(Review.id == review_id).with_for_update()).first()
    if review is None:
        raise _not_found()
    return review


# ---------------------------------------------------------------- read


@dataclass(frozen=True)
class Summary:
    rating: float | None
    count: int


def summaries(db: Session, listing_ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, Summary]:
    if not listing_ids:
        return {}
    owner = func.coalesce(Review.clinic_id, Review.provider_profile_id)
    rows = db.execute(
        select(owner, func.avg(Review.rating), func.count())
        .where(owner.in_(listing_ids), Review.status == ReviewStatus.PUBLISHED)
        .group_by(owner)
    )
    return {lid: Summary(round(float(avg), 1), int(n)) for lid, avg, n in rows}


def summary(db: Session, listing_id: uuid.UUID) -> Summary:
    return summaries(db, [listing_id]).get(listing_id, Summary(None, 0))


def _listing_filter(listing_id: uuid.UUID) -> ColumnElement[bool]:
    return func.coalesce(Review.clinic_id, Review.provider_profile_id) == listing_id


def published_for(
    db: Session, listing_id: uuid.UUID, *, before: datetime | None, limit: int
) -> list[Review]:
    query = select(Review).where(
        _listing_filter(listing_id), Review.status == ReviewStatus.PUBLISHED
    )
    if before is not None:
        query = query.where(Review.created_at < before)
    return list(db.scalars(query.order_by(Review.created_at.desc(), Review.id).limit(limit)))


def for_provider(db: Session, listing_id: uuid.UUID) -> list[Review]:
    return list(
        db.scalars(
            select(Review)
            .where(_listing_filter(listing_id), Review.status != ReviewStatus.REMOVED)
            .order_by(Review.created_at.desc())
            .limit(200)
        )
    )


def by_booking(db: Session, booking_ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, Review]:
    if not booking_ids:
        return {}
    return {
        r.booking_id: r
        for r in db.scalars(select(Review).where(Review.booking_id.in_(booking_ids)))
    }


def context(
    db: Session, reviews: Sequence[Review]
) -> tuple[dict[uuid.UUID, str], dict[uuid.UUID, str], dict[uuid.UUID, str]]:
    """(author short names, pet species by booking, service titles by booking)."""
    authors = {
        u.id: short_name(u)
        for u in db.scalars(select(User).where(User.id.in_({r.author_id for r in reviews})))
    }
    booking_ids = [r.booking_id for r in reviews]
    species: dict[uuid.UUID, list[str]] = defaultdict(list)
    for booking_id, kind in db.execute(
        select(BookingPet.booking_id, Pet.species)
        .join(Pet, Pet.id == BookingPet.pet_id)
        .where(BookingPet.booking_id.in_(booking_ids))
    ):
        species[booking_id].append(kind.replace("_", " ").capitalize())
    titles = dict(
        db.execute(
            select(Booking.id, Booking.service_title).where(Booking.id.in_(booking_ids))
        ).all()
    )
    return authors, {k: ", ".join(sorted(set(v))) for k, v in species.items()}, titles


def admin_queue(db: Session, status: ReviewStatus) -> list[Review]:
    return list(
        db.scalars(
            select(Review)
            .where(Review.status == status)
            .order_by(Review.updated_at.desc())
            .limit(100)
        )
    )


def reports_for(
    db: Session, review_ids: Sequence[uuid.UUID]
) -> dict[uuid.UUID, list[ReviewReport]]:
    grouped: dict[uuid.UUID, list[ReviewReport]] = defaultdict(list)
    if review_ids:
        for row in db.scalars(
            select(ReviewReport)
            .where(ReviewReport.review_id.in_(review_ids))
            .order_by(ReviewReport.created_at)
        ):
            grouped[row.review_id].append(row)
    return grouped
