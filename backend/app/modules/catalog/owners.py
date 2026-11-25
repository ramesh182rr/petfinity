"""Who may manage a catalogue: clinic operators, or a veterinarian for their own profile."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy import ColumnElement
from sqlalchemy.orm import InstrumentedAttribute, Session

from app.core.errors import AppError
from app.modules.catalog.models import AvailabilityException, AvailabilityRule, OwnerType, Service
from app.modules.clinics import service as clinics
from app.modules.providers import service as providers
from app.modules.providers.models import ProviderType

DEFAULT_TIMEZONE = "Asia/Kolkata"

OwnedModel = type[Service] | type[AvailabilityRule] | type[AvailabilityException]


@dataclass(frozen=True)
class Owner:
    type: OwnerType
    id: uuid.UUID
    timezone: str
    name: str

    @property
    def is_clinic(self) -> bool:
        return self.type is OwnerType.CLINIC

    def filter(self, model: OwnedModel) -> ColumnElement[bool]:
        column: InstrumentedAttribute[uuid.UUID | None] = getattr(
            model, "clinic_id" if self.is_clinic else "provider_profile_id"
        )
        return column == self.id

    def fk(self) -> dict[str, uuid.UUID]:
        return {"clinic_id": self.id} if self.is_clinic else {"provider_profile_id": self.id}


def resolve_owner(
    db: Session,
    user_id: uuid.UUID,
    owner_type: OwnerType,
    owner_id: uuid.UUID,
    *,
    for_update: bool = False,
) -> Owner:
    if owner_type is OwnerType.CLINIC:
        clinic = clinics.require_operator(db, user_id, owner_id, for_update=for_update)
        return Owner(owner_type, clinic.id, clinic.timezone, clinic.name)
    profile = providers.get_owned(db, user_id, owner_id, for_update=for_update)
    if profile.provider_type != ProviderType.VETERINARIAN:
        raise AppError(
            "services_not_supported",
            "Caretakers price each request through offers, so there's no service list to manage.",
            status_code=422,
        )
    return Owner(owner_type, profile.id, DEFAULT_TIMEZONE, profile.display_name)
