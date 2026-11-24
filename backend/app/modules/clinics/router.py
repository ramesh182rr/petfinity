"""Clinic setup for operators (public discovery arrives in milestone 2.5)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.core.errors import error_responses
from app.modules.clinics import service
from app.modules.clinics.models import Clinic, MemberRole
from app.modules.clinics.schemas import ClinicCreate, ClinicResponse, ClinicUpdate

router = APIRouter(tags=["clinics"])
_ERRORS = error_responses(401, 403, 404, 409, 422)


def to_response(clinic: Clinic, roles: list[MemberRole]) -> ClinicResponse:
    return ClinicResponse(
        id=clinic.id,
        name=clinic.name,
        description=clinic.description,
        phone=clinic.phone,
        email=clinic.email,
        address_line1=clinic.address_line1,
        address_line2=clinic.address_line2,
        locality=clinic.locality,
        city=clinic.city,
        state=clinic.state,
        postal_code=clinic.postal_code,
        latitude=clinic.latitude,
        longitude=clinic.longitude,
        timezone=clinic.timezone,
        emergency_services=clinic.emergency_services,
        verification_status=clinic.verification_status,
        verified_at=clinic.verified_at,
        status=clinic.status,
        my_roles=roles,
        created_at=clinic.created_at,
        updated_at=clinic.updated_at,
    )


@router.post(
    "/clinics",
    response_model=ClinicResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a clinic (you become its operator; starts unverified)",
    responses=_ERRORS,
)
def create_clinic(body: ClinicCreate, db: DbSession, user: CurrentUser) -> ClinicResponse:
    clinic, roles = service.create(db, user.id, body)
    db.commit()
    db.refresh(clinic)
    return to_response(clinic, roles)


@router.get("/me/clinics", response_model=list[ClinicResponse], summary="Clinics I belong to")
def my_clinics(db: DbSession, user: CurrentUser) -> list[ClinicResponse]:
    return [to_response(c, roles) for c, roles in service.list_mine(db, user.id)]


@router.get(
    "/clinics/{clinic_id}",
    response_model=ClinicResponse,
    summary="Clinic (members only)",
    responses=_ERRORS,
)
def get_clinic(clinic_id: uuid.UUID, db: DbSession, user: CurrentUser) -> ClinicResponse:
    clinic, roles = service.get_for_member(db, user.id, clinic_id)
    return to_response(clinic, roles)


@router.patch(
    "/clinics/{clinic_id}",
    response_model=ClinicResponse,
    summary="Update clinic (operators)",
    responses=_ERRORS,
)
def update_clinic(
    clinic_id: uuid.UUID, body: ClinicUpdate, db: DbSession, user: CurrentUser
) -> ClinicResponse:
    clinic = service.update(db, user.id, clinic_id, body)
    db.commit()
    db.refresh(clinic)
    _, roles = service.get_for_member(db, user.id, clinic_id)
    return to_response(clinic, roles)
