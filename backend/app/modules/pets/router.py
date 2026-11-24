"""Pet profile endpoints (owner only)."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import AppSettings, CurrentUser, DbSession
from app.core.config import Settings
from app.core.errors import error_responses
from app.modules.media import service as media
from app.modules.media.models import MediaPurpose
from app.modules.pets import service
from app.modules.pets.models import Pet
from app.modules.pets.schemas import (
    PetCreate,
    PetResponse,
    PetUpdate,
    PhotoConfirm,
    PhotoUploadRequest,
    PhotoUploadResponse,
    UploadInstructions,
)
from app.modules.storage.base import ObjectStorage

router = APIRouter(prefix="/pets", tags=["pets"])

_ERRORS = error_responses(401, 403, 404, 409, 422)


def get_storage(request: Request) -> ObjectStorage:
    storage: ObjectStorage = request.app.state.storage
    return storage


Storage = Annotated[ObjectStorage, Depends(get_storage)]


def to_response(db: Session, settings: Settings, storage: ObjectStorage, pet: Pet) -> PetResponse:
    photo = media.get_asset(db, pet.photo_media_id)
    return PetResponse(
        id=pet.id,
        name=pet.name,
        species=pet.species,
        species_other=pet.species_other,
        breed=pet.breed,
        sex=pet.sex,
        date_of_birth=pet.date_of_birth,
        date_of_birth_is_estimate=pet.date_of_birth_is_estimate,
        weight_kg=pet.weight_kg,
        neutered=pet.neutered,
        temperament=pet.temperament,
        dietary_notes=pet.dietary_notes,
        allergies=pet.allergies,
        known_conditions=pet.known_conditions,
        medications=pet.medications,
        emergency_contact_name=pet.emergency_contact_name,
        emergency_contact_phone=pet.emergency_contact_phone,
        photo_url=media.download_url(settings, storage, photo),
        created_at=pet.created_at,
        updated_at=pet.updated_at,
    )


@router.get("", response_model=list[PetResponse], summary="List my pets", responses=_ERRORS)
def list_pets(
    db: DbSession, settings: AppSettings, storage: Storage, user: CurrentUser
) -> list[PetResponse]:
    return [to_response(db, settings, storage, pet) for pet in service.list_pets(db, user.id)]


@router.post(
    "",
    response_model=PetResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a pet",
    responses=_ERRORS,
)
def create_pet(
    body: PetCreate, db: DbSession, settings: AppSettings, storage: Storage, user: CurrentUser
) -> PetResponse:
    pet = service.create_pet(db, settings, user.id, body)
    db.commit()
    db.refresh(pet)
    return to_response(db, settings, storage, pet)


@router.get(
    "/{pet_id}", response_model=PetResponse, summary="Get one of my pets", responses=_ERRORS
)
def get_pet(
    pet_id: uuid.UUID, db: DbSession, settings: AppSettings, storage: Storage, user: CurrentUser
) -> PetResponse:
    return to_response(db, settings, storage, service.get_owned_pet(db, user.id, pet_id))


@router.patch("/{pet_id}", response_model=PetResponse, summary="Update a pet", responses=_ERRORS)
def update_pet(
    pet_id: uuid.UUID,
    body: PetUpdate,
    db: DbSession,
    settings: AppSettings,
    storage: Storage,
    user: CurrentUser,
) -> PetResponse:
    pet = service.update_pet(db, user.id, pet_id, body)
    db.commit()
    db.refresh(pet)
    return to_response(db, settings, storage, pet)


@router.delete(
    "/{pet_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Remove a pet", responses=_ERRORS
)
def delete_pet(pet_id: uuid.UUID, db: DbSession, storage: Storage, user: CurrentUser) -> Response:
    service.delete_pet(db, storage, user.id, pet_id)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{pet_id}/photo/upload-url",
    response_model=PhotoUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Get a short-lived URL to upload a pet photo",
    description=(
        "PUT the image bytes to `upload.url` with `upload.headers`, then call PUT /pets/{id}/photo."
    ),
    responses=error_responses(401, 404, 413, 415, 422, 429),
)
def create_photo_upload(
    pet_id: uuid.UUID,
    body: PhotoUploadRequest,
    db: DbSession,
    settings: AppSettings,
    storage: Storage,
    user: CurrentUser,
) -> PhotoUploadResponse:
    service.get_owned_pet(db, user.id, pet_id)
    ticket = media.create_upload(
        db,
        settings,
        storage,
        owner_id=user.id,
        purpose=MediaPurpose.PET_PHOTO,
        key_prefix=service.photo_key_prefix(user.id, pet_id),
        content_type=body.content_type,
        size_bytes=body.size_bytes,
    )
    db.commit()
    return PhotoUploadResponse(
        media_id=ticket.asset.id,
        upload=UploadInstructions(
            url=ticket.upload.url, method=ticket.upload.method, headers=ticket.upload.headers
        ),
        expires_at=ticket.expires_at,
    )


@router.put(
    "/{pet_id}/photo",
    response_model=PetResponse,
    summary="Confirm an uploaded photo and set it as the pet's photo",
    responses=error_responses(401, 404, 409, 422),
)
def set_photo(
    pet_id: uuid.UUID,
    body: PhotoConfirm,
    db: DbSession,
    settings: AppSettings,
    storage: Storage,
    user: CurrentUser,
) -> PetResponse:
    pet = service.attach_photo(db, settings, storage, user.id, pet_id, body.media_id)
    db.commit()
    db.refresh(pet)
    return to_response(db, settings, storage, pet)


@router.delete(
    "/{pet_id}/photo",
    response_model=PetResponse,
    summary="Remove the pet's photo",
    responses=_ERRORS,
)
def delete_photo(
    pet_id: uuid.UUID, db: DbSession, settings: AppSettings, storage: Storage, user: CurrentUser
) -> PetResponse:
    pet = service.remove_photo(db, storage, user.id, pet_id)
    db.commit()
    db.refresh(pet)
    return to_response(db, settings, storage, pet)
