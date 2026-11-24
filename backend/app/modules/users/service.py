"""User account operations."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.audit import service as audit
from app.modules.auth.identifiers import Channel, Identifier
from app.modules.staff import service as staff
from app.modules.users.models import User, UserStatus

PET_PARENT = "pet_parent"


def get_user(db: Session, user_id: uuid.UUID) -> User | None:
    return db.get(User, user_id)


def find_by_identifier(
    db: Session, identifier: Identifier, *, for_update: bool = False
) -> User | None:
    column = User.email if identifier.channel is Channel.EMAIL else User.phone
    stmt = select(User).where(column == identifier.value)
    if for_update:
        stmt = stmt.with_for_update()
    return db.scalars(stmt).first()


def create_verified_user(db: Session, identifier: Identifier, verified_at: datetime) -> User:
    user = User(status=UserStatus.ACTIVE)
    if identifier.channel is Channel.EMAIL:
        user.email = identifier.value
        user.email_verified_at = verified_at
    else:
        user.phone = identifier.value
        user.phone_verified_at = verified_at
    db.add(user)
    db.flush()
    audit.record(
        db,
        "user.created",
        actor_user_id=user.id,
        target_type="user",
        target_id=user.id,
        details={"via": identifier.channel.value},
    )
    return user


def mark_verified(user: User, identifier: Identifier, verified_at: datetime) -> None:
    if identifier.channel is Channel.EMAIL and user.email_verified_at is None:
        user.email_verified_at = verified_at
    if identifier.channel is Channel.PHONE and user.phone_verified_at is None:
        user.phone_verified_at = verified_at


def capabilities(db: Session, user: User) -> list[str]:
    """Derived capabilities (decision 0006).

    A capability means the person *can act* in that role (e.g. set up a clinic).
    Whether they're publicly listed or bookable is a separate verification gate.
    """
    from app.modules.clinics import service as clinics  # local: avoid import cycle
    from app.modules.providers import service as providers

    caps = [PET_PARENT]
    caps.extend(sorted(providers.active_types(db, user.id)))
    if clinics.is_operator_anywhere(db, user.id):
        caps.append("clinic_operator")
    caps.extend(sorted(staff.active_role_names(db, user.id)))
    return caps


def update_profile(db: Session, user: User, *, display_name: str | None) -> User:
    if display_name is not None:
        user.display_name = display_name
    db.flush()
    return user
