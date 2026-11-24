"""Pet profiles. Owner-only access; other users get 404 so pet existence never leaks."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.core.config import Settings
from app.core.errors import AppError
from app.modules.audit import service as audit
from app.modules.media import service as media
from app.modules.media.models import MediaPurpose
from app.modules.pets.models import Pet, Sex, Species
from app.modules.pets.schemas import PetCreate, PetUpdate
from app.modules.storage.base import ObjectStorage


def _not_found() -> AppError:
    return AppError("not_found", "Pet not found.", status_code=404)


def list_pets(db: Session, owner_id: uuid.UUID) -> list[Pet]:
    stmt = (
        select(Pet)
        .where(Pet.owner_id == owner_id, Pet.deleted_at.is_(None))
        .order_by(Pet.created_at)
    )
    return list(db.scalars(stmt))


def get_owned_pet(
    db: Session, owner_id: uuid.UUID, pet_id: uuid.UUID, *, for_update: bool = False
) -> Pet:
    stmt = select(Pet).where(Pet.id == pet_id)
    if for_update:
        stmt = stmt.with_for_update()
    pet = db.scalars(stmt).first()
    if pet is None or pet.owner_id != owner_id or pet.deleted_at is not None:
        raise _not_found()
    return pet


def create_pet(db: Session, settings: Settings, owner_id: uuid.UUID, data: PetCreate) -> Pet:
    count = db.scalar(
        select(func.count())
        .select_from(Pet)
        .where(Pet.owner_id == owner_id, Pet.deleted_at.is_(None))
    )
    if (count or 0) >= settings.max_pets_per_owner:
        raise AppError(
            "pet_limit_reached",
            f"You can add up to {settings.max_pets_per_owner} pets.",
            status_code=409,
        )
    values = data.model_dump()
    values["sex"] = values["sex"] or Sex.UNKNOWN
    values["date_of_birth_is_estimate"] = bool(values["date_of_birth_is_estimate"])
    pet = Pet(owner_id=owner_id, **values)
    db.add(pet)
    db.flush()
    audit.record(db, "pet.created", actor_user_id=owner_id, target_type="pet", target_id=pet.id)
    return pet


def update_pet(db: Session, owner_id: uuid.UUID, pet_id: uuid.UUID, data: PetUpdate) -> Pet:
    pet = get_owned_pet(db, owner_id, pet_id, for_update=True)
    changes = data.changes()
    if "sex" in changes and changes["sex"] is None:
        changes["sex"] = Sex.UNKNOWN
    if "date_of_birth_is_estimate" in changes:
        changes["date_of_birth_is_estimate"] = bool(changes["date_of_birth_is_estimate"])

    species = changes.get("species", pet.species)
    species_other = changes.get("species_other", pet.species_other)
    if species == Species.OTHER and not species_other:
        raise AppError(
            "validation_error",
            "Please describe the species.",
            status_code=422,
            details=[{"loc": ["body", "species_other"], "msg": "required for species 'other'"}],
        )
    if species != Species.OTHER:
        changes["species_other"] = None

    for field, value in changes.items():
        setattr(pet, field, value)
    db.flush()
    return pet


def delete_pet(db: Session, storage: ObjectStorage, owner_id: uuid.UUID, pet_id: uuid.UUID) -> None:
    pet = get_owned_pet(db, owner_id, pet_id, for_update=True)
    pet.deleted_at = utcnow()
    photo = media.get_asset(db, pet.photo_media_id)
    if photo is not None:
        media.discard(db, storage, photo)
    pet.photo_media_id = None
    audit.record(db, "pet.deleted", actor_user_id=owner_id, target_type="pet", target_id=pet.id)


def photo_key_prefix(owner_id: uuid.UUID, pet_id: uuid.UUID) -> str:
    return f"pets/{owner_id}/{pet_id}"


def attach_photo(
    db: Session,
    settings: Settings,
    storage: ObjectStorage,
    owner_id: uuid.UUID,
    pet_id: uuid.UUID,
    media_id: uuid.UUID,
) -> Pet:
    pet = get_owned_pet(db, owner_id, pet_id, for_update=True)
    asset = media.confirm_image_upload(
        db,
        settings,
        storage,
        owner_id=owner_id,
        media_id=media_id,
        purpose=MediaPurpose.PET_PHOTO,
        key_prefix=photo_key_prefix(owner_id, pet_id),
    )
    previous = media.get_asset(db, pet.photo_media_id)
    pet.photo_media_id = asset.id
    if previous is not None and previous.id != asset.id:
        media.discard(db, storage, previous)
    db.flush()
    return pet


def remove_photo(
    db: Session, storage: ObjectStorage, owner_id: uuid.UUID, pet_id: uuid.UUID
) -> Pet:
    pet = get_owned_pet(db, owner_id, pet_id, for_update=True)
    previous = media.get_asset(db, pet.photo_media_id)
    pet.photo_media_id = None
    if previous is not None:
        media.discard(db, storage, previous)
    db.flush()
    return pet
