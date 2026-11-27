"""Booking API (milestone 2.6). Parent, provider and admin actions share one resource."""

from __future__ import annotations

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, Response, status

from app.api.deps import CurrentUser, DbSession
from app.core import clock
from app.core.errors import error_responses
from app.modules.bookings import service as bookings
from app.modules.bookings.models import Booking
from app.modules.bookings.schemas import (
    BookingCreate,
    BookingDetail,
    BookingEventOut,
    BookingList,
    BookingOut,
    BookingPetOut,
    ListingRef,
    PaymentIn,
    PaymentOut,
    PolicyOut,
    ReasonIn,
    RescheduleIn,
    ViewerRole,
)
from app.modules.bookings.service import ADDRESS_VISIBLE_TO_PROVIDER, Viewer
from app.modules.catalog.router import ManagedOwner
from app.modules.discovery.schemas import ListingKind
from app.modules.notifications.router import push_after_response
from app.modules.pets.models import Pet
from app.modules.users.models import User

# Booking changes create notifications; push them once the response has gone out.
router = APIRouter(
    prefix="/bookings", tags=["bookings"], dependencies=[Depends(push_after_response)]
)
_ERRORS = error_responses(400, 401, 404, 409, 422)


def present(
    db: DbSession,
    booking: Booking,
    viewer: Viewer,
    *,
    pets: list[Pet] | None = None,
    listing: tuple[ListingKind, str, str | None] | None = None,
) -> BookingOut:
    now = clock.utcnow()
    if pets is None:
        pets = bookings.pets_for(db, [booking.id])[booking.id]
    if listing is None:
        listing = bookings.listing_names(db, [booking])[booking.resource_id]
    provider_view = viewer.role is not ViewerRole.OWNER
    address_hidden = provider_view and booking.status not in ADDRESS_VISIBLE_TO_PROVIDER
    owner = db.get(User, booking.owner_id) if provider_view else None
    snapshot = booking.cancellation_policy
    return BookingOut(
        id=booking.id,
        booking_type=booking.booking_type,
        status=booking.status,
        listing=ListingRef(
            kind=listing[0], id=booking.resource_id, name=listing[1], locality=listing[2]
        ),
        service_id=booking.service_id,
        service_title=booking.service_title,
        service_mode=booking.service_mode,
        confirmation_mode=booking.confirmation_mode,
        start_at=booking.start_at,
        end_at=booking.end_at,
        timezone=booking.timezone,
        response_deadline=booking.response_deadline,
        amount_minor=booking.amount_minor,
        currency=booking.currency,
        payment_status=booking.payment_status,
        pets=[BookingPetOut(id=p.id, name=p.name, species=p.species, breed=p.breed) for p in pets],
        owner_name=(owner.display_name if owner else None),
        owner_notes=booking.owner_notes,
        visit_address=None if address_hidden else booking.visit_address,
        policy=PolicyOut(
            free_cancellation_until=bookings.free_cancellation_until(booking),
            free_cancellation_hours_before=int(snapshot.get("free_cancellation_hours_before", 2)),
            late_cancellation=str(snapshot.get("late_cancellation", "no_refund")),
            provider_cancellation=str(snapshot.get("provider_cancellation", "full_refund")),
        ),
        cancellation_outcome=booking.cancellation_outcome,
        cancel_reason=booking.cancel_reason,
        viewer_role=viewer.role,
        allowed_actions=bookings.allowed_actions(booking, viewer.role, now),
        created_at=booking.created_at,
        updated_at=booking.updated_at,
    )


def present_detail(db: DbSession, booking: Booking, viewer: Viewer) -> BookingDetail:
    base = present(db, booking, viewer)
    return BookingDetail(
        **base.model_dump(),
        events=[
            BookingEventOut(
                event=e.event,
                from_status=e.from_status,
                to_status=e.to_status,
                actor_role=e.actor_role,
                reason=e.reason,
                details=e.details,
                created_at=e.created_at,
            )
            for e in bookings.events_for(db, booking.id)
        ],
        payments=[
            PaymentOut(
                kind=p.kind,
                amount_minor=p.amount_minor,
                currency=p.currency,
                status=p.status,
                reference=p.reference,
                provider="mock",
                created_at=p.created_at,
            )
            for p in bookings.payments_for(db, booking.id)
        ],
    )


def present_list(
    db: DbSession, items: list[Booking], role: ViewerRole, user_id: uuid.UUID
) -> BookingList:
    pets = bookings.pets_for(db, [b.id for b in items])
    names = bookings.listing_names(db, items)
    viewer = Viewer(user_id, role)
    return BookingList(
        items=[present(db, b, viewer, pets=pets[b.id], listing=names[b.resource_id]) for b in items]
    )


@router.post(
    "",
    response_model=BookingDetail,
    status_code=status.HTTP_201_CREATED,
    responses=_ERRORS,
    summary="Book a vet appointment (instant → confirmed, request → pending_provider)",
)
def create_booking(
    data: BookingCreate,
    response: Response,
    db: DbSession,
    user: CurrentUser,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> BookingDetail:
    booking, replayed = bookings.create(db, user.id, data, idempotency_key)
    db.commit()
    if replayed:
        response.status_code = status.HTTP_200_OK
        response.headers["Idempotent-Replayed"] = "true"
    return present_detail(db, booking, Viewer(user.id, ViewerRole.OWNER))


@router.get("", response_model=BookingList, responses=_ERRORS, summary="My bookings")
def my_bookings(
    db: DbSession, user: CurrentUser, scope: Literal["upcoming", "past"] = "upcoming"
) -> BookingList:
    items = bookings.list_for_owner(db, user.id, scope)
    db.commit()  # persists any requests that expired while listing
    return present_list(db, items, ViewerRole.OWNER, user.id)


@router.get(
    "/{booking_id}", response_model=BookingDetail, responses=_ERRORS, summary="Booking detail"
)
def booking_detail(booking_id: uuid.UUID, db: DbSession, user: CurrentUser) -> BookingDetail:
    booking, viewer = bookings.get(db, user.id, booking_id)
    db.commit()  # persists the expiry of an overdue request
    return present_detail(db, booking, viewer)


def _respond(db: DbSession, user: User, booking: Booking) -> BookingDetail:
    db.commit()
    return present_detail(db, booking, bookings.viewer_for(db, user.id, booking))


@router.post(
    "/{booking_id}/confirm",
    response_model=BookingDetail,
    responses=_ERRORS,
    summary="Provider confirms a request",
)
def confirm(booking_id: uuid.UUID, db: DbSession, user: CurrentUser) -> BookingDetail:
    return _respond(db, user, bookings.confirm(db, user.id, booking_id))


@router.post(
    "/{booking_id}/decline",
    response_model=BookingDetail,
    responses=_ERRORS,
    summary="Provider declines a request",
)
def decline(
    booking_id: uuid.UUID, data: ReasonIn, db: DbSession, user: CurrentUser
) -> BookingDetail:
    return _respond(db, user, bookings.decline(db, user.id, booking_id, data.reason))


@router.post(
    "/{booking_id}/cancel",
    response_model=BookingDetail,
    responses=_ERRORS,
    summary="Cancel (parent: free until 2 h before; provider/admin: reason required, full refund)",
)
def cancel(
    booking_id: uuid.UUID, data: ReasonIn, db: DbSession, user: CurrentUser
) -> BookingDetail:
    return _respond(db, user, bookings.cancel(db, user.id, booking_id, data.reason))


@router.post(
    "/{booking_id}/reschedule",
    response_model=BookingDetail,
    responses=_ERRORS,
    summary="Parent moves the booking to another open slot",
)
def reschedule(
    booking_id: uuid.UUID, data: RescheduleIn, db: DbSession, user: CurrentUser
) -> BookingDetail:
    return _respond(db, user, bookings.reschedule(db, user.id, booking_id, data.start_at))


@router.post(
    "/{booking_id}/check-in",
    response_model=BookingDetail,
    responses=_ERRORS,
    summary="Provider checks the pet in",
)
def check_in(booking_id: uuid.UUID, db: DbSession, user: CurrentUser) -> BookingDetail:
    return _respond(db, user, bookings.check_in(db, user.id, booking_id))


@router.post(
    "/{booking_id}/complete",
    response_model=BookingDetail,
    responses=_ERRORS,
    summary="Provider marks the visit completed",
)
def complete(booking_id: uuid.UUID, db: DbSession, user: CurrentUser) -> BookingDetail:
    return _respond(db, user, bookings.complete(db, user.id, booking_id))


@router.post(
    "/{booking_id}/no-show",
    response_model=BookingDetail,
    responses=_ERRORS,
    summary="Provider marks a no-show (15 min after the start)",
)
def no_show(booking_id: uuid.UUID, db: DbSession, user: CurrentUser) -> BookingDetail:
    return _respond(db, user, bookings.no_show(db, user.id, booking_id))


@router.post(
    "/{booking_id}/payment",
    response_model=BookingDetail,
    responses=_ERRORS,
    summary="MOCK payment: pay now (nothing is charged) or choose to pay at the visit",
)
def payment(
    booking_id: uuid.UUID, data: PaymentIn, db: DbSession, user: CurrentUser
) -> BookingDetail:
    return _respond(db, user, bookings.pay(db, user.id, booking_id, data))


manage_router = APIRouter(
    prefix="/manage/{owner_type}/{owner_id}",
    tags=["manage"],
    dependencies=[Depends(push_after_response)],
)


@manage_router.get(
    "/bookings",
    response_model=BookingList,
    responses=_ERRORS,
    summary="Provider inbox: requests to answer, upcoming and past bookings for this listing",
)
def listing_bookings(
    owner: ManagedOwner,
    db: DbSession,
    user: CurrentUser,
    scope: Literal["requests", "upcoming", "past"] = "upcoming",
) -> BookingList:
    items = bookings.list_for_listing(db, owner, scope)
    db.commit()  # persists any requests that expired while listing
    return present_list(db, items, ViewerRole.PROVIDER, user.id)
