"""Caretaker workspace API (milestone 3.1). Requests and offers arrive in 3.2-3.3."""

from __future__ import annotations

import uuid

from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.core.errors import error_responses
from app.modules.care import service as care
from app.modules.care.models import RATE_UNIT, CareService, CareType
from app.modules.care.schemas import CareServiceOut, CareServicesIn, CareWorkspace

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
