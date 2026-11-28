"""Caretaker services and readiness (milestone 3.1, decision 0015)."""

from __future__ import annotations

import uuid

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.modules.audit import service as audit
from app.modules.care.models import AT_CARETAKER_HOME, CareService, CareType
from app.modules.care.schemas import CareServicesIn, ReadinessItem
from app.modules.providers import service as providers
from app.modules.providers.models import ProviderProfile, ProviderType
from app.modules.verification.status import ActiveStatus, VerificationStatus


def caretaker_owned(
    db: Session, user_id: uuid.UUID, profile_id: uuid.UUID, *, for_update: bool = False
) -> ProviderProfile:
    profile = providers.get_owned(db, user_id, profile_id, for_update=for_update)
    if profile.provider_type != ProviderType.CARETAKER:
        raise AppError(
            "not_a_caretaker", "Care services are for caretaker profiles.", status_code=422
        )
    return profile


def list_services(db: Session, profile_id: uuid.UUID) -> list[CareService]:
    rows = db.scalars(select(CareService).where(CareService.provider_profile_id == profile_id))
    order = list(CareType)
    return sorted(rows, key=lambda s: order.index(CareType(s.care_type)))


def replace_services(
    db: Session, user_id: uuid.UUID, profile_id: uuid.UUID, data: CareServicesIn
) -> list[CareService]:
    """Replace the caretaker's whole offering (one row per care type)."""
    profile = caretaker_owned(db, user_id, profile_id, for_update=True)
    types = [s.care_type for s in data.services]
    if len(types) != len(set(types)):
        raise AppError("duplicate_care_type", "List each care type only once.", status_code=422)
    existing = {s.care_type: s for s in list_services(db, profile.id)}
    keep = {t.value for t in types}
    db.execute(
        delete(CareService).where(
            CareService.provider_profile_id == profile.id, CareService.care_type.not_in(keep)
        )
    )
    for item in data.services:
        row = existing.get(item.care_type.value)
        values = item.model_dump()
        values["care_type"] = item.care_type.value
        if row is None:
            db.add(CareService(provider_profile_id=profile.id, **values))
        else:
            for field, value in values.items():
                setattr(row, field, value)
    audit.record(
        db,
        "care.services_updated",
        actor_user_id=user_id,
        target_type="provider_profile",
        target_id=profile.id,
        details={"care_types": ",".join(sorted(keep))},
    )
    db.flush()
    return list_services(db, profile.id)


def missing(profile: ProviderProfile, services: list[CareService]) -> list[ReadinessItem]:
    """The checklist the caretaker workspace shows until requests can reach them."""
    active = [s for s in services if s.active]
    out: list[ReadinessItem] = []
    if not active:
        out.append("services")
    if not profile.area_key or not profile.service_radius_km:
        out.append("service_area")
    if any(CareType(s.care_type) in AT_CARETAKER_HOME for s in active) and (
        profile.home_type is None or profile.outdoor_space is None
    ):
        out.append("home_details")
    if profile.max_concurrent is None:
        out.append("capacity")
    if (
        profile.verification_status != VerificationStatus.VERIFIED
        or profile.status != ActiveStatus.ACTIVE
    ):
        out.append("verification")
    return out
