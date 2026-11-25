"""Services, weekly hours, date exceptions and slot preview (milestone 2.4)."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.core.errors import AppError
from app.modules.audit import service as audit
from app.modules.catalog.models import (
    AvailabilityException,
    AvailabilityRule,
    ConfirmationMode,
    ExceptionKind,
    Service,
    ServiceMode,
)
from app.modules.catalog.owners import Owner
from app.modules.catalog.schemas import ExceptionIn, RuleIn, ServiceCreate, ServiceUpdate
from app.modules.catalog.slots import HORIZON_DAYS, Slot, generate_slots, overlaps, windows_for_date

MAX_SERVICES = 50
MAX_RANGES_PER_DAY = 6
DEFAULT_CONFIRMATION = {
    ServiceMode.IN_CLINIC: ConfirmationMode.INSTANT,
    ServiceMode.HOME_VISIT: ConfirmationMode.REQUEST,
}


def _check_mode(owner: Owner, mode: ServiceMode | str) -> None:
    if mode == ServiceMode.TELECONSULT:
        raise AppError(
            "mode_unavailable",
            "Teleconsultation isn't available yet; it needs a compliance review first.",
            status_code=422,
        )
    if mode == ServiceMode.IN_CLINIC and not owner.is_clinic:
        raise AppError(
            "clinic_required",
            "Clinic visits are offered through a clinic. Add your clinic, or offer home visits.",
            status_code=422,
        )


def _audit(db: Session, owner: Owner, user_id: uuid.UUID, action: str, **details: str) -> None:
    audit.record(
        db,
        action,
        actor_user_id=user_id,
        target_type=owner.type.value,
        target_id=owner.id,
        details=details,
    )


# --- services -----------------------------------------------------------------------


def list_services(db: Session, owner: Owner) -> list[Service]:
    stmt = (
        select(Service)
        .where(owner.filter(Service), Service.archived_at.is_(None))
        .order_by(Service.active.desc(), Service.created_at)
    )
    return list(db.scalars(stmt))


def get_service(db: Session, owner: Owner, service_id: uuid.UUID) -> Service:
    service = db.get(Service, service_id)
    if service is None or service.archived_at is not None or not _owned(owner, service):
        raise AppError("not_found", "Service not found.", status_code=404)
    return service


def _owned(owner: Owner, row: Service | AvailabilityException) -> bool:
    return (row.clinic_id if owner.is_clinic else row.provider_profile_id) == owner.id


def create_service(db: Session, owner: Owner, user_id: uuid.UUID, data: ServiceCreate) -> Service:
    _check_mode(owner, data.service_mode)
    count = db.scalar(
        select(func.count())
        .select_from(Service)
        .where(owner.filter(Service), Service.archived_at.is_(None))
    )
    if (count or 0) >= MAX_SERVICES:
        raise AppError("service_limit_reached", f"Up to {MAX_SERVICES} services.", status_code=409)
    service = Service(
        **owner.fk(),
        category=data.category,
        title=data.title,
        description=data.description,
        price_minor=data.price_minor,
        currency="INR",
        duration_minutes=data.duration_minutes,
        service_mode=data.service_mode,
        confirmation_mode=data.confirmation_mode or DEFAULT_CONFIRMATION[data.service_mode],
        species=data.species or ["cat", "dog"],
        active=True if data.active is None else data.active,
    )
    db.add(service)
    db.flush()
    _audit(db, owner, user_id, "service.created", service_id=str(service.id))
    return service


def update_service(
    db: Session, owner: Owner, user_id: uuid.UUID, service_id: uuid.UUID, data: ServiceUpdate
) -> Service:
    service = get_service(db, owner, service_id)
    changes = data.changes()
    if "service_mode" in changes:
        _check_mode(owner, changes["service_mode"])
    for field, value in changes.items():
        setattr(service, field, value)
    db.flush()
    _audit(db, owner, user_id, "service.updated", service_id=str(service.id))
    return service


def archive_service(db: Session, owner: Owner, user_id: uuid.UUID, service_id: uuid.UUID) -> None:
    """Archive rather than delete: past bookings keep referring to the service."""
    service = get_service(db, owner, service_id)
    service.archived_at = utcnow()
    service.active = False
    _audit(db, owner, user_id, "service.archived", service_id=str(service.id))


# --- weekly hours -----------------------------------------------------------------------


def list_rules(db: Session, owner: Owner) -> list[AvailabilityRule]:
    stmt = (
        select(AvailabilityRule)
        .where(owner.filter(AvailabilityRule))
        .order_by(AvailabilityRule.weekday, AvailabilityRule.start_time)
    )
    return list(db.scalars(stmt))


def replace_rules(
    db: Session, owner: Owner, user_id: uuid.UUID, rules: list[RuleIn]
) -> list[AvailabilityRule]:
    by_day: dict[int, list[RuleIn]] = {}
    for rule in rules:
        by_day.setdefault(rule.weekday, []).append(rule)
    for weekday, day_rules in by_day.items():
        if len(day_rules) > MAX_RANGES_PER_DAY:
            raise AppError(
                "too_many_ranges",
                f"Up to {MAX_RANGES_PER_DAY} time ranges per day.",
                status_code=422,
            )
        if overlaps([(r.start_time, r.end_time) for r in day_rules]):
            raise AppError(
                "overlapping_hours",
                "Opening hours on the same day can't overlap.",
                status_code=422,
                details={"weekday": weekday},
            )
    db.execute(delete(AvailabilityRule).where(owner.filter(AvailabilityRule)))
    for rule in rules:
        db.add(
            AvailabilityRule(
                **owner.fk(),
                weekday=rule.weekday,
                start_time=rule.start_time,
                end_time=rule.end_time,
                capacity=rule.capacity,
            )
        )
    db.flush()
    _audit(db, owner, user_id, "availability.updated", ranges=str(len(rules)))
    return list_rules(db, owner)


# --- date exceptions -------------------------------------------------------------------


def _today(owner: Owner) -> date:
    return utcnow().astimezone(ZoneInfo(owner.timezone)).date()


def list_exceptions(
    db: Session, owner: Owner, *, from_date: date | None = None
) -> list[AvailabilityException]:
    start = from_date or _today(owner)
    stmt = (
        select(AvailabilityException)
        .where(owner.filter(AvailabilityException), AvailabilityException.on_date >= start)
        .order_by(AvailabilityException.on_date, AvailabilityException.start_time)
    )
    return list(db.scalars(stmt))


def add_exception(
    db: Session, owner: Owner, user_id: uuid.UUID, data: ExceptionIn
) -> AvailabilityException:
    today = _today(owner)
    if data.on_date < today or data.on_date > today + timedelta(days=365):
        raise AppError(
            "invalid_date", "Choose a date between today and a year from now.", status_code=422
        )
    same_day = [
        e for e in list_exceptions(db, owner, from_date=data.on_date) if e.on_date == data.on_date
    ]
    if any(e.kind == ExceptionKind.CLOSED for e in same_day):
        raise AppError("already_closed", "That day is already marked as closed.", status_code=409)
    if data.kind is ExceptionKind.CLOSED and same_day:
        raise AppError(
            "has_special_hours",
            "Remove the special hours for that day before closing it.",
            status_code=409,
        )
    if data.kind is ExceptionKind.CUSTOM_HOURS:
        if data.start_time is None or data.end_time is None:  # pragma: no cover - schema-validated
            raise AppError("validation_error", "Special hours need times.", status_code=422)
        ranges = [(e.start_time, e.end_time) for e in same_day if e.start_time and e.end_time]
        if overlaps([*ranges, (data.start_time, data.end_time)]):
            raise AppError(
                "overlapping_hours", "Special hours on that day overlap.", status_code=422
            )
    exception = AvailabilityException(
        **owner.fk(),
        on_date=data.on_date,
        kind=data.kind,
        start_time=data.start_time,
        end_time=data.end_time,
        capacity=data.capacity,
        note=data.note,
    )
    db.add(exception)
    db.flush()
    _audit(db, owner, user_id, "availability.exception_added", on_date=data.on_date.isoformat())
    return exception


def delete_exception(
    db: Session, owner: Owner, user_id: uuid.UUID, exception_id: uuid.UUID
) -> None:
    exception = db.get(AvailabilityException, exception_id)
    if exception is None or not _owned(owner, exception):
        raise AppError("not_found", "Not found.", status_code=404)
    db.delete(exception)
    _audit(
        db, owner, user_id, "availability.exception_removed", on_date=exception.on_date.isoformat()
    )


# --- slots ----------------------------------------------------------------------------------


def preview_slots(
    db: Session, owner: Owner, service_id: uuid.UUID, on: date, *, now: datetime | None = None
) -> list[Slot]:
    service = get_service(db, owner, service_id)
    today = _today(owner)
    if on < today or on > today + timedelta(days=HORIZON_DAYS):
        raise AppError(
            "invalid_date", f"Choose a date within the next {HORIZON_DAYS} days.", status_code=422
        )
    if not service.active:
        return []
    exceptions = [e for e in list_exceptions(db, owner, from_date=on) if e.on_date == on]
    windows = windows_for_date(on, list_rules(db, owner), exceptions)
    return generate_slots(
        on,
        windows,
        timezone=owner.timezone,
        duration_minutes=service.duration_minutes,
        now=now or utcnow(),
    )
