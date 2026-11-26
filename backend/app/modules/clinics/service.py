"""Clinics and memberships. Operators manage the clinic; vets practise there."""

from __future__ import annotations

import uuid
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.modules.audit import service as audit
from app.modules.clinics.models import Clinic, ClinicMember, MemberRole
from app.modules.clinics.schemas import ClinicCreate, ClinicUpdate
from app.modules.discovery.areas import resolve_area
from app.modules.providers import service as providers
from app.modules.providers.models import ProviderType
from app.modules.verification.status import ActiveStatus, VerificationStatus

MAX_CLINICS_PER_OPERATOR = 10


def _not_found() -> AppError:
    return AppError("not_found", "Clinic not found.", status_code=404)


def roles_by_clinic(db: Session, user_id: uuid.UUID) -> dict[uuid.UUID, list[MemberRole]]:
    stmt = select(ClinicMember.clinic_id, ClinicMember.member_role).where(
        ClinicMember.user_id == user_id, ClinicMember.removed_at.is_(None)
    )
    roles: dict[uuid.UUID, list[MemberRole]] = defaultdict(list)
    for clinic_id, role in db.execute(stmt):
        roles[clinic_id].append(MemberRole(role))
    return {cid: sorted(r) for cid, r in roles.items()}


def list_mine(db: Session, user_id: uuid.UUID) -> list[tuple[Clinic, list[MemberRole]]]:
    roles = roles_by_clinic(db, user_id)
    if not roles:
        return []
    clinics = db.scalars(select(Clinic).where(Clinic.id.in_(roles)).order_by(Clinic.created_at))
    return [(clinic, roles[clinic.id]) for clinic in clinics]


def get_for_member(
    db: Session, user_id: uuid.UUID, clinic_id: uuid.UUID, *, for_update: bool = False
) -> tuple[Clinic, list[MemberRole]]:
    roles = roles_by_clinic(db, user_id).get(clinic_id)
    stmt = select(Clinic).where(Clinic.id == clinic_id)
    if for_update:
        stmt = stmt.with_for_update()
    clinic = db.scalars(stmt).first() if roles else None
    if clinic is None or roles is None:
        raise _not_found()  # non-members can't tell whether the clinic exists
    return clinic, roles


def require_operator(
    db: Session, user_id: uuid.UUID, clinic_id: uuid.UUID, *, for_update: bool = False
) -> Clinic:
    clinic, roles = get_for_member(db, user_id, clinic_id, for_update=for_update)
    if MemberRole.OPERATOR not in roles:
        raise AppError("forbidden", "Only the clinic's operators can do that.", status_code=403)
    return clinic


def create(db: Session, user_id: uuid.UUID, data: ClinicCreate) -> tuple[Clinic, list[MemberRole]]:
    operated = [r for r in roles_by_clinic(db, user_id).values() if MemberRole.OPERATOR in r]
    if len(operated) >= MAX_CLINICS_PER_OPERATOR:
        raise AppError("clinic_limit_reached", "You've reached the clinic limit.", status_code=409)
    if data.practises_here and (
        providers.find_for_user(db, user_id, ProviderType.VETERINARIAN) is None
    ):
        raise AppError(
            "veterinarian_profile_required",
            "Create your veterinarian profile first to be listed as a vet at this clinic.",
            status_code=409,
        )

    values = data.model_dump(exclude={"practises_here"}, exclude_none=True)
    values["area_key"] = resolve_area(
        values.get("area_key"), data.latitude, data.longitude, city=data.city
    )
    clinic = Clinic(
        created_by_user_id=user_id,
        verification_status=VerificationStatus.DRAFT,
        status=ActiveStatus.ACTIVE,
        **values,
    )
    db.add(clinic)
    db.flush()
    roles = [MemberRole.OPERATOR]
    db.add(
        ClinicMember(
            clinic_id=clinic.id,
            user_id=user_id,
            member_role=MemberRole.OPERATOR,
            added_by_user_id=user_id,
        )
    )
    if data.practises_here:
        db.add(
            ClinicMember(
                clinic_id=clinic.id,
                user_id=user_id,
                member_role=MemberRole.VETERINARIAN,
                added_by_user_id=user_id,
            )
        )
        roles.append(MemberRole.VETERINARIAN)
    audit.record(
        db, "clinic.created", actor_user_id=user_id, target_type="clinic", target_id=clinic.id
    )
    db.flush()
    return clinic, sorted(roles)


def update(db: Session, user_id: uuid.UUID, clinic_id: uuid.UUID, data: ClinicUpdate) -> Clinic:
    clinic = require_operator(db, user_id, clinic_id, for_update=True)
    changes = data.changes()
    if (changes.get("latitude") is None) != (changes.get("longitude") is None) and (
        "latitude" in changes or "longitude" in changes
    ):
        lat = changes.get("latitude", clinic.latitude)
        lng = changes.get("longitude", clinic.longitude)
        if (lat is None) != (lng is None):
            raise AppError(
                "validation_error",
                "Latitude and longitude must be set together.",
                status_code=422,
            )
    identity_change = "name" in changes and changes["name"] != clinic.name
    if identity_change and clinic.verification_status == VerificationStatus.SUBMITTED:
        raise AppError(
            "under_review",
            "The clinic name can't change while it's being reviewed.",
            status_code=409,
        )
    if "emergency_services" in changes and changes["emergency_services"] is None:
        changes["emergency_services"] = False
    if any(f in changes for f in ("area_key", "latitude", "longitude", "city")):
        lat = changes.get("latitude", clinic.latitude)
        lng = changes.get("longitude", clinic.longitude)
        area = changes.get("area_key", None if "latitude" in changes else clinic.area_key)
        changes["area_key"] = resolve_area(area, lat, lng, city=changes.get("city", clinic.city))
    for field, value in changes.items():
        setattr(clinic, field, value)
    if identity_change and clinic.verification_status == VerificationStatus.VERIFIED:
        clinic.verification_status = VerificationStatus.DRAFT
        clinic.verified_at = None
        audit.record(
            db,
            "clinic.verification_reset",
            actor_user_id=user_id,
            target_type="clinic",
            target_id=clinic.id,
        )
    db.flush()
    return clinic


def is_operator_anywhere(db: Session, user_id: uuid.UUID) -> bool:
    return any(MemberRole.OPERATOR in roles for roles in roles_by_clinic(db, user_id).values())
