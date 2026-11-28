"""Caretaker workspace API (milestone 3.1). Requests and offers arrive in 3.2-3.3."""

from __future__ import annotations

import uuid
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.core import clock
from app.core.errors import error_responses
from app.modules.bookings.router import present_detail
from app.modules.bookings.schemas import BookingDetail, ViewerRole
from app.modules.bookings.service import Viewer
from app.modules.care import requests
from app.modules.care import service as care
from app.modules.care.models import (
    RATE_UNIT,
    CareOffer,
    CareOfferStatus,
    CareRequest,
    CareService,
    CareType,
)
from app.modules.care.schemas import (
    CareOfferOut,
    CarePetOut,
    CareRequestFeed,
    CareRequestForCaretaker,
    CareRequestIn,
    CareRequestList,
    CareRequestOut,
    CareServiceOut,
    CareServicesIn,
    CareWorkspace,
    MyOffer,
    OfferCaretaker,
    OfferIn,
)
from app.modules.discovery.areas import AREAS, AreaKey
from app.modules.notifications.router import push_after_response
from app.modules.pets.models import Pet
from app.modules.providers.models import ProviderProfile
from app.modules.reviews import service as review_service

router = APIRouter(prefix="/manage/provider_profile/{profile_id}", tags=["care"])
_ERRORS = error_responses(401, 404, 409, 422)


def _out(row: CareService) -> CareServiceOut:
    return CareServiceOut(
        id=row.id,
        care_type=row.care_type,
        rate_minor=row.rate_minor,
        rate_unit=RATE_UNIT[CareType(row.care_type)],
        species=list(row.species),
        max_pets=row.max_pets,
        notes=row.notes,
        active=row.active,
        updated_at=row.updated_at,
    )


def _workspace(db: DbSession, user_id: uuid.UUID, profile_id: uuid.UUID) -> CareWorkspace:
    profile = care.caretaker_owned(db, user_id, profile_id)
    services = care.list_services(db, profile.id)
    missing = care.missing(profile, services)
    return CareWorkspace(
        services=[_out(s) for s in services], missing=missing, receiving_requests=not missing
    )


@router.get(
    "/care",
    response_model=CareWorkspace,
    responses=_ERRORS,
    summary="Caretaker: care services and what's still needed before requests arrive",
)
def get_care(profile_id: uuid.UUID, db: DbSession, user: CurrentUser) -> CareWorkspace:
    return _workspace(db, user.id, profile_id)


@router.put(
    "/care/services",
    response_model=CareWorkspace,
    responses=_ERRORS,
    summary="Caretaker: replace the offered care types, rates and limits",
)
def put_services(
    profile_id: uuid.UUID, data: CareServicesIn, db: DbSession, user: CurrentUser
) -> CareWorkspace:
    care.replace_services(db, user.id, profile_id, data)
    db.commit()
    return _workspace(db, user.id, profile_id)


# ---------------------------------------------------------------- requests and offers (3.2-3.3)


def _pet_out(pet: Pet, today: date) -> CarePetOut:
    age = None
    if pet.date_of_birth is not None:
        age = max(
            0,
            today.year
            - pet.date_of_birth.year
            - ((today.month, today.day) < (pet.date_of_birth.month, pet.date_of_birth.day)),
        )
    return CarePetOut(
        id=pet.id,
        name=pet.name,
        species=pet.species,
        breed=pet.breed,
        sex=pet.sex,
        age_years=age,
        weight_kg=float(pet.weight_kg) if pet.weight_kg is not None else None,
        neutered=pet.neutered,
        temperament=pet.temperament,
    )


def _area_name(key: str | None) -> str | None:
    return AREAS[AreaKey(key)].name if key in AREAS else None


def owner_view(db: DbSession, items: list[CareRequest]) -> list[CareRequestOut]:
    now = clock.utcnow()
    today = now.astimezone(requests.TZ).date()
    ids = [r.id for r in items]
    pets = requests.request_pets(db, ids)
    counts = requests.pending_counts(db, ids)
    bookings_by = requests.booking_ids(db, ids)
    offers_by: dict[uuid.UUID, list[CareOffer]] = {i: [] for i in ids}
    if ids:
        for offer in db.scalars(
            select(CareOffer)
            .where(CareOffer.request_id.in_(ids), CareOffer.status != CareOfferStatus.WITHDRAWN)
            .order_by(CareOffer.price_minor, CareOffer.created_at)
        ):
            offers_by[offer.request_id].append(offer)
    profile_ids = list({o.provider_profile_id for os_ in offers_by.values() for o in os_})
    profiles = {
        p.id: p
        for p in db.scalars(select(ProviderProfile).where(ProviderProfile.id.in_(profile_ids)))
    }
    ratings = review_service.summaries(db, profile_ids)
    completed = requests.completed_care_counts(db, profile_ids)
    rates = {
        (s.provider_profile_id, s.care_type): s.rate_minor
        for s in db.scalars(
            select(CareService).where(CareService.provider_profile_id.in_(profile_ids))
        )
    }

    def caretaker(profile_id: uuid.UUID, care_type: str) -> OfferCaretaker:
        p = profiles[profile_id]
        rated = ratings.get(p.id)
        return OfferCaretaker(
            id=p.id,
            display_name=p.display_name,
            years_experience=p.years_experience,
            languages=list(p.languages),
            bio=p.bio,
            area_name=_area_name(p.area_key),
            verified_at=p.verified_at,
            rating=rated.rating if rated else None,
            review_count=rated.count if rated else 0,
            completed_care=completed.get(p.id, 0),
            home_type=p.home_type,
            outdoor_space=p.outdoor_space,
            pets_at_home=p.pets_at_home,
            rate_minor=rates.get((p.id, care_type)),
        )

    out = []
    for r in items:
        out.append(
            CareRequestOut(
                id=r.id,
                care_type=r.care_type,
                status=r.status,
                start_at=r.start_at,
                end_at=r.end_at,
                visits_per_day=r.visits_per_day,
                units=requests.units_for(r.care_type, r.start_at, r.end_at, r.visits_per_day),
                unit=requests.unit_of(r.care_type),
                pets=[_pet_out(p, today) for p in pets.get(r.id, [])],
                area_key=r.area_key,
                area_name=_area_name(r.area_key),
                locality=r.locality,
                address=r.address,
                latitude=float(r.latitude) if r.latitude is not None else None,
                longitude=float(r.longitude) if r.longitude is not None else None,
                notes=r.notes,
                budget_minor=r.budget_minor,
                offers_close_at=r.offers_close_at,
                accepting_offers=requests.accepting_offers(r, counts.get(r.id, 0), now),
                offer_count=len(offers_by[r.id]),
                offers=[
                    CareOfferOut(
                        id=o.id,
                        status=o.status,
                        price_minor=o.price_minor,
                        message=o.message,
                        created_at=o.created_at,
                        updated_at=o.updated_at,
                        caretaker=caretaker(o.provider_profile_id, r.care_type),
                    )
                    for o in offers_by[r.id]
                ],
                booking_id=bookings_by.get(r.id),
                created_at=r.created_at,
            )
        )
    return out


def caretaker_view(
    db: DbSession, ct: requests.Caretaker, items: list[CareRequest]
) -> list[CareRequestForCaretaker]:
    now = clock.utcnow()
    today = now.astimezone(requests.TZ).date()
    ids = [r.id for r in items]
    pets = requests.request_pets(db, ids)
    counts = requests.pending_counts(db, ids)
    mine = {
        o.request_id: o
        for o in db.scalars(
            select(CareOffer).where(
                CareOffer.request_id.in_(ids), CareOffer.provider_profile_id == ct.profile.id
            )
        )
    }
    accepted_bookings = requests.booking_ids(db, ids)
    out = []
    for r in items:
        units = requests.units_for(r.care_type, r.start_at, r.end_at, r.visits_per_day)
        service = ct.services.get(r.care_type)
        offer = mine.get(r.id)
        won = offer is not None and offer.status == CareOfferStatus.ACCEPTED
        out.append(
            CareRequestForCaretaker(
                id=r.id,
                care_type=r.care_type,
                status=r.status,
                start_at=r.start_at,
                end_at=r.end_at,
                visits_per_day=r.visits_per_day,
                units=units,
                unit=requests.unit_of(r.care_type),
                pets=[_pet_out(p, today) for p in pets.get(r.id, [])],
                area_name=_area_name(r.area_key),
                locality=r.locality,
                distance_km=requests.round_km(requests.distance_to(ct.profile, r)),
                notes=r.notes,
                budget_minor=r.budget_minor,
                offers_close_at=r.offers_close_at,
                accepting_offers=requests.accepting_offers(r, counts.get(r.id, 0), now),
                offer_count=counts.get(r.id, 0),
                suggested_price_minor=service.rate_minor * units if service else None,
                my_offer=(
                    MyOffer(
                        id=offer.id,
                        status=offer.status,
                        price_minor=offer.price_minor,
                        message=offer.message,
                        updated_at=offer.updated_at,
                    )
                    if offer
                    else None
                ),
                booking_id=accepted_bookings.get(r.id) if won else None,
            )
        )
    return out


parent_router = APIRouter(
    prefix="/care-requests", tags=["care"], dependencies=[Depends(push_after_response)]
)


@parent_router.post(
    "",
    response_model=CareRequestOut,
    status_code=status.HTTP_201_CREATED,
    responses=_ERRORS,
    summary="Post a care request to nearby verified caretakers",
)
def create_request(data: CareRequestIn, db: DbSession, user: CurrentUser) -> CareRequestOut:
    request = requests.create(db, user.id, data)
    db.commit()
    return owner_view(db, [request])[0]


@parent_router.get(
    "", response_model=CareRequestList, responses=_ERRORS, summary="My care requests"
)
def my_requests(
    db: DbSession, user: CurrentUser, scope: Literal["active", "past"] = "active"
) -> CareRequestList:
    items = requests.list_mine(db, user.id, scope)
    db.commit()
    return CareRequestList(items=owner_view(db, items))


@parent_router.get(
    "/{request_id}", response_model=CareRequestOut, responses=_ERRORS, summary="My care request"
)
def my_request(request_id: uuid.UUID, db: DbSession, user: CurrentUser) -> CareRequestOut:
    requests.owned(db, user.id, request_id)
    requests.expire_due(db, clock.utcnow(), request_id=request_id)
    db.commit()
    return owner_view(db, [requests.owned(db, user.id, request_id)])[0]


@parent_router.post(
    "/{request_id}/cancel",
    response_model=CareRequestOut,
    responses=_ERRORS,
    summary="Withdraw an open request (pending offers are declined)",
)
def cancel_request(request_id: uuid.UUID, db: DbSession, user: CurrentUser) -> CareRequestOut:
    request = requests.cancel(db, user.id, request_id)
    db.commit()
    return owner_view(db, [request])[0]


@parent_router.post(
    "/{request_id}/offers/{offer_id}/accept",
    response_model=BookingDetail,
    status_code=status.HTTP_201_CREATED,
    responses=_ERRORS,
    summary="Accept an offer: creates a confirmed care booking and declines the rest",
)
def accept_offer(
    request_id: uuid.UUID, offer_id: uuid.UUID, response: Response, db: DbSession, user: CurrentUser
) -> BookingDetail:
    booking, replayed = requests.accept(db, user.id, request_id, offer_id)
    db.commit()
    if replayed:
        response.status_code = status.HTTP_200_OK
    return present_detail(db, booking, Viewer(user.id, ViewerRole.OWNER))


caretaker_router = APIRouter(
    prefix="/manage/provider_profile/{profile_id}/care/requests",
    tags=["care"],
    dependencies=[Depends(push_after_response)],
)


@caretaker_router.get(
    "",
    response_model=CareRequestFeed,
    responses=_ERRORS,
    summary="Caretaker: open requests you could take, or ones you've offered on",
)
def request_feed(
    profile_id: uuid.UUID,
    db: DbSession,
    user: CurrentUser,
    scope: Literal["open", "offered"] = "open",
) -> CareRequestFeed:
    ct = requests.caretaker_for(db, user.id, profile_id)
    items = requests.feed(db, ct, scope)
    db.commit()
    return CareRequestFeed(items=caretaker_view(db, ct, items))


@caretaker_router.get(
    "/{request_id}",
    response_model=CareRequestForCaretaker,
    responses=_ERRORS,
    summary="Caretaker: one request (area only; the address comes with a booking)",
)
def request_detail(
    profile_id: uuid.UUID, request_id: uuid.UUID, db: DbSession, user: CurrentUser
) -> CareRequestForCaretaker:
    ct = requests.caretaker_for(db, user.id, profile_id)
    request, _ = requests.visible_to(db, ct, request_id)
    return caretaker_view(db, ct, [request])[0]


@caretaker_router.put(
    "/{request_id}/offer",
    response_model=CareRequestForCaretaker,
    responses=_ERRORS,
    summary="Caretaker: send or update your offer (total price and a message)",
)
def put_offer(
    profile_id: uuid.UUID, request_id: uuid.UUID, data: OfferIn, db: DbSession, user: CurrentUser
) -> CareRequestForCaretaker:
    ct = requests.caretaker_for(db, user.id, profile_id)
    requests.make_offer(db, ct, request_id, data)
    db.commit()
    request = db.get(CareRequest, request_id)
    assert request is not None  # noqa: S101 - just offered on it
    return caretaker_view(db, ct, [request])[0]


@caretaker_router.delete(
    "/{request_id}/offer",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=_ERRORS,
    summary="Caretaker: withdraw your pending offer",
)
def delete_offer(
    profile_id: uuid.UUID, request_id: uuid.UUID, db: DbSession, user: CurrentUser
) -> Response:
    ct = requests.caretaker_for(db, user.id, profile_id)
    requests.withdraw(db, ct, request_id)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
