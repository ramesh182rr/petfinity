"""Discovery API (milestone 2.5): launch areas, search and public listing detail.

Signed-in users only, like the rest of the app. Only verified, active listings
with something bookable are ever returned (doc 13).
"""

from __future__ import annotations

import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbSession
from app.core.errors import error_responses
from app.modules.catalog.models import ServiceCategory, ServiceMode
from app.modules.discovery import service as discovery
from app.modules.discovery.areas import (
    DEFAULT_RADIUS_KM,
    LAUNCH_AREAS,
    MAX_RADIUS_KM,
    SERVICE_RADIUS_CHOICES,
    AreaKey,
)
from app.modules.discovery.schemas import (
    AreaOut,
    AreasResponse,
    ClinicDetail,
    KindFilter,
    ListingKind,
    PublicSlot,
    PublicSlots,
    SearchResponse,
    SortOrder,
    VetDetail,
)

router = APIRouter(prefix="/discover", tags=["discover"])
_ERRORS = error_responses(401, 404, 422)

Lat = Annotated[float | None, Query(ge=-90, le=90)]
Lng = Annotated[float | None, Query(ge=-180, le=180)]


@router.get("/areas", response_model=AreasResponse, responses=_ERRORS, summary="Launch areas")
def list_areas(_: CurrentUser) -> AreasResponse:
    return AreasResponse(
        areas=[
            AreaOut(
                key=a.key, name=a.name, state=a.state, latitude=a.latitude, longitude=a.longitude
            )
            for a in LAUNCH_AREAS
        ],
        default_radius_km=DEFAULT_RADIUS_KM,
        max_radius_km=MAX_RADIUS_KM,
        service_radius_choices_km=list(SERVICE_RADIUS_CHOICES),
    )


@router.get(
    "/search",
    response_model=SearchResponse,
    responses=_ERRORS,
    summary="Search verified clinics and home-visit vets near an area or the device",
)
def search(
    _: CurrentUser,
    db: DbSession,
    area: AreaKey | None = None,
    lat: Lat = None,
    lng: Lng = None,
    radius_km: Annotated[int, Query(ge=1, le=MAX_RADIUS_KM)] = DEFAULT_RADIUS_KM,
    kind: KindFilter = KindFilter.ALL,
    category: ServiceCategory | None = None,
    mode: ServiceMode | None = None,
    species: Annotated[str | None, Query(max_length=16)] = None,
    price_max_minor: Annotated[int | None, Query(ge=0, le=10_000_000)] = None,
    open_now: bool = False,
    emergency: bool = False,
    q: Annotated[str | None, Query(max_length=60)] = None,
    sort: SortOrder = SortOrder.DISTANCE,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    offset: Annotated[int, Query(ge=0, le=1000)] = 0,
) -> SearchResponse:
    origin = discovery.require_origin(discovery.make_origin(area, lat, lng))
    filters = discovery.Filters(
        kind=kind,
        category=category,
        mode=mode,
        species=species.lower() if species else None,
        price_max_minor=price_max_minor,
        open_now=open_now,
        emergency=emergency,
        q=q.strip() or None if q else None,
        sort=sort,
    )
    items, total = discovery.search(db, origin, radius_km, filters, limit=limit, offset=offset)
    return SearchResponse(items=items, total=total, origin=origin, radius_km=radius_km)


@router.get(
    "/clinics/{clinic_id}",
    response_model=ClinicDetail,
    responses=_ERRORS,
    summary="Public clinic detail (verified clinics only)",
)
def clinic_detail(
    clinic_id: uuid.UUID,
    user: CurrentUser,
    db: DbSession,
    area: AreaKey | None = None,
    lat: Lat = None,
    lng: Lng = None,
) -> ClinicDetail:
    return discovery.clinic_detail(
        db, clinic_id, discovery.make_origin(area, lat, lng), viewer_id=user.id
    )


@router.get(
    "/vets/{profile_id}",
    response_model=VetDetail,
    responses=_ERRORS,
    summary="Public home-visit vet detail (verified vets only; base location stays private)",
)
def vet_detail(
    profile_id: uuid.UUID,
    user: CurrentUser,
    db: DbSession,
    area: AreaKey | None = None,
    lat: Lat = None,
    lng: Lng = None,
) -> VetDetail:
    return discovery.vet_detail(
        db, profile_id, discovery.make_origin(area, lat, lng), viewer_id=user.id
    )


def _slots(
    db: DbSession, kind: ListingKind, owner_id: uuid.UUID, service_id: uuid.UUID, on: date
) -> PublicSlots:
    owner, slots = discovery.public_slots(db, kind, owner_id, service_id, on)
    return PublicSlots(
        date=on,
        timezone=owner.timezone,
        service_id=service_id,
        slots=[
            PublicSlot(start=s.start, end=s.end, local_start=s.local_start.strftime("%H:%M"))
            for s in slots
        ],
    )


@router.get(
    "/clinics/{clinic_id}/slots",
    response_model=PublicSlots,
    responses=_ERRORS,
    summary="Open slots for one of a clinic's services on a date",
)
def clinic_slots(
    clinic_id: uuid.UUID,
    user: CurrentUser,
    db: DbSession,
    service_id: uuid.UUID,
    on: Annotated[date, Query(alias="date")],
) -> PublicSlots:
    return _slots(db, ListingKind.CLINIC, clinic_id, service_id, on)


@router.get(
    "/vets/{profile_id}/slots",
    response_model=PublicSlots,
    responses=_ERRORS,
    summary="Open slots for one of a vet's home-visit services on a date",
)
def vet_slots(
    profile_id: uuid.UUID,
    user: CurrentUser,
    db: DbSession,
    service_id: uuid.UUID,
    on: Annotated[date, Query(alias="date")],
) -> PublicSlots:
    return _slots(db, ListingKind.VET, profile_id, service_id, on)
