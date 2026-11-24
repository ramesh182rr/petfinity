"""Provider profiles (decision 0006): one per type per person, verified separately."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.modules.audit import service as audit
from app.modules.providers.models import ProviderProfile, ProviderType
from app.modules.providers.schemas import (
    CREDENTIAL_FIELDS,
    ProviderProfileCreate,
    ProviderProfileUpdate,
)
from app.modules.verification.status import ActiveStatus, VerificationStatus


def list_mine(db: Session, user_id: uuid.UUID) -> list[ProviderProfile]:
    stmt = (
        select(ProviderProfile)
        .where(ProviderProfile.user_id == user_id)
        .order_by(ProviderProfile.created_at)
    )
    return list(db.scalars(stmt))


def get_owned(
    db: Session, user_id: uuid.UUID, profile_id: uuid.UUID, *, for_update: bool = False
) -> ProviderProfile:
    stmt = select(ProviderProfile).where(ProviderProfile.id == profile_id)
    if for_update:
        stmt = stmt.with_for_update()
    profile = db.scalars(stmt).first()
    if profile is None or profile.user_id != user_id:
        raise AppError("not_found", "Provider profile not found.", status_code=404)
    return profile


def find_for_user(
    db: Session, user_id: uuid.UUID, provider_type: ProviderType
) -> ProviderProfile | None:
    stmt = select(ProviderProfile).where(
        ProviderProfile.user_id == user_id, ProviderProfile.provider_type == provider_type
    )
    return db.scalars(stmt).first()


def create(db: Session, user_id: uuid.UUID, data: ProviderProfileCreate) -> ProviderProfile:
    if find_for_user(db, user_id, data.provider_type) is not None:
        raise AppError(
            "provider_profile_exists",
            f"You already have a {data.provider_type.value} profile.",
            status_code=409,
        )
    values = data.model_dump(exclude_none=True)
    profile = ProviderProfile(
        user_id=user_id,
        verification_status=VerificationStatus.DRAFT,
        status=ActiveStatus.ACTIVE,
        **values,
    )
    db.add(profile)
    db.flush()
    audit.record(
        db,
        "provider_profile.created",
        actor_user_id=user_id,
        target_type="provider_profile",
        target_id=profile.id,
        details={"provider_type": data.provider_type.value},
    )
    return profile


def update(
    db: Session, user_id: uuid.UUID, profile_id: uuid.UUID, data: ProviderProfileUpdate
) -> ProviderProfile:
    profile = get_owned(db, user_id, profile_id, for_update=True)
    changes = data.changes()
    if "languages" in changes and changes["languages"] is None:
        changes["languages"] = []
    credential_change = any(
        field in changes and changes[field] != getattr(profile, field)
        for field in CREDENTIAL_FIELDS
    )
    if credential_change and profile.verification_status == VerificationStatus.SUBMITTED:
        raise AppError(
            "under_review",
            "Credentials can't be changed while your profile is being reviewed.",
            status_code=409,
        )
    for field, value in changes.items():
        setattr(profile, field, value)
    if credential_change and profile.verification_status == VerificationStatus.VERIFIED:
        # Changed credentials must be re-checked before the badge applies again.
        profile.verification_status = VerificationStatus.DRAFT
        profile.verified_at = None
        audit.record(
            db,
            "provider_profile.verification_reset",
            actor_user_id=user_id,
            target_type="provider_profile",
            target_id=profile.id,
        )
    db.flush()
    return profile


def active_types(db: Session, user_id: uuid.UUID) -> set[str]:
    stmt = select(ProviderProfile.provider_type).where(
        ProviderProfile.user_id == user_id, ProviderProfile.status == ActiveStatus.ACTIVE
    )
    return set(db.scalars(stmt))
