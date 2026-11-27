"""Booking engine (milestone 2.6): create, state machine, cancellation policy, mock payments.

Decisions 0004 (instant/request), 0005 (one bookings record) and 0012 (policy,
payment choice, capacity units). Every transition locks the booking row, checks
who may act and what is allowed from the current status, then appends a
booking event (the audit trail and the user-visible timeline).
"""

from __future__ import annotations

import hashlib
import json
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import clock
from app.core.errors import AppError
from app.modules.audit import service as audit
from app.modules.bookings import policy
from app.modules.bookings.busy import busy_by_resource, free_unit, holding_clause
from app.modules.bookings.models import (
    HOLDING_STATUSES,
    Booking,
    BookingEvent,
    BookingPet,
    BookingStatus,
    BookingType,
    CancellationOutcome,
    Payment,
    PaymentStatus,
)
from app.modules.bookings.schemas import BookingAction, BookingCreate, PaymentIn, ViewerRole
from app.modules.catalog import service as catalog
from app.modules.catalog.models import ConfirmationMode, Service, ServiceMode
from app.modules.catalog.owners import Owner
from app.modules.catalog.slots import HORIZON_DAYS
from app.modules.clinics import service as clinics
from app.modules.clinics.models import Clinic, MemberRole
from app.modules.discovery import service as discovery
from app.modules.discovery.schemas import ListingKind
from app.modules.notifications import bookings as booking_notifications
from app.modules.pets.models import Pet
from app.modules.providers.models import ProviderProfile
from app.modules.staff import service as staff
from app.modules.staff.models import StaffRoleName

S = BookingStatus

# Decision 0004: allowed transitions.
TRANSITIONS: dict[BookingStatus, set[BookingStatus]] = {
    S.PENDING_PROVIDER: {
        S.CONFIRMED,
        S.DECLINED,
        S.EXPIRED,
        S.CANCELLED_BY_OWNER,
        S.CANCELLED_BY_ADMIN,
    },
    S.CONFIRMED: {
        S.IN_PROGRESS,
        S.CANCELLED_BY_OWNER,
        S.CANCELLED_BY_PROVIDER,
        S.CANCELLED_BY_ADMIN,
        S.NO_SHOW,
    },
    S.IN_PROGRESS: {S.COMPLETED, S.CANCELLED_BY_ADMIN},
    S.COMPLETED: {S.DISPUTED},
    S.NO_SHOW: {S.DISPUTED},
    S.DISPUTED: {S.COMPLETED, S.CANCELLED_BY_ADMIN},
}

ADDRESS_VISIBLE_TO_PROVIDER = {S.CONFIRMED, S.IN_PROGRESS, S.COMPLETED, S.NO_SHOW, S.DISPUTED}


def _not_found() -> AppError:
    return AppError("not_found", "We couldn't find that booking.", status_code=404)


def _conflict(code: str, message: str) -> AppError:
    return AppError(code, message, status_code=409)


# ---------------------------------------------------------------- viewer & actions


@dataclass(frozen=True)
class Viewer:
    user_id: uuid.UUID
    role: ViewerRole


def _manages_listing(db: Session, user_id: uuid.UUID, booking: Booking) -> bool:
    if booking.clinic_id is not None:
        roles = clinics.roles_by_clinic(db, user_id).get(booking.clinic_id, [])
        return MemberRole.OPERATOR in roles
    profile = db.get(ProviderProfile, booking.provider_profile_id)
    return profile is not None and profile.user_id == user_id


def viewer_for(db: Session, user_id: uuid.UUID, booking: Booking) -> Viewer:
    """Owner, the listing's provider (clinic operator or the vet), or an admin; else 404."""
    if booking.owner_id == user_id:
        return Viewer(user_id, ViewerRole.OWNER)
    if _manages_listing(db, user_id, booking):
        return Viewer(user_id, ViewerRole.PROVIDER)
    if staff.has_role(db, user_id, StaffRoleName.ADMIN):
        return Viewer(user_id, ViewerRole.ADMIN)
    raise _not_found()


def free_cancellation_until(booking: Booking) -> datetime:
    return booking.start_at - policy.FREE_CANCELLATION_BEFORE


def allowed_actions(booking: Booking, role: ViewerRole, now: datetime) -> list[BookingAction]:
    status = BookingStatus(booking.status)
    actions: list[BookingAction] = []
    upcoming = now < booking.start_at
    if role is ViewerRole.OWNER:
        if status in (S.PENDING_PROVIDER, S.CONFIRMED) and upcoming:
            actions.append(BookingAction.CANCEL)
            if now <= free_cancellation_until(booking):
                actions.append(BookingAction.RESCHEDULE)
        if status in (S.CONFIRMED, S.IN_PROGRESS):
            if booking.payment_status in (PaymentStatus.UNPAID, PaymentStatus.PAY_AT_VISIT):
                actions.append(BookingAction.PAY)
            if booking.payment_status == PaymentStatus.UNPAID:
                actions.append(BookingAction.PAY_AT_VISIT)
    elif role is ViewerRole.PROVIDER:
        if status is S.PENDING_PROVIDER:
            actions += [BookingAction.CONFIRM, BookingAction.DECLINE]
        if status is S.CONFIRMED:
            actions.append(BookingAction.CANCEL)
            if now >= booking.start_at - policy.CHECK_IN_EARLY:
                actions.append(BookingAction.CHECK_IN)
            if now >= booking.start_at + policy.NO_SHOW_GRACE:
                actions.append(BookingAction.NO_SHOW)
        if status is S.IN_PROGRESS:
            actions.append(BookingAction.COMPLETE)
    elif status in HOLDING_STATUSES:
        actions.append(BookingAction.CANCEL)
    return actions


def _require(booking: Booking, viewer: Viewer, action: BookingAction, now: datetime) -> None:
    if action not in allowed_actions(booking, viewer.role, now):
        raise _conflict(
            "action_not_allowed",
            f"That can't be done for a booking that is {booking.status.replace('_', ' ')}.",
        )


# ---------------------------------------------------------------- events


def _event(
    db: Session,
    booking: Booking,
    event: str,
    *,
    actor: Viewer | None,
    from_status: str | None = None,
    to_status: str | None = None,
    reason: str | None = None,
    details: dict[str, object] | None = None,
) -> None:
    db.add(
        BookingEvent(
            booking_id=booking.id,
            event=event,
            from_status=from_status,
            to_status=to_status,
            actor_user_id=actor.user_id if actor else None,
            actor_role=actor.role.value if actor else "system",
            reason=reason,
            details=details,
        )
    )
    db.flush()  # the session doesn't autoflush; messages read the booking's pets
    booking_notifications.on_booking_event(
        db,
        booking,
        event,
        to_status=to_status,
        actor_role=actor.role.value if actor else "system",
        reason=reason,
    )


def _move(
    db: Session,
    booking: Booking,
    to: BookingStatus,
    *,
    actor: Viewer | None,
    event: str,
    reason: str | None = None,
    details: dict[str, object] | None = None,
) -> None:
    current = BookingStatus(booking.status)
    if to not in TRANSITIONS.get(current, set()):
        raise _conflict("invalid_transition", f"A {current.value} booking can't become {to.value}.")
    booking.status = to
    _event(
        db,
        booking,
        event,
        actor=actor,
        from_status=current,
        to_status=to,
        reason=reason,
        details=details,
    )


# ---------------------------------------------------------------- expiry


def expire_overdue(
    db: Session, now: datetime, *, resource_id: uuid.UUID | None = None, limit: int = 500
) -> int:
    """Requests the provider didn't answer in time become `expired` and free their slot."""
    query = (
        select(Booking)
        .where(
            Booking.status == S.PENDING_PROVIDER,
            Booking.response_deadline < now,
        )
        .order_by(Booking.response_deadline)
        .limit(limit)
        .with_for_update(skip_locked=True)
    )
    if resource_id is not None:
        query = query.where(Booking.resource_id == resource_id)
    expired = list(db.scalars(query))
    for booking in expired:
        _move(db, booking, S.EXPIRED, actor=None, event="expired")
    if expired:
        db.flush()
    return len(expired)


# ---------------------------------------------------------------- create


def _request_hash(data: BookingCreate) -> str:
    payload = data.model_dump(mode="json")
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


def _check_key(key: str | None) -> str:
    if key is None or not 8 <= len(key) <= 64 or not key.isascii() or not key.isprintable():
        raise AppError(
            "idempotency_key_required",
            "Send an Idempotency-Key header (8-64 printable characters) with each new booking.",
            status_code=400,
        )
    return key


def _lock_resource(db: Session, resource_id: uuid.UUID) -> None:
    """Serialise capacity allocation for one listing until the transaction ends."""
    db.execute(
        text("SELECT pg_advisory_xact_lock(hashtextextended(:k, 0))"),
        {"k": f"booking:{resource_id}"},
    )


def _pet_bucket(pet: Pet) -> str:
    return pet.species if pet.species in ("dog", "cat") else "other"


def _owns_listing(db: Session, user_id: uuid.UUID, owner: Owner) -> bool:
    if owner.is_clinic:
        return owner.id in clinics.roles_by_clinic(db, user_id)
    profile = db.get(ProviderProfile, owner.id)
    return profile is not None and profile.user_id == user_id


def _find_by_key(db: Session, user_id: uuid.UUID, key: str) -> Booking | None:
    return db.scalars(
        select(Booking).where(Booking.owner_id == user_id, Booking.idempotency_key == key)
    ).first()


def _allocate(
    db: Session,
    owner: Owner,
    service: Service,
    start_at: datetime,
    now: datetime,
    *,
    exclude_booking: uuid.UUID | None = None,
) -> tuple[datetime, int]:
    """Check `start_at` is an open slot and pick a free capacity unit. Caller holds the lock."""
    tz = ZoneInfo(owner.timezone)
    start_at = start_at.astimezone(ZoneInfo("UTC"))
    on = start_at.astimezone(tz).date()
    today = now.astimezone(tz).date()
    if on > today + timedelta(days=HORIZON_DAYS):
        raise AppError(
            "invalid_date", f"Choose a time within the next {HORIZON_DAYS} days.", status_code=422
        )
    slots = catalog.available_slots(
        db, owner, service, on, now=now, exclude_booking=exclude_booking
    )
    slot = next((s for s in slots if s.start == start_at), None)
    if slot is None:
        raise _conflict(
            "slot_unavailable", "That time was just taken or isn't open. Please pick another."
        )
    busy = busy_by_resource(
        db, [owner.id], slot.start, slot.end, now, exclude_booking=exclude_booking
    ).get(owner.id, [])
    unit = free_unit(slot.start, slot.end, slot.capacity, busy)
    if unit is None:  # pragma: no cover - available_slots already checked under the lock
        raise _conflict("slot_unavailable", "That time was just taken. Please pick another.")
    return slot.end, unit


def _deadline(now: datetime, start_at: datetime) -> datetime:
    return min(
        now + policy.REQUEST_RESPONSE_WINDOW, start_at - policy.REQUEST_DEADLINE_BEFORE_START
    )


def create(
    db: Session, user_id: uuid.UUID, data: BookingCreate, idempotency_key: str | None
) -> tuple[Booking, bool]:
    """Returns (booking, replayed). A repeated key with the same request replays the original."""
    key = _check_key(idempotency_key)
    request_hash = _request_hash(data)
    now = clock.utcnow()

    owner = discovery.public_owner(db, data.listing_kind, data.listing_id)
    _lock_resource(db, owner.id)

    existing = _find_by_key(db, user_id, key)
    if existing is not None:
        if existing.request_hash != request_hash:
            raise AppError(
                "idempotency_key_reused",
                "This Idempotency-Key was already used for a different booking.",
                status_code=422,
            )
        return existing, True

    service = db.scalars(
        select(Service).where(
            Service.id == data.service_id,
            owner.filter(Service),
            Service.active.is_(True),
            Service.archived_at.is_(None),
        )
    ).first()
    if service is None or (
        data.listing_kind is ListingKind.VET and service.service_mode != ServiceMode.HOME_VISIT
    ):
        raise AppError(
            "service_unavailable", "That service isn't bookable right now.", status_code=422
        )
    if _owns_listing(db, user_id, owner):
        raise AppError("own_listing", "You can't book your own listing.", status_code=422)

    pets = list(
        db.scalars(
            select(Pet).where(
                Pet.id.in_(data.pet_ids), Pet.owner_id == user_id, Pet.deleted_at.is_(None)
            )
        )
    )
    if len(pets) != len(set(data.pet_ids)):
        raise AppError("pet_not_found", "Choose one of your pets.", status_code=422)
    for pet in pets:
        if _pet_bucket(pet) not in service.species:
            raise AppError(
                "species_not_offered",
                f"{service.title} isn't offered for {pet.species.replace('_', ' ')}s here.",
                status_code=422,
            )
    if service.service_mode == ServiceMode.HOME_VISIT and not data.visit_address:
        raise AppError("address_required", "Add the address for the home visit.", status_code=422)

    active = db.scalar(
        select(func.count())
        .select_from(Booking)
        .where(Booking.owner_id == user_id, holding_clause(now), Booking.end_at > now)
    )
    if (active or 0) >= policy.MAX_ACTIVE_BOOKINGS_PER_OWNER:
        raise AppError(
            "too_many_bookings",
            "You have too many upcoming bookings. Cancel one to book another.",
            status_code=422,
        )

    expire_overdue(db, now, resource_id=owner.id)
    start_at = data.start_at.astimezone(ZoneInfo("UTC"))
    end_at, unit = _allocate(db, owner, service, start_at, now)

    instant = service.confirmation_mode == ConfirmationMode.INSTANT
    booking = Booking(
        booking_type=BookingType.VET_APPOINTMENT,
        owner_id=user_id,
        **owner.fk(),
        service_id=service.id,
        service_title=service.title,
        service_mode=service.service_mode,
        confirmation_mode=service.confirmation_mode,
        amount_minor=service.price_minor,
        currency=service.currency,
        cancellation_policy=policy.POLICY_SNAPSHOT,
        status=S.CONFIRMED if instant else S.PENDING_PROVIDER,
        start_at=start_at,
        end_at=end_at,
        timezone=owner.timezone,
        response_deadline=None if instant else _deadline(now, start_at),
        resource_id=owner.id,
        capacity_unit=unit,
        owner_notes=data.owner_notes,
        visit_address=data.visit_address,
        payment_status=PaymentStatus.UNPAID if instant else PaymentStatus.NOT_DUE,
        idempotency_key=key,
        request_hash=request_hash,
    )
    try:
        with db.begin_nested():
            db.add(booking)
            db.flush()
    except IntegrityError as exc:  # defence in depth: the exclusion or idempotency constraint
        raise _conflict(
            "slot_unavailable", "That time was just taken. Please pick another."
        ) from exc
    db.add_all(BookingPet(booking_id=booking.id, pet_id=pet.id) for pet in pets)
    actor = Viewer(user_id, ViewerRole.OWNER)
    _event(db, booking, "created", actor=actor, to_status=booking.status)
    db.flush()
    return booking, False


# ---------------------------------------------------------------- read


def _load_for(
    db: Session, user_id: uuid.UUID, booking_id: uuid.UUID, *, for_update: bool = False
) -> tuple[Booking, Viewer]:
    query = select(Booking).where(Booking.id == booking_id)
    if for_update:
        query = query.with_for_update()
    booking = db.scalars(query).first()
    if booking is None:
        raise _not_found()
    viewer = viewer_for(db, user_id, booking)
    if booking.status == S.PENDING_PROVIDER and booking.response_deadline is not None:
        now = clock.utcnow()
        if booking.response_deadline < now:
            if not for_update:
                db.refresh(booking, with_for_update=True)
            if booking.status == S.PENDING_PROVIDER:
                _move(db, booking, S.EXPIRED, actor=None, event="expired")
                db.flush()
    return booking, viewer


def get(db: Session, user_id: uuid.UUID, booking_id: uuid.UUID) -> tuple[Booking, Viewer]:
    return _load_for(db, user_id, booking_id)


def list_for_owner(db: Session, user_id: uuid.UUID, scope: str) -> list[Booking]:
    now = clock.utcnow()
    expire_overdue(db, now)
    query = select(Booking).where(Booking.owner_id == user_id)
    if scope == "upcoming":
        query = query.where(Booking.status.in_(HOLDING_STATUSES), Booking.end_at > now).order_by(
            Booking.start_at
        )
    else:
        query = query.where(
            ~(Booking.status.in_(HOLDING_STATUSES) & (Booking.end_at > now))
        ).order_by(Booking.start_at.desc())
    return list(db.scalars(query.limit(100)))


def list_for_listing(db: Session, owner: Owner, scope: str) -> list[Booking]:
    now = clock.utcnow()
    expire_overdue(db, now, resource_id=owner.id)
    query = select(Booking).where(Booking.resource_id == owner.id)
    if scope == "requests":
        query = query.where(Booking.status == S.PENDING_PROVIDER).order_by(
            Booking.response_deadline
        )
    elif scope == "upcoming":
        # Requests have their own tab; upcoming is what's actually on the calendar.
        query = query.where(
            Booking.status.in_((S.CONFIRMED, S.IN_PROGRESS)), Booking.end_at > now
        ).order_by(Booking.start_at)
    else:
        query = query.where(
            ~(Booking.status.in_(HOLDING_STATUSES) & (Booking.end_at > now))
        ).order_by(Booking.start_at.desc())
    return list(db.scalars(query.limit(200)))


def pets_for(db: Session, booking_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[Pet]]:
    grouped: dict[uuid.UUID, list[Pet]] = {bid: [] for bid in booking_ids}
    if not booking_ids:
        return grouped
    rows = db.execute(
        select(BookingPet.booking_id, Pet)
        .join(Pet, Pet.id == BookingPet.pet_id)
        .where(BookingPet.booking_id.in_(booking_ids))
        .order_by(Pet.name)
    )
    for booking_id, pet in rows:
        grouped[booking_id].append(pet)
    return grouped


def listing_names(
    db: Session, bookings: list[Booking]
) -> dict[uuid.UUID, tuple[ListingKind, str, str | None]]:
    clinic_ids = {b.clinic_id for b in bookings if b.clinic_id}
    vet_ids = {b.provider_profile_id for b in bookings if b.provider_profile_id}
    names: dict[uuid.UUID, tuple[ListingKind, str, str | None]] = {}
    if clinic_ids:
        for clinic in db.scalars(select(Clinic).where(Clinic.id.in_(clinic_ids))):
            names[clinic.id] = (ListingKind.CLINIC, clinic.name, clinic.locality)
    if vet_ids:
        for vet in db.scalars(select(ProviderProfile).where(ProviderProfile.id.in_(vet_ids))):
            names[vet.id] = (ListingKind.VET, vet.display_name, vet.city)
    return names


def events_for(db: Session, booking_id: uuid.UUID) -> list[BookingEvent]:
    return list(
        db.scalars(
            select(BookingEvent)
            .where(BookingEvent.booking_id == booking_id)
            .order_by(BookingEvent.created_at, BookingEvent.id)
        )
    )


def payments_for(db: Session, booking_id: uuid.UUID) -> list[Payment]:
    return list(
        db.scalars(
            select(Payment).where(Payment.booking_id == booking_id).order_by(Payment.created_at)
        )
    )


# ---------------------------------------------------------------- transitions


def _mock_payment(db: Session, booking: Booking, kind: str) -> Payment:
    payment = Payment(
        booking_id=booking.id,
        provider="mock",
        kind=kind,
        amount_minor=booking.amount_minor,
        currency=booking.currency,
        status="succeeded",
        reference=f"mock_{kind}_{uuid.uuid4().hex[:20]}",
    )
    db.add(payment)
    return payment


def confirm(db: Session, user_id: uuid.UUID, booking_id: uuid.UUID) -> Booking:
    booking, viewer = _load_for(db, user_id, booking_id, for_update=True)
    now = clock.utcnow()
    if booking.status == S.EXPIRED:
        raise _conflict("request_expired", "This request expired before it was confirmed.")
    _require(booking, viewer, BookingAction.CONFIRM, now)
    _move(db, booking, S.CONFIRMED, actor=viewer, event="confirmed")
    booking.payment_status = PaymentStatus.UNPAID
    db.flush()
    return booking


def decline(db: Session, user_id: uuid.UUID, booking_id: uuid.UUID, reason: str | None) -> Booking:
    booking, viewer = _load_for(db, user_id, booking_id, for_update=True)
    _require(booking, viewer, BookingAction.DECLINE, clock.utcnow())
    _move(db, booking, S.DECLINED, actor=viewer, event="declined", reason=reason)
    booking.cancel_reason = reason
    db.flush()
    return booking


def cancel(db: Session, user_id: uuid.UUID, booking_id: uuid.UUID, reason: str | None) -> Booking:
    booking, viewer = _load_for(db, user_id, booking_id, for_update=True)
    now = clock.utcnow()
    _require(booking, viewer, BookingAction.CANCEL, now)
    if viewer.role is not ViewerRole.OWNER and not reason:
        raise AppError(
            "reason_required", "Tell the pet parent why this booking is cancelled.", status_code=422
        )
    to = {
        ViewerRole.OWNER: S.CANCELLED_BY_OWNER,
        ViewerRole.PROVIDER: S.CANCELLED_BY_PROVIDER,
        ViewerRole.ADMIN: S.CANCELLED_BY_ADMIN,
    }[viewer.role]

    late = viewer.role is ViewerRole.OWNER and now > free_cancellation_until(booking)
    paid = booking.payment_status == PaymentStatus.PAID
    if booking.status == S.PENDING_PROVIDER:
        outcome = CancellationOutcome.NOT_CHARGED
    elif late:
        outcome = CancellationOutcome.LATE_NO_REFUND
        if paid:
            booking.payment_status = PaymentStatus.NOT_REFUNDED
    elif paid:
        outcome = CancellationOutcome.FULL_REFUND
        _mock_payment(db, booking, "refund")
        booking.payment_status = PaymentStatus.REFUNDED
    else:
        outcome = CancellationOutcome.NOT_CHARGED

    # Set before the event so its notification can describe the outcome.
    booking.cancellation_outcome = outcome
    booking.cancel_reason = reason
    _move(
        db,
        booking,
        to,
        actor=viewer,
        event="cancelled",
        reason=reason,
        details={"outcome": outcome.value, "late": late},
    )
    if viewer.role is ViewerRole.ADMIN:
        audit.record(
            db,
            "booking.cancelled_by_admin",
            actor_user_id=user_id,
            target_type="booking",
            target_id=booking.id,
            details={"reason": reason or ""},
        )
    db.flush()
    return booking


def reschedule(
    db: Session, user_id: uuid.UUID, booking_id: uuid.UUID, start_at: datetime
) -> Booking:
    booking, viewer = _load_for(db, user_id, booking_id, for_update=True)
    now = clock.utcnow()
    if (
        viewer.role is ViewerRole.OWNER
        and booking.status in (S.PENDING_PROVIDER, S.CONFIRMED)
        and free_cancellation_until(booking) < now < booking.start_at
    ):
        raise _conflict(
            "reschedule_too_late",
            "Bookings can be moved up to 2 hours before the start. You can still cancel.",
        )
    _require(booking, viewer, BookingAction.RESCHEDULE, now)

    kind = ListingKind.CLINIC if booking.clinic_id else ListingKind.VET
    owner = discovery.public_owner(db, kind, booking.resource_id)
    service = db.get(Service, booking.service_id)
    if service is None or not service.active or service.archived_at is not None:
        raise _conflict("service_unavailable", "This service can't be rebooked right now.")
    _lock_resource(db, owner.id)
    expire_overdue(db, now, resource_id=owner.id)
    new_start = start_at.astimezone(ZoneInfo("UTC"))
    old_start = booking.start_at
    end_at, unit = _allocate(db, owner, service, new_start, now, exclude_booking=booking.id)

    booking.start_at, booking.end_at, booking.capacity_unit = new_start, end_at, unit
    details: dict[str, object] = {"from": old_start.isoformat(), "to": new_start.isoformat()}
    if service.confirmation_mode == ConfirmationMode.REQUEST:
        # A new time needs the provider's OK again (0004).
        previous = booking.status
        booking.response_deadline = _deadline(now, new_start)
        if previous == S.CONFIRMED:
            booking.status = S.PENDING_PROVIDER
        _event(
            db,
            booking,
            "rescheduled",
            actor=viewer,
            from_status=previous,
            to_status=booking.status,
            details=details,
        )
    else:
        _event(db, booking, "rescheduled", actor=viewer, details=details)
    try:
        db.flush()
    except IntegrityError as exc:  # pragma: no cover - guarded by the advisory lock
        raise _conflict("slot_unavailable", "That time was just taken.") from exc
    return booking


def check_in(db: Session, user_id: uuid.UUID, booking_id: uuid.UUID) -> Booking:
    booking, viewer = _load_for(db, user_id, booking_id, for_update=True)
    _require(booking, viewer, BookingAction.CHECK_IN, clock.utcnow())
    _move(db, booking, S.IN_PROGRESS, actor=viewer, event="checked_in")
    db.flush()
    return booking


def complete(db: Session, user_id: uuid.UUID, booking_id: uuid.UUID) -> Booking:
    booking, viewer = _load_for(db, user_id, booking_id, for_update=True)
    _require(booking, viewer, BookingAction.COMPLETE, clock.utcnow())
    _move(db, booking, S.COMPLETED, actor=viewer, event="completed")
    db.flush()
    return booking


def no_show(db: Session, user_id: uuid.UUID, booking_id: uuid.UUID) -> Booking:
    booking, viewer = _load_for(db, user_id, booking_id, for_update=True)
    _require(booking, viewer, BookingAction.NO_SHOW, clock.utcnow())
    _move(db, booking, S.NO_SHOW, actor=viewer, event="no_show")
    db.flush()
    return booking


def pay(db: Session, user_id: uuid.UUID, booking_id: uuid.UUID, data: PaymentIn) -> Booking:
    """MOCK payments only: records the parent's choice; nothing is ever charged."""
    booking, viewer = _load_for(db, user_id, booking_id, for_update=True)
    now = clock.utcnow()
    if data.method == "pay_now":
        _require(booking, viewer, BookingAction.PAY, now)
        payment = _mock_payment(db, booking, "charge")
        booking.payment_status = PaymentStatus.PAID
        _event(
            db,
            booking,
            "paid",
            actor=viewer,
            details={"provider": "mock", "reference": payment.reference},
        )
    else:
        _require(booking, viewer, BookingAction.PAY_AT_VISIT, now)
        booking.payment_status = PaymentStatus.PAY_AT_VISIT
        _event(db, booking, "pay_at_visit", actor=viewer)
    db.flush()
    return booking
