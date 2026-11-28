"""Booking notifications: who hears about each booking event, and reminders (decision 0013).

Rules:
- Nobody is notified about their own action (a parent who cancels isn't told they cancelled).
- Provider side means every active operator of a clinic, or the vet who owns the profile.
- Messages carry the pet, service and local time, never the home-visit address.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.bookings.models import Booking, BookingPet, BookingStatus
from app.modules.clinics.models import Clinic, ClinicMember, MemberRole
from app.modules.notifications.service import notify
from app.modules.pets.models import Pet
from app.modules.providers.models import ProviderProfile
from app.modules.users.models import User

REMINDERS = (("reminder_24h", timedelta(hours=24)), ("reminder_2h", timedelta(hours=2)))


@dataclass(frozen=True)
class _Context:
    listing: str
    pets: str
    owner: str
    when: str  # "Mon 30 Nov, 9:00 am" in the listing's timezone
    providers: list[uuid.UUID]


def _clock(dt: datetime, tz: str) -> str:
    local = dt.astimezone(ZoneInfo(tz))
    return f"{local.hour % 12 or 12}:{local.minute:02d} {'am' if local.hour < 12 else 'pm'}"


def _when(dt: datetime, tz: str) -> str:
    local = dt.astimezone(ZoneInfo(tz))
    return f"{local.strftime('%a')} {local.day} {local.strftime('%b')}, {_clock(dt, tz)}"


def _context(db: Session, booking: Booking) -> _Context:
    if booking.clinic_id is not None:
        clinic = db.get(Clinic, booking.clinic_id)
        listing = clinic.name if clinic else "The clinic"
        providers = list(
            db.scalars(
                select(ClinicMember.user_id).where(
                    ClinicMember.clinic_id == booking.clinic_id,
                    ClinicMember.member_role == MemberRole.OPERATOR,
                    ClinicMember.removed_at.is_(None),
                )
            )
        )
    else:
        profile = db.get(ProviderProfile, booking.provider_profile_id)
        listing = profile.display_name if profile else "Your vet"
        providers = [profile.user_id] if profile else []
    pets = db.scalars(
        select(Pet.name)
        .join(BookingPet, BookingPet.pet_id == Pet.id)
        .where(BookingPet.booking_id == booking.id)
        .order_by(Pet.name)
    ).all()
    owner = db.get(User, booking.owner_id)
    return _Context(
        listing=listing,
        pets=", ".join(pets) or "your pet",
        owner=(owner.display_name if owner and owner.display_name else "A pet parent"),
        when=_when(booking.start_at, booking.timezone),
        providers=providers,
    )


def _routes(booking: Booking) -> tuple[dict[str, str], dict[str, str]]:
    owner = {"route": f"/bookings/{booking.id}", "booking_id": str(booking.id)}
    provider = {"route": f"/provider/booking/{booking.id}", "booking_id": str(booking.id)}
    return owner, provider


def on_booking_event(
    db: Session,
    booking: Booking,
    event: str,
    *,
    to_status: str | None,
    actor_role: str,
    reason: str | None = None,
) -> None:
    ctx = _context(db, booking)
    owner_data, provider_data = _routes(booking)
    tz = booking.timezone

    def to_owner(kind: str, title: str, body: str) -> None:
        if actor_role != "owner":
            notify(db, booking.owner_id, kind, title, body, owner_data)

    def to_providers(kind: str, title: str, body: str) -> None:
        if actor_role == "provider":
            return
        for user_id in ctx.providers:
            if user_id != booking.owner_id:
                notify(db, user_id, kind, title, body, provider_data)

    because = f": “{reason}”" if reason else "."
    if event == "created":
        if to_status == BookingStatus.PENDING_PROVIDER and booking.response_deadline:
            to_providers(
                "booking_request",
                f"New request: {ctx.pets} · {booking.service_title}",
                f"{ctx.owner} asked for {ctx.when}. "
                f"Reply by {_clock(booking.response_deadline, tz)}.",
            )
        elif booking.booking_type == "care":
            to_providers(
                "booking_new",
                f"Offer accepted: {ctx.pets}",
                f"{ctx.owner} booked {booking.service_title} from {ctx.when}. "
                "The full address is now in the booking.",
            )
        else:
            to_providers(
                "booking_new",
                f"New appointment: {ctx.pets}",
                f"{booking.service_title} with {ctx.owner}, {ctx.when}.",
            )
    elif event == "confirmed":
        to_owner(
            "booking_confirmed",
            "Appointment confirmed",
            f"{ctx.listing} confirmed {booking.service_title} for {ctx.pets} on {ctx.when}.",
        )
    elif event == "declined":
        to_owner(
            "booking_declined",
            "Request declined",
            f"{ctx.listing} can’t make {ctx.when}{because} You weren’t charged.",
        )
    elif event == "expired":
        to_owner(
            "booking_expired",
            "Request not confirmed",
            f"{ctx.listing} didn’t reply in time, so your request for {ctx.when} was released. "
            "You weren’t charged.",
        )
        to_providers(
            "booking_expired",
            "Request expired",
            f"You didn’t reply to {ctx.owner}’s request for {ctx.pets} on {ctx.when}.",
        )
    elif event == "cancelled":
        refund = {
            "full_refund": " Your mock payment is refunded in full.",
            "late_no_refund": "",
            "not_charged": " You weren’t charged.",
        }.get(booking.cancellation_outcome or "", "")
        to_owner(
            "booking_cancelled",
            "Appointment cancelled",
            f"{ctx.listing} cancelled {booking.service_title} on {ctx.when}{because}{refund}",
        )
        to_providers(
            "booking_cancelled",
            "Appointment cancelled",
            f"{ctx.owner} cancelled {booking.service_title} for {ctx.pets} on {ctx.when}.",
        )
    elif event == "rescheduled":
        if to_status == BookingStatus.PENDING_PROVIDER and booking.response_deadline:
            to_providers(
                "booking_request",
                f"New time requested: {ctx.pets}",
                f"{ctx.owner} asked to move {booking.service_title} to {ctx.when}. "
                f"Reply by {_clock(booking.response_deadline, tz)}.",
            )
        else:
            to_providers(
                "booking_rescheduled",
                f"Appointment moved: {ctx.pets}",
                f"{booking.service_title} with {ctx.owner} is now {ctx.when}.",
            )
    elif event == "completed":
        to_owner(
            "booking_completed",
            f"Thanks for visiting {ctx.listing}",
            f"We hope {ctx.pets} is feeling great. Tap to rate your visit and help other "
            "pet parents.",
        )
    elif event == "no_show":
        to_owner(
            "booking_no_show",
            "Appointment marked as missed",
            f"{ctx.listing} marked {ctx.when} as missed. If that’s wrong, contact Petfinity.",
        )


def queue_reminders(db: Session, now: datetime) -> int:
    """Day-before and 2-hours-before reminders for confirmed appointments (deduplicated).

    A reminder is skipped when the booking was made inside its window (a visit booked
    an hour ahead doesn't get a "tomorrow" reminder).
    """
    upcoming = db.scalars(
        select(Booking).where(
            Booking.status == BookingStatus.CONFIRMED,
            Booking.start_at > now,
            Booking.start_at <= now + REMINDERS[0][1],
        )
    )
    queued = 0
    for booking in upcoming:
        due = [
            (kind, window)
            for kind, window in REMINDERS
            if booking.start_at - now <= window and booking.created_at <= booking.start_at - window
        ]
        if not due:
            continue
        kind = due[-1][0]  # the nearest window only: never two reminders at once
        ctx = _context(db, booking)
        local_day = booking.start_at.astimezone(ZoneInfo(booking.timezone)).date()
        today = now.astimezone(ZoneInfo(booking.timezone)).date()
        day = "today" if local_day == today else "tomorrow"
        title = (
            f"In 2 hours: {booking.service_title}"
            if kind == "reminder_2h"
            else f"Reminder: {booking.service_title} {day}"
        )
        body = f"{ctx.pets} at {ctx.listing}, {_clock(booking.start_at, booking.timezone)}." + (
            f" Free cancellation until "
            f"{_clock(booking.start_at - timedelta(hours=2), booking.timezone)}."
            if kind == "reminder_24h"
            else ""
        )
        owner_data, _ = _routes(booking)
        if notify(
            db,
            booking.owner_id,
            kind,
            title,
            body,
            owner_data,
            dedupe_key=f"booking:{booking.id}:{kind}",
        ):
            queued += 1
    db.flush()
    return queued
