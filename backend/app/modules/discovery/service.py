"""Discovery: search and public detail for verified clinics and home-visit vets.

Who can appear (doc 13, phase-2 safety rules):
- verification_status = verified and status = active;
- at least one active, non-archived service (vets: home visits);
- a location: exact coordinates, or a launch area (its centre, flagged approximate).

Clinics match when they are within the search radius. Home-visit vets match when
the search origin is inside *their* service radius; their base coordinates are
never returned, only the area name and radius.
"""

from __future__ import annotations

import math
import uuid
from collections import defaultdict
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import ColumnElement, and_, or_, select
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.core.errors import AppError
from app.modules.catalog.models import (
    AvailabilityException,
    AvailabilityRule,
    OwnerType,
    Service,
    ServiceCategory,
    ServiceMode,
)
from app.modules.catalog.owners import Owner
from app.modules.catalog.slots import HORIZON_DAYS, Slot, generate_slots, windows_for_date
from app.modules.clinics.models import Clinic, ClinicMember, MemberRole
from app.modules.discovery.areas import (
    AREA_SPREAD_KM,
    AREAS,
    DEFAULT_SERVICE_RADIUS_KM,
    AreaKey,
    distance_km,
)
from app.modules.discovery.schemas import (
    Badge,
    ClinicDetail,
    ClinicRef,
    Closure,
    DayHours,
    DoctorOut,
    HoursRange,
    KindFilter,
    Listing,
    ListingKind,
    Origin,
    PublicService,
    SortOrder,
    VetDetail,
)
from app.modules.providers.models import ProviderProfile, ProviderType
from app.modules.verification.status import ActiveStatus, VerificationStatus

VET_TIMEZONE = "Asia/Kolkata"
NEXT_SLOT_DAYS = 7
CLOSURE_DAYS = 14
# Upper bound for a vet's service radius (the DB allows up to 50 km).
_MAX_VET_RADIUS_KM = 50.0

CLINIC_CHECKS = ["Business registration (shop & establishment or trade licence)"]
VET_CHECKS = ["Identity"]


def _not_found() -> AppError:
    return AppError("not_found", "We couldn't find that listing.", status_code=404)


# ---------------------------------------------------------------- origin


def make_origin(
    area_key: AreaKey | None, latitude: float | None, longitude: float | None
) -> Origin | None:
    """Device coordinates win over an area; neither means no origin."""
    if (latitude is None) != (longitude is None):
        raise AppError("validation_error", "Send latitude and longitude together.", status_code=422)
    if latitude is not None and longitude is not None:
        return Origin(latitude=latitude, longitude=longitude, area_key=None, label="Near you")
    if area_key is not None:
        area = AREAS[area_key]
        return Origin(
            latitude=area.latitude, longitude=area.longitude, area_key=area.key, label=area.name
        )
    return None


def require_origin(origin: Origin | None) -> Origin:
    if origin is None:
        raise AppError(
            "location_required",
            "Choose an area or share your location to search.",
            status_code=422,
        )
    return origin


# ---------------------------------------------------------------- filters


@dataclass(frozen=True)
class Filters:
    kind: KindFilter = KindFilter.ALL
    category: ServiceCategory | None = None
    mode: ServiceMode | None = None
    species: str | None = None
    price_max_minor: int | None = None
    open_now: bool = False
    emergency: bool = False
    q: str | None = None
    sort: SortOrder = SortOrder.DISTANCE

    def service_matches(self, service: Service) -> bool:
        return (
            (self.category is None or service.category == self.category)
            and (self.mode is None or service.service_mode == self.mode)
            and (self.species is None or self.species in service.species)
            and (self.price_max_minor is None or service.price_minor <= self.price_max_minor)
        )


# ---------------------------------------------------------------- loading


@dataclass
class _Schedule:
    rules: list[AvailabilityRule] = field(default_factory=list)
    exceptions: list[AvailabilityException] = field(default_factory=list)


def _owner_key(row: Service | AvailabilityRule | AvailabilityException) -> uuid.UUID:
    owner = row.clinic_id or row.provider_profile_id
    if owner is None:  # impossible: the one-owner check constraint forbids it
        raise RuntimeError("catalog row without an owner")
    return owner


def _services_by_owner(
    db: Session, clinic_ids: Sequence[uuid.UUID], vet_ids: Sequence[uuid.UUID]
) -> dict[uuid.UUID, list[Service]]:
    if not clinic_ids and not vet_ids:
        return {}
    rows = db.scalars(
        select(Service)
        .where(
            Service.active.is_(True),
            Service.archived_at.is_(None),
            or_(Service.clinic_id.in_(clinic_ids), Service.provider_profile_id.in_(vet_ids)),
        )
        .order_by(Service.price_minor, Service.title)
    )
    grouped: dict[uuid.UUID, list[Service]] = defaultdict(list)
    for row in rows:
        grouped[_owner_key(row)].append(row)
    return grouped


def _schedules(
    db: Session, owner_ids: Sequence[uuid.UUID], from_date: date, to_date: date
) -> dict[uuid.UUID, _Schedule]:
    schedules: dict[uuid.UUID, _Schedule] = defaultdict(_Schedule)
    if not owner_ids:
        return schedules
    owned_rule = or_(
        AvailabilityRule.clinic_id.in_(owner_ids),
        AvailabilityRule.provider_profile_id.in_(owner_ids),
    )
    for rule in db.scalars(
        select(AvailabilityRule).where(owned_rule).order_by(AvailabilityRule.start_time)
    ):
        schedules[_owner_key(rule)].rules.append(rule)
    owned_exception = or_(
        AvailabilityException.clinic_id.in_(owner_ids),
        AvailabilityException.provider_profile_id.in_(owner_ids),
    )
    for exc in db.scalars(
        select(AvailabilityException)
        .where(
            owned_exception,
            AvailabilityException.on_date >= from_date,
            AvailabilityException.on_date <= to_date,
        )
        .order_by(AvailabilityException.on_date, AvailabilityException.start_time)
    ):
        schedules[_owner_key(exc)].exceptions.append(exc)
    return schedules


def _bbox(origin: Origin, radius_km: float) -> tuple[float, float, float, float]:
    dlat = radius_km / 111.0
    dlng = radius_km / (111.32 * max(math.cos(math.radians(origin.latitude)), 0.01))
    return (
        origin.latitude - dlat,
        origin.latitude + dlat,
        origin.longitude - dlng,
        origin.longitude + dlng,
    )


def _nearby_areas(origin: Origin, radius_km: float) -> list[str]:
    return [
        area.key.value
        for area in AREAS.values()
        if distance_km(origin.latitude, origin.longitude, area.latitude, area.longitude)
        <= radius_km + AREA_SPREAD_KM
    ]


def _located_near(
    model: type[Clinic] | type[ProviderProfile], origin: Origin, radius_km: float
) -> ColumnElement[bool]:
    """SQL pre-filter: a coordinate bounding box, or an area that could be in range."""
    lat_min, lat_max, lng_min, lng_max = _bbox(origin, radius_km)
    return or_(
        and_(
            model.latitude.between(lat_min, lat_max),
            model.longitude.between(lng_min, lng_max),
        ),
        and_(model.latitude.is_(None), model.area_key.in_(_nearby_areas(origin, radius_km))),
    )


def _point(row: Clinic | ProviderProfile) -> tuple[float, float, bool] | None:
    """(lat, lng, approximate) from exact coordinates, else the area centre."""
    if row.latitude is not None and row.longitude is not None:
        return float(row.latitude), float(row.longitude), False
    if row.area_key and row.area_key in AREAS:
        area = AREAS[AreaKey(row.area_key)]
        return area.latitude, area.longitude, True
    return None


def _area_name(area_key: str | None) -> str | None:
    if area_key and area_key in AREAS:
        return AREAS[AreaKey(area_key)].name
    return None


# ---------------------------------------------------------------- schedule maths


def _local_now(timezone: str, now: datetime) -> datetime:
    return now.astimezone(ZoneInfo(timezone))


def is_open_now(schedule: _Schedule, timezone: str, now: datetime) -> bool:
    local = _local_now(timezone, now)
    windows = windows_for_date(local.date(), schedule.rules, schedule.exceptions)
    current = local.time().replace(tzinfo=None)
    return any(w.start <= current < w.end for w in windows)


def next_slot(
    schedule: _Schedule, timezone: str, duration_minutes: int, now: datetime
) -> datetime | None:
    today = _local_now(timezone, now).date()
    for offset in range(NEXT_SLOT_DAYS + 1):  # today plus the next 7 days
        on = today + timedelta(days=offset)
        windows = windows_for_date(on, schedule.rules, schedule.exceptions)
        slots = generate_slots(
            on, windows, timezone=timezone, duration_minutes=duration_minutes, now=now
        )
        if slots:
            return slots[0].start
    return None


def _week(rules: Iterable[AvailabilityRule]) -> list[DayHours]:
    by_day: dict[int, list[HoursRange]] = defaultdict(list)
    for rule in sorted(rules, key=lambda r: (r.weekday, r.start_time)):
        by_day[rule.weekday].append(HoursRange(start_time=rule.start_time, end_time=rule.end_time))
    return [DayHours(weekday=day, ranges=by_day.get(day, [])) for day in range(7)]


def _closures(exceptions: Iterable[AvailabilityException]) -> list[Closure]:
    return [
        Closure(on_date=e.on_date, kind=e.kind, start_time=e.start_time, end_time=e.end_time)
        for e in exceptions
    ]


def _public_service(service: Service) -> PublicService:
    return PublicService(
        id=service.id,
        category=service.category,
        title=service.title,
        description=service.description,
        price_minor=service.price_minor,
        currency="INR",
        duration_minutes=service.duration_minutes,
        service_mode=service.service_mode,
        confirmation_mode=service.confirmation_mode,
        species=list(service.species),
    )


def _unique[T](values: Iterable[T]) -> list[T]:
    seen: list[T] = []
    for value in values:
        if value not in seen:
            seen.append(value)
    return seen


# ---------------------------------------------------------------- search


@dataclass
class _Candidate:
    listing: Listing
    sort_distance: float
    schedule_key: uuid.UUID
    timezone: str
    shortest_minutes: int


def _verified_clinics() -> ColumnElement[bool]:
    return and_(
        Clinic.verification_status == VerificationStatus.VERIFIED,
        Clinic.status == ActiveStatus.ACTIVE,
    )


def _verified_vets() -> ColumnElement[bool]:
    return and_(
        ProviderProfile.provider_type == ProviderType.VETERINARIAN,
        ProviderProfile.verification_status == VerificationStatus.VERIFIED,
        ProviderProfile.status == ActiveStatus.ACTIVE,
    )


def _text_match(q: str | None, *values: str | None) -> bool:
    if not q:
        return True
    needle = q.strip().lower()
    return any(v and needle in v.lower() for v in values)


def search(
    db: Session,
    origin: Origin,
    radius_km: int,
    filters: Filters,
    *,
    limit: int,
    offset: int,
    now: datetime | None = None,
) -> tuple[list[Listing], int]:
    now = now or utcnow()
    candidates: list[_Candidate] = []

    clinics: list[Clinic] = []
    if filters.kind in (KindFilter.ALL, KindFilter.CLINIC):
        query = select(Clinic).where(_verified_clinics(), _located_near(Clinic, origin, radius_km))
        if filters.emergency:
            query = query.where(Clinic.emergency_services.is_(True))
        clinics = list(db.scalars(query))

    vets: list[ProviderProfile] = []
    if filters.kind in (KindFilter.ALL, KindFilter.VET) and not filters.emergency:
        vets = list(
            db.scalars(
                select(ProviderProfile).where(
                    _verified_vets(), _located_near(ProviderProfile, origin, _MAX_VET_RADIUS_KM)
                )
            )
        )

    services = _services_by_owner(db, [c.id for c in clinics], [v.id for v in vets])

    for clinic in clinics:
        point = _point(clinic)
        matching = [s for s in services.get(clinic.id, []) if filters.service_matches(s)]
        if point is None or not matching:
            continue
        dist = distance_km(origin.latitude, origin.longitude, point[0], point[1])
        if dist > radius_km or not _text_match(filters.q, clinic.name, clinic.locality):
            continue
        candidates.append(
            _Candidate(
                listing=Listing(
                    kind=ListingKind.CLINIC,
                    id=clinic.id,
                    name=clinic.name,
                    subtitle=", ".join(p for p in (clinic.locality, clinic.city) if p),
                    area_name=_area_name(clinic.area_key),
                    distance_km=round(dist, 1),
                    distance_is_approximate=point[2],
                    service_radius_km=None,
                    verified_at=clinic.verified_at,
                    emergency=clinic.emergency_services,
                    modes=_unique(s.service_mode for s in matching),
                    categories=_unique(s.category for s in matching),
                    price_from_minor=min(s.price_minor for s in matching),
                    service_count=len(matching),
                    open_now=False,
                    next_slot_at=None,
                    languages=[],
                    years_experience=None,
                ),
                sort_distance=dist,
                schedule_key=clinic.id,
                timezone=clinic.timezone,
                shortest_minutes=min(s.duration_minutes for s in matching),
            )
        )

    for vet in vets:
        point = _point(vet)
        matching = [
            s
            for s in services.get(vet.id, [])
            if s.service_mode == ServiceMode.HOME_VISIT and filters.service_matches(s)
        ]
        if point is None or not matching:
            continue
        reach = vet.service_radius_km or DEFAULT_SERVICE_RADIUS_KM
        dist = distance_km(origin.latitude, origin.longitude, point[0], point[1])
        if dist > reach or not _text_match(filters.q, vet.display_name, vet.qualifications):
            continue
        candidates.append(
            _Candidate(
                listing=Listing(
                    kind=ListingKind.VET,
                    id=vet.id,
                    name=vet.display_name,
                    subtitle=vet.qualifications,
                    area_name=_area_name(vet.area_key),
                    distance_km=None,
                    distance_is_approximate=False,
                    service_radius_km=reach,
                    verified_at=vet.verified_at,
                    emergency=False,
                    modes=[ServiceMode.HOME_VISIT],
                    categories=_unique(s.category for s in matching),
                    price_from_minor=min(s.price_minor for s in matching),
                    service_count=len(matching),
                    open_now=False,
                    next_slot_at=None,
                    languages=list(vet.languages),
                    years_experience=vet.years_experience,
                ),
                sort_distance=dist,
                schedule_key=vet.id,
                timezone=VET_TIMEZONE,
                shortest_minutes=min(s.duration_minutes for s in matching),
            )
        )

    # Schedules: today for "open now" (all candidates), the week for the page's next slot.
    today = _local_now(VET_TIMEZONE, now).date()
    schedules = _schedules(
        db,
        [c.schedule_key for c in candidates],
        today - timedelta(days=1),
        today + timedelta(days=NEXT_SLOT_DAYS),
    )
    for candidate in candidates:
        candidate.listing.open_now = is_open_now(
            schedules[candidate.schedule_key], candidate.timezone, now
        )
    if filters.open_now:
        candidates = [c for c in candidates if c.listing.open_now]

    if filters.sort is SortOrder.PRICE:
        candidates.sort(
            key=lambda c: (c.listing.price_from_minor or 0, c.sort_distance, c.listing.name)
        )
    else:
        candidates.sort(key=lambda c: (c.sort_distance, c.listing.name))

    page = candidates[offset : offset + limit]
    for candidate in page:
        candidate.listing.next_slot_at = next_slot(
            schedules[candidate.schedule_key],
            candidate.timezone,
            candidate.shortest_minutes,
            now,
        )
    return [c.listing for c in page], len(candidates)


# ---------------------------------------------------------------- detail


def _public_clinic(db: Session, clinic_id: uuid.UUID) -> Clinic:
    clinic = db.scalars(select(Clinic).where(Clinic.id == clinic_id, _verified_clinics())).first()
    if clinic is None:
        raise _not_found()
    return clinic


def _public_vet(db: Session, profile_id: uuid.UUID) -> ProviderProfile:
    vet = db.scalars(
        select(ProviderProfile).where(ProviderProfile.id == profile_id, _verified_vets())
    ).first()
    if vet is None:
        raise _not_found()
    return vet


def _listed_services(db: Session, owner_id: uuid.UUID, *, vet: bool) -> list[Service]:
    services = _services_by_owner(db, [] if vet else [owner_id], [owner_id] if vet else []).get(
        owner_id, []
    )
    if vet:
        services = [s for s in services if s.service_mode == ServiceMode.HOME_VISIT]
    if not services:
        raise _not_found()  # nothing bookable means not listed
    return services


def clinic_detail(
    db: Session, clinic_id: uuid.UUID, origin: Origin | None, *, now: datetime | None = None
) -> ClinicDetail:
    now = now or utcnow()
    clinic = _public_clinic(db, clinic_id)
    services = _listed_services(db, clinic.id, vet=False)
    point = _point(clinic)
    if point is None:
        raise _not_found()
    today = _local_now(clinic.timezone, now).date()
    schedule = _schedules(
        db, [clinic.id], today - timedelta(days=1), today + timedelta(days=CLOSURE_DAYS)
    )[clinic.id]

    doctor_users = select(ClinicMember.user_id).where(
        ClinicMember.clinic_id == clinic.id,
        ClinicMember.member_role == MemberRole.VETERINARIAN,
        ClinicMember.removed_at.is_(None),
    )
    doctors = db.scalars(
        select(ProviderProfile)
        .where(_verified_vets(), ProviderProfile.user_id.in_(doctor_users))
        .order_by(ProviderProfile.display_name)
    )
    exact = not point[2]
    return ClinicDetail(
        id=clinic.id,
        name=clinic.name,
        description=clinic.description,
        address_line1=clinic.address_line1,
        address_line2=clinic.address_line2,
        locality=clinic.locality,
        city=clinic.city,
        state=clinic.state,
        postal_code=clinic.postal_code,
        latitude=point[0] if exact else None,
        longitude=point[1] if exact else None,
        distance_km=(
            round(distance_km(origin.latitude, origin.longitude, point[0], point[1]), 1)
            if origin
            else None
        ),
        distance_is_approximate=point[2],
        area_name=_area_name(clinic.area_key),
        timezone=clinic.timezone,
        emergency_services=clinic.emergency_services,
        badge=Badge(verified_at=clinic.verified_at, checks=CLINIC_CHECKS),
        open_now=is_open_now(schedule, clinic.timezone, now),
        hours=_week(schedule.rules),
        closures=_closures(e for e in schedule.exceptions if e.on_date >= today),
        services=[_public_service(s) for s in services],
        doctors=[
            DoctorOut(
                id=d.id,
                display_name=d.display_name,
                qualifications=d.qualifications,
                years_experience=d.years_experience,
                languages=list(d.languages),
            )
            for d in doctors
        ],
    )


def _vet_checks(vet: ProviderProfile) -> list[str]:
    council = vet.registration_council or "the state veterinary council"
    return [*VET_CHECKS, f"Registration with {council}"]


def vet_detail(
    db: Session, profile_id: uuid.UUID, origin: Origin | None, *, now: datetime | None = None
) -> VetDetail:
    now = now or utcnow()
    vet = _public_vet(db, profile_id)
    services = _listed_services(db, vet.id, vet=True)
    point = _point(vet)
    if point is None:
        raise _not_found()
    reach = vet.service_radius_km or DEFAULT_SERVICE_RADIUS_KM
    today = _local_now(VET_TIMEZONE, now).date()
    schedule = _schedules(
        db, [vet.id], today - timedelta(days=1), today + timedelta(days=CLOSURE_DAYS)
    )[vet.id]
    practice_ids = select(ClinicMember.clinic_id).where(
        ClinicMember.user_id == vet.user_id,
        ClinicMember.member_role == MemberRole.VETERINARIAN,
        ClinicMember.removed_at.is_(None),
    )
    practices = db.scalars(
        select(Clinic).where(_verified_clinics(), Clinic.id.in_(practice_ids)).order_by(Clinic.name)
    )
    return VetDetail(
        id=vet.id,
        display_name=vet.display_name,
        bio=vet.bio,
        qualifications=vet.qualifications,
        years_experience=vet.years_experience,
        languages=list(vet.languages),
        area_name=_area_name(vet.area_key),
        service_radius_km=reach,
        visits_you=(
            distance_km(origin.latitude, origin.longitude, point[0], point[1]) <= reach
            if origin
            else None
        ),
        timezone=VET_TIMEZONE,
        badge=Badge(verified_at=vet.verified_at, checks=_vet_checks(vet)),
        open_now=is_open_now(schedule, VET_TIMEZONE, now),
        hours=_week(schedule.rules),
        closures=_closures(e for e in schedule.exceptions if e.on_date >= today),
        services=[_public_service(s) for s in services],
        clinics=[
            ClinicRef(id=c.id, name=c.name, locality=c.locality, city=c.city) for c in practices
        ],
    )


# ---------------------------------------------------------------- public slots


def public_owner(db: Session, kind: ListingKind, owner_id: uuid.UUID) -> Owner:
    """The Owner for a listed clinic or vet (404 when not publicly listed)."""
    if kind is ListingKind.CLINIC:
        clinic = _public_clinic(db, owner_id)
        return Owner(OwnerType.CLINIC, clinic.id, clinic.timezone, clinic.name)
    vet = _public_vet(db, owner_id)
    return Owner(OwnerType.PROVIDER_PROFILE, vet.id, VET_TIMEZONE, vet.display_name)


def public_slots(
    db: Session,
    kind: ListingKind,
    owner_id: uuid.UUID,
    service_id: uuid.UUID,
    on: date,
    *,
    now: datetime | None = None,
) -> tuple[Owner, list[Slot]]:
    now = now or utcnow()
    owner = public_owner(db, kind, owner_id)
    service = db.scalars(
        select(Service).where(
            Service.id == service_id,
            owner.filter(Service),
            Service.active.is_(True),
            Service.archived_at.is_(None),
        )
    ).first()
    if service is None or (
        kind is ListingKind.VET and service.service_mode != ServiceMode.HOME_VISIT
    ):
        raise _not_found()
    today = _local_now(owner.timezone, now).date()
    if on < today or on > today + timedelta(days=HORIZON_DAYS):
        raise AppError(
            "invalid_date", f"Choose a date within the next {HORIZON_DAYS} days.", status_code=422
        )
    schedule = _schedules(db, [owner.id], on, on)[owner.id]
    windows = windows_for_date(on, schedule.rules, schedule.exceptions)
    return owner, generate_slots(
        on, windows, timezone=owner.timezone, duration_minutes=service.duration_minutes, now=now
    )
