"""Care requests and offers (milestones 3.2-3.3, decision 0015).

Requests are open to nearby caretakers who could actually take them: verified and
active, offering that care type for those pets, within their travel radius, not on
a day off and with free capacity. A request stops taking offers after 24 hours or
5 offers; the parent can accept any pending offer until the start.
"""

from __future__ import annotations

import math
import uuid
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import clock
from app.core.errors import AppError
from app.modules.audit import service as audit
from app.modules.bookings import service as bookings
from app.modules.bookings.busy import busy_by_resource, free_unit
from app.modules.bookings.models import Booking, BookingStatus
from app.modules.care.models import (
    RATE_UNIT,
    CareOffer,
    CareOfferStatus,
    CareRequest,
    CareRequestPet,
    CareRequestStatus,
    CareService,
    CareType,
)
from app.modules.care.schemas import CareRequestIn, OfferIn
from app.modules.catalog.models import AvailabilityException, ExceptionKind
from app.modules.discovery.areas import AREAS, AreaKey, distance_km, resolve_area
from app.modules.pets.models import Pet
from app.modules.providers.models import ProviderProfile, ProviderType
from app.modules.verification.status import ActiveStatus, VerificationStatus

TZ = ZoneInfo("Asia/Kolkata")
OFFER_WINDOW = timedelta(hours=24)
MAX_OFFERS = 5
MIN_LEAD = timedelta(hours=3)
HORIZON = timedelta(days=60)
MAX_UNITS = 30  # days or nights
MAX_OPEN_PER_OWNER = 5
NEEDS_ADDRESS = {CareType.HOME_VISIT, CareType.HOUSE_SITTING}


def _not_found() -> AppError:
    return AppError("not_found", "We couldn't find that care request.", status_code=404)


def _local_dates(start: datetime, end: datetime) -> tuple[date, date]:
    return start.astimezone(TZ).date(), end.astimezone(TZ).date()


def units_for(care_type: str, start: datetime, end: datetime, visits: int | None) -> int:
    first, last = _local_dates(start, end)
    days = (last - first).days + 1
    if care_type == CareType.HOME_VISIT:
        return days * (visits or 1)
    if care_type == CareType.DAY_CARE:
        return days
    return max(1, (last - first).days)  # nights


def unit_of(care_type: str) -> str:
    return RATE_UNIT[CareType(care_type)]


def title_for(request: CareRequest) -> str:
    n = units_for(request.care_type, request.start_at, request.end_at, request.visits_per_day)
    unit = unit_of(request.care_type)
    label = {
        CareType.HOME_VISIT: "Home visits",
        CareType.DAY_CARE: "Day care",
        CareType.BOARDING: "Boarding",
        CareType.HOUSE_SITTING: "House sitting",
    }[CareType(request.care_type)]
    return f"{label} · {n} {unit}{'' if n == 1 else 's'}"


def pet_bucket(species: str) -> str:
    return species if species in ("dog", "cat") else "other"


def point_of(row: CareRequest | ProviderProfile) -> tuple[float, float]:
    if row.latitude is not None and row.longitude is not None:
        return float(row.latitude), float(row.longitude)
    area = AREAS[AreaKey(row.area_key)] if row.area_key in AREAS else None
    if area is None:
        raise ValueError("no location")
    return area.latitude, area.longitude


# ---------------------------------------------------------------- parent: create and manage


def create(db: Session, owner_id: uuid.UUID, data: CareRequestIn) -> CareRequest:
    now = clock.utcnow()
    care_type = CareType(data.care_type)
    start, end = data.start_at.astimezone(TZ), data.end_at.astimezone(TZ)
    if start < now + MIN_LEAD:
        raise AppError(
            "too_soon",
            "Requests need at least 3 hours' notice so caretakers can reply.",
            status_code=422,
        )
    if start > now + HORIZON:
        raise AppError("too_far", "Choose dates within the next 60 days.", status_code=422)
    if end <= start:
        raise AppError("invalid_dates", "The end must be after the start.", status_code=422)
    overnight = care_type in (CareType.BOARDING, CareType.HOUSE_SITTING)
    if overnight and end.date() <= start.date():
        raise AppError("invalid_dates", "Overnight care needs at least one night.", status_code=422)
    if not overnight and (end - start) > timedelta(days=MAX_UNITS):
        raise AppError("too_long", "Requests can cover up to 30 days.", status_code=422)
    if units_for(care_type, start, end, data.visits_per_day) > MAX_UNITS * 3:
        raise AppError("too_long", "Requests can cover up to 30 days.", status_code=422)
    if overnight and (end.date() - start.date()).days > MAX_UNITS:
        raise AppError("too_long", "Requests can cover up to 30 nights.", status_code=422)
    if care_type == CareType.HOME_VISIT and data.visits_per_day is None:
        raise AppError("visits_required", "Choose how many visits a day.", status_code=422)
    if care_type != CareType.HOME_VISIT and data.visits_per_day is not None:
        raise AppError(
            "visits_not_allowed", "Visits per day apply to home visits only.", status_code=422
        )
    if care_type in NEEDS_ADDRESS and not data.address:
        raise AppError("address_required", "Add the address where care happens.", status_code=422)
    if (data.latitude is None) != (data.longitude is None):
        raise AppError("validation_error", "Send latitude and longitude together.", status_code=422)
    resolve_area(data.area_key.value, data.latitude, data.longitude)  # pin must be in the area

    pets = list(
        db.scalars(
            select(Pet).where(
                Pet.id.in_(data.pet_ids), Pet.owner_id == owner_id, Pet.deleted_at.is_(None)
            )
        )
    )
    if len(pets) != len(data.pet_ids):
        raise AppError("pet_not_found", "Choose your own pets.", status_code=422)
    open_count = db.scalar(
        select(func.count())
        .select_from(CareRequest)
        .where(CareRequest.owner_id == owner_id, CareRequest.status == CareRequestStatus.OPEN)
    )
    if (open_count or 0) >= MAX_OPEN_PER_OWNER:
        raise AppError(
            "too_many_requests",
            "You have 5 open requests. Close one to post another.",
            status_code=422,
        )
    request = CareRequest(
        owner_id=owner_id,
        care_type=care_type,
        start_at=start,
        end_at=end,
        visits_per_day=data.visits_per_day,
        area_key=data.area_key.value,
        locality=data.locality,
        latitude=data.latitude,
        longitude=data.longitude,
        address=data.address,
        notes=data.notes,
        budget_minor=data.budget_minor,
        status=CareRequestStatus.OPEN,
        offers_close_at=min(now + OFFER_WINDOW, start - timedelta(hours=1)),
    )
    db.add(request)
    db.flush()
    db.add_all(CareRequestPet(request_id=request.id, pet_id=p.id) for p in pets)
    db.flush()
    return request


def _locked(db: Session, request_id: uuid.UUID) -> CareRequest:
    row = db.scalars(
        select(CareRequest).where(CareRequest.id == request_id).with_for_update()
    ).first()
    if row is None:
        raise _not_found()
    return row


def owned(
    db: Session, owner_id: uuid.UUID, request_id: uuid.UUID, *, lock: bool = False
) -> CareRequest:
    row = _locked(db, request_id) if lock else db.get(CareRequest, request_id)
    if row is None or row.owner_id != owner_id:
        raise _not_found()
    return row


def _decline_pending(
    db: Session, request_id: uuid.UUID, *, except_offer: uuid.UUID | None = None
) -> None:
    query = update(CareOffer).where(
        CareOffer.request_id == request_id, CareOffer.status == CareOfferStatus.PENDING
    )
    if except_offer is not None:
        query = query.where(CareOffer.id != except_offer)
    db.execute(query.values(status=CareOfferStatus.DECLINED))


def cancel(db: Session, owner_id: uuid.UUID, request_id: uuid.UUID) -> CareRequest:
    request = owned(db, owner_id, request_id, lock=True)
    if request.status != CareRequestStatus.OPEN:
        raise AppError(
            "request_closed",
            "This request is no longer open. Cancel the booking instead if one was made.",
            status_code=409,
        )
    request.status = CareRequestStatus.CANCELLED
    _decline_pending(db, request.id)
    db.flush()
    return request


def expire_due(db: Session, now: datetime, *, request_id: uuid.UUID | None = None) -> int:
    """Open requests that can no longer lead to a booking become expired."""
    pending = (
        select(func.count())
        .select_from(CareOffer)
        .where(CareOffer.request_id == CareRequest.id, CareOffer.status == CareOfferStatus.PENDING)
        .scalar_subquery()
    )
    query = select(CareRequest).where(
        CareRequest.status == CareRequestStatus.OPEN,
        (CareRequest.start_at <= now) | ((CareRequest.offers_close_at <= now) & (pending == 0)),
    )
    if request_id is not None:
        query = query.where(CareRequest.id == request_id)
    rows = list(db.scalars(query.with_for_update(skip_locked=True)))
    for row in rows:
        row.status = CareRequestStatus.EXPIRED
        _decline_pending(db, row.id)
    if rows:
        db.flush()
    return len(rows)


def accepting_offers(request: CareRequest, pending_count: int, now: datetime) -> bool:
    return (
        request.status == CareRequestStatus.OPEN
        and now < request.offers_close_at
        and pending_count < MAX_OFFERS
    )


def pending_counts(db: Session, request_ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, int]:
    if not request_ids:
        return {}
    rows = db.execute(
        select(CareOffer.request_id, func.count())
        .where(CareOffer.request_id.in_(request_ids), CareOffer.status == CareOfferStatus.PENDING)
        .group_by(CareOffer.request_id)
    )
    return {rid: int(n) for rid, n in rows}


def list_mine(db: Session, owner_id: uuid.UUID, scope: str) -> list[CareRequest]:
    expire_due(db, clock.utcnow())
    query = select(CareRequest).where(CareRequest.owner_id == owner_id)
    if scope == "active":
        query = query.where(CareRequest.status == CareRequestStatus.OPEN).order_by(
            CareRequest.start_at
        )
    else:
        query = query.where(CareRequest.status != CareRequestStatus.OPEN).order_by(
            CareRequest.start_at.desc()
        )
    return list(db.scalars(query.limit(100)))


# ---------------------------------------------------------------- matching


@dataclass(frozen=True)
class Caretaker:
    profile: ProviderProfile
    services: dict[str, CareService]


def caretaker_for(db: Session, user_id: uuid.UUID, profile_id: uuid.UUID) -> Caretaker:
    from app.modules.care.service import caretaker_owned  # local: avoid a cycle

    profile = caretaker_owned(db, user_id, profile_id)
    services = {
        s.care_type: s
        for s in db.scalars(
            select(CareService).where(
                CareService.provider_profile_id == profile.id, CareService.active.is_(True)
            )
        )
    }
    return Caretaker(profile, services)


def _require_live(caretaker: Caretaker) -> None:
    p = caretaker.profile
    if p.verification_status != VerificationStatus.VERIFIED or p.status != ActiveStatus.ACTIVE:
        raise AppError(
            "not_verified",
            "Care requests reach you once Petfinity has verified you.",
            status_code=403,
        )


def request_pets(db: Session, request_ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, list[Pet]]:
    grouped: dict[uuid.UUID, list[Pet]] = defaultdict(list)
    if request_ids:
        for rid, pet in db.execute(
            select(CareRequestPet.request_id, Pet)
            .join(Pet, Pet.id == CareRequestPet.pet_id)
            .where(CareRequestPet.request_id.in_(request_ids))
            .order_by(Pet.name)
        ):
            grouped[rid].append(pet)
    return grouped


def _days_off(db: Session, profile_id: uuid.UUID, first: date, last: date) -> bool:
    return (
        db.scalar(
            select(func.count())
            .select_from(AvailabilityException)
            .where(
                AvailabilityException.provider_profile_id == profile_id,
                AvailabilityException.kind == ExceptionKind.CLOSED,
                AvailabilityException.on_date >= first,
                AvailabilityException.on_date <= last,
            )
        )
        or 0
    ) > 0


def distance_to(caretaker: ProviderProfile, request: CareRequest) -> float | None:
    try:
        a, b = point_of(caretaker), point_of(request)
    except ValueError:
        return None
    return distance_km(a[0], a[1], b[0], b[1])


def eligible(
    db: Session, caretaker: Caretaker, request: CareRequest, pets: list[Pet], now: datetime
) -> bool:
    p = caretaker.profile
    service = caretaker.services.get(request.care_type)
    if service is None or request.owner_id == p.user_id or not p.max_concurrent:
        return False
    if any(pet_bucket(pet.species) not in service.species for pet in pets):
        return False
    if len(pets) > service.max_pets:
        return False
    dist = distance_to(p, request)
    if dist is None or dist > (p.service_radius_km or 10):
        return False
    first, last = _local_dates(request.start_at, request.end_at)
    if _days_off(db, p.id, first, last):
        return False
    busy = busy_by_resource(db, [p.id], request.start_at, request.end_at, now).get(p.id, [])
    return free_unit(request.start_at, request.end_at, p.max_concurrent, busy) is not None


def feed(db: Session, caretaker: Caretaker, scope: str) -> list[CareRequest]:
    """Open requests this caretaker could take, or ones they've already offered on."""
    _require_live(caretaker)
    now = clock.utcnow()
    expire_due(db, now)
    if scope == "offered":
        return list(
            db.scalars(
                select(CareRequest)
                .join(CareOffer, CareOffer.request_id == CareRequest.id)
                .where(CareOffer.provider_profile_id == caretaker.profile.id)
                .order_by(CareRequest.start_at.desc())
                .limit(100)
            )
        )
    if not caretaker.services:
        return []
    candidates = list(
        db.scalars(
            select(CareRequest)
            .where(
                CareRequest.status == CareRequestStatus.OPEN,
                CareRequest.offers_close_at > now,
                CareRequest.care_type.in_(list(caretaker.services)),
            )
            .order_by(CareRequest.start_at)
            .limit(300)
        )
    )
    offered = set(
        db.scalars(
            select(CareOffer.request_id).where(
                CareOffer.provider_profile_id == caretaker.profile.id
            )
        )
    )
    counts = pending_counts(db, [c.id for c in candidates])
    pets = request_pets(db, [c.id for c in candidates])
    return [
        c
        for c in candidates
        if c.id not in offered
        and counts.get(c.id, 0) < MAX_OFFERS
        and eligible(db, caretaker, c, pets.get(c.id, []), now)
    ]


def visible_to(
    db: Session, caretaker: Caretaker, request_id: uuid.UUID
) -> tuple[CareRequest, CareOffer | None]:
    """A request a caretaker may see: one they've offered on, or one they could take."""
    _require_live(caretaker)
    request = db.get(CareRequest, request_id)
    if request is None:
        raise _not_found()
    offer = my_offer(db, caretaker.profile.id, request.id)
    if offer is not None:
        return request, offer
    if request.status != CareRequestStatus.OPEN or not eligible(
        db, caretaker, request, request_pets(db, [request.id]).get(request.id, []), clock.utcnow()
    ):
        raise _not_found()
    return request, None


def my_offer(db: Session, profile_id: uuid.UUID, request_id: uuid.UUID) -> CareOffer | None:
    return db.scalars(
        select(CareOffer).where(
            CareOffer.request_id == request_id, CareOffer.provider_profile_id == profile_id
        )
    ).first()


# ---------------------------------------------------------------- offers


def make_offer(
    db: Session, caretaker: Caretaker, request_id: uuid.UUID, data: OfferIn
) -> CareOffer:
    _require_live(caretaker)
    now = clock.utcnow()
    request = _locked(db, request_id)
    offer = my_offer(db, caretaker.profile.id, request.id)
    if offer is not None and offer.status == CareOfferStatus.PENDING:
        if request.status != CareRequestStatus.OPEN:
            raise AppError("offers_closed", "This request is no longer open.", status_code=409)
        offer.price_minor, offer.message = data.price_minor, data.message
        db.flush()
        return offer
    if offer is not None and offer.status != CareOfferStatus.WITHDRAWN:
        raise AppError("offers_closed", "This request is no longer open.", status_code=409)
    pets = request_pets(db, [request.id]).get(request.id, [])
    if not eligible(db, caretaker, request, pets, now):
        raise _not_found()
    if not accepting_offers(request, pending_counts(db, [request.id]).get(request.id, 0), now):
        raise AppError(
            "offers_closed", "This request isn't taking new offers any more.", status_code=409
        )
    if offer is not None:  # re-offer after withdrawing
        offer.status, offer.price_minor, offer.message = (
            CareOfferStatus.PENDING,
            data.price_minor,
            data.message,
        )
    else:
        offer = CareOffer(
            request_id=request.id,
            provider_profile_id=caretaker.profile.id,
            price_minor=data.price_minor,
            message=data.message,
            status=CareOfferStatus.PENDING,
        )
        try:
            with db.begin_nested():
                db.add(offer)
                db.flush()
        except IntegrityError as exc:  # pragma: no cover - same caretaker racing themselves
            raise AppError("offers_closed", "You've already offered.", status_code=409) from exc
    db.flush()
    return offer


def withdraw(db: Session, caretaker: Caretaker, request_id: uuid.UUID) -> None:
    offer = my_offer(db, caretaker.profile.id, request_id)
    if offer is None or offer.status != CareOfferStatus.PENDING:
        raise AppError("not_found", "You have no open offer here.", status_code=404)
    offer.status = CareOfferStatus.WITHDRAWN
    db.flush()


def accept(
    db: Session, owner_id: uuid.UUID, request_id: uuid.UUID, offer_id: uuid.UUID
) -> tuple[Booking, bool]:
    request = owned(db, owner_id, request_id, lock=True)
    offer = db.get(CareOffer, offer_id)
    if offer is None or offer.request_id != request.id:
        raise AppError("not_found", "We couldn't find that offer.", status_code=404)
    if offer.status == CareOfferStatus.ACCEPTED:
        booking = db.scalars(select(Booking).where(Booking.care_offer_id == offer.id)).first()
        if booking is not None:
            return booking, True
    now = clock.utcnow()
    expire_due(db, now, request_id=request.id)
    if request.status != CareRequestStatus.OPEN or offer.status != CareOfferStatus.PENDING:
        raise AppError(
            "offer_unavailable", "This offer can't be accepted any more.", status_code=409
        )
    profile = db.get(ProviderProfile, offer.provider_profile_id)
    if (
        profile is None
        or profile.provider_type != ProviderType.CARETAKER
        or profile.verification_status != VerificationStatus.VERIFIED
        or profile.status != ActiveStatus.ACTIVE
    ):
        raise AppError(
            "offer_unavailable", "This caretaker isn't available right now.", status_code=409
        )
    pet_ids = [p.id for p in request_pets(db, [request.id]).get(request.id, [])]
    booking, replayed = bookings.create_care_booking(
        db,
        owner_id=owner_id,
        caretaker_id=profile.id,
        capacity=profile.max_concurrent or 1,
        care_request_id=request.id,
        care_offer_id=offer.id,
        care_type=request.care_type,
        title=title_for(request),
        price_minor=offer.price_minor,
        start_at=request.start_at,
        end_at=request.end_at,
        pet_ids=pet_ids,
        notes=request.notes,
        address=request.address,
    )
    offer.status = CareOfferStatus.ACCEPTED
    request.status = CareRequestStatus.BOOKED
    _decline_pending(db, request.id, except_offer=offer.id)
    audit.record(
        db,
        "care.offer_accepted",
        actor_user_id=owner_id,
        target_type="care_request",
        target_id=request.id,
        details={"offer_id": str(offer.id), "booking_id": str(booking.id)},
    )
    db.flush()
    return booking, replayed


def booking_ids(db: Session, request_ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, uuid.UUID]:
    if not request_ids:
        return {}
    return dict(
        db.execute(
            select(Booking.care_request_id, Booking.id).where(
                Booking.care_request_id.in_(request_ids)
            )
        ).all()  # type: ignore[arg-type]
    )


def completed_care_counts(db: Session, profile_ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, int]:
    if not profile_ids:
        return {}
    rows = db.execute(
        select(Booking.provider_profile_id, func.count())
        .where(
            Booking.provider_profile_id.in_(profile_ids),
            Booking.booking_type == "care",
            Booking.status == BookingStatus.COMPLETED,
        )
        .group_by(Booking.provider_profile_id)
    )
    return {pid: int(n) for pid, n in rows if pid is not None}


def round_km(value: float | None) -> int:
    return max(1, math.floor((value or 0) + 0.5))
