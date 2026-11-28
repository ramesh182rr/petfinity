"""Provider-side management of services and availability (clinic operators / vets)."""

from __future__ import annotations

import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.api.deps import CurrentUser, DbSession
from app.core.errors import error_responses
from app.modules.catalog import service as catalog
from app.modules.catalog.models import OwnerType
from app.modules.catalog.owners import Owner, resolve_owner
from app.modules.catalog.schemas import (
    ExceptionIn,
    ExceptionOut,
    RuleOut,
    ServiceCreate,
    ServiceResponse,
    ServiceUpdate,
    SlotOut,
    SlotPreview,
    WeeklyHours,
    WeeklyHoursResponse,
)

router = APIRouter(prefix="/manage/{owner_type}/{owner_id}", tags=["manage"])
_ERRORS = error_responses(401, 403, 404, 409, 422)


def current_owner(
    owner_type: OwnerType, owner_id: uuid.UUID, db: DbSession, user: CurrentUser
) -> Owner:
    return resolve_owner(db, user.id, owner_type, owner_id)


ManagedOwner = Annotated[Owner, Depends(current_owner)]


def days_off_owner(
    owner_type: OwnerType, owner_id: uuid.UUID, db: DbSession, user: CurrentUser
) -> Owner:
    return resolve_owner(db, user.id, owner_type, owner_id, allow_caretaker=True)


# Days off are shared by vets, clinics and caretakers (decision 0015).
DaysOffOwner = Annotated[Owner, Depends(days_off_owner)]


@router.get("/services", response_model=list[ServiceResponse], responses=_ERRORS)
def list_services(owner: ManagedOwner, db: DbSession) -> list[ServiceResponse]:
    return [ServiceResponse.model_validate(s) for s in catalog.list_services(db, owner)]


@router.post(
    "/services",
    response_model=ServiceResponse,
    status_code=status.HTTP_201_CREATED,
    responses=_ERRORS,
)
def create_service(
    body: ServiceCreate, owner: ManagedOwner, db: DbSession, user: CurrentUser
) -> ServiceResponse:
    service = catalog.create_service(db, owner, user.id, body)
    db.commit()
    db.refresh(service)
    return ServiceResponse.model_validate(service)


@router.patch("/services/{service_id}", response_model=ServiceResponse, responses=_ERRORS)
def update_service(
    service_id: uuid.UUID,
    body: ServiceUpdate,
    owner: ManagedOwner,
    db: DbSession,
    user: CurrentUser,
) -> ServiceResponse:
    service = catalog.update_service(db, owner, user.id, service_id, body)
    db.commit()
    db.refresh(service)
    return ServiceResponse.model_validate(service)


@router.delete("/services/{service_id}", status_code=status.HTTP_204_NO_CONTENT, responses=_ERRORS)
def archive_service(
    service_id: uuid.UUID, owner: ManagedOwner, db: DbSession, user: CurrentUser
) -> Response:
    catalog.archive_service(db, owner, user.id, service_id)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/availability", response_model=WeeklyHoursResponse, responses=_ERRORS)
def get_hours(owner: ManagedOwner, db: DbSession) -> WeeklyHoursResponse:
    return WeeklyHoursResponse(
        timezone=owner.timezone,
        rules=[RuleOut.model_validate(r) for r in catalog.list_rules(db, owner)],
    )


@router.put(
    "/availability",
    response_model=WeeklyHoursResponse,
    responses=_ERRORS,
    summary="Replace the weekly opening hours",
)
def put_hours(
    body: WeeklyHours, owner: ManagedOwner, db: DbSession, user: CurrentUser
) -> WeeklyHoursResponse:
    rules = catalog.replace_rules(db, owner, user.id, body.rules)
    db.commit()
    return WeeklyHoursResponse(
        timezone=owner.timezone, rules=[RuleOut.model_validate(r) for r in rules]
    )


@router.get(
    "/exceptions",
    response_model=list[ExceptionOut],
    responses=_ERRORS,
    summary="Upcoming days off and special hours",
)
def list_exceptions(owner: DaysOffOwner, db: DbSession) -> list[ExceptionOut]:
    return [ExceptionOut.model_validate(e) for e in catalog.list_exceptions(db, owner)]


@router.post(
    "/exceptions",
    response_model=ExceptionOut,
    status_code=status.HTTP_201_CREATED,
    responses=_ERRORS,
)
def add_exception(
    body: ExceptionIn, owner: DaysOffOwner, db: DbSession, user: CurrentUser
) -> ExceptionOut:
    exception = catalog.add_exception(db, owner, user.id, body)
    db.commit()
    return ExceptionOut.model_validate(exception)


@router.delete(
    "/exceptions/{exception_id}", status_code=status.HTTP_204_NO_CONTENT, responses=_ERRORS
)
def delete_exception(
    exception_id: uuid.UUID, owner: DaysOffOwner, db: DbSession, user: CurrentUser
) -> Response:
    catalog.delete_exception(db, owner, user.id, exception_id)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/slots",
    response_model=SlotPreview,
    responses=_ERRORS,
    summary="Preview bookable slots for a service on a date (owner's timezone)",
)
def preview_slots(
    owner: ManagedOwner,
    db: DbSession,
    service_id: uuid.UUID,
    on: Annotated[date, Query(alias="date")],
) -> SlotPreview:
    slots = catalog.preview_slots(db, owner, service_id, on)
    return SlotPreview(
        date=on,
        timezone=owner.timezone,
        service_id=service_id,
        slots=[
            SlotOut(
                start=s.start,
                end=s.end,
                local_start=s.local_start.strftime("%H:%M"),
                capacity=s.capacity,
            )
            for s in slots
        ],
    )
