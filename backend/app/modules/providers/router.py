"""The current user's provider profiles ("Become a provider")."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.core.errors import error_responses
from app.modules.providers import service
from app.modules.providers.schemas import (
    ProviderProfileCreate,
    ProviderProfileResponse,
    ProviderProfileUpdate,
)

router = APIRouter(prefix="/me/provider-profiles", tags=["providers"])
_ERRORS = error_responses(401, 404, 409, 422)


@router.get("", response_model=list[ProviderProfileResponse], summary="My provider profiles")
def list_profiles(db: DbSession, user: CurrentUser) -> list[ProviderProfileResponse]:
    return [ProviderProfileResponse.model_validate(p) for p in service.list_mine(db, user.id)]


@router.post(
    "",
    response_model=ProviderProfileResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Become a veterinarian or caretaker (starts as an unverified draft)",
    responses=_ERRORS,
)
def create_profile(
    body: ProviderProfileCreate, db: DbSession, user: CurrentUser
) -> ProviderProfileResponse:
    profile = service.create(db, user.id, body)
    db.commit()
    db.refresh(profile)
    return ProviderProfileResponse.model_validate(profile)


@router.get(
    "/{profile_id}", response_model=ProviderProfileResponse, summary="Get one", responses=_ERRORS
)
def get_profile(profile_id: uuid.UUID, db: DbSession, user: CurrentUser) -> ProviderProfileResponse:
    return ProviderProfileResponse.model_validate(service.get_owned(db, user.id, profile_id))


@router.patch(
    "/{profile_id}",
    response_model=ProviderProfileResponse,
    summary="Update (changing credentials on a verified profile requires re-verification)",
    responses=_ERRORS,
)
def update_profile(
    profile_id: uuid.UUID, body: ProviderProfileUpdate, db: DbSession, user: CurrentUser
) -> ProviderProfileResponse:
    profile = service.update(db, user.id, profile_id, body)
    db.commit()
    db.refresh(profile)
    return ProviderProfileResponse.model_validate(profile)
