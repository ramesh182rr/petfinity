"""Staff role grants (decision 0006): explicit, audited, limited to staff-domain emails."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.core.config import Settings
from app.core.errors import AppError
from app.modules.audit import service as audit
from app.modules.staff.models import StaffRole, StaffRoleName

if TYPE_CHECKING:
    from app.modules.users.models import User


def active_role_names(db: Session, user_id: uuid.UUID) -> set[str]:
    stmt = select(StaffRole.role).where(
        StaffRole.user_id == user_id, StaffRole.revoked_at.is_(None)
    )
    return set(db.scalars(stmt))


def has_role(db: Session, user_id: uuid.UUID, role: StaffRoleName) -> bool:
    return role.value in active_role_names(db, user_id)


def list_active(db: Session) -> list[StaffRole]:
    stmt = select(StaffRole).where(StaffRole.revoked_at.is_(None)).order_by(StaffRole.granted_at)
    return list(db.scalars(stmt))


def is_staff_email_eligible(settings: Settings, user: User) -> bool:
    if not user.email or user.email_verified_at is None:
        return False
    domain = user.email.rsplit("@", 1)[-1].lower()
    return domain in settings.staff_email_domains


def bootstrap_admin_if_listed(db: Session, settings: Settings, user: User) -> bool:
    """Grant admin once to an operator-listed founder email after verified email sign-in.

    Never re-grants if an admin role was ever held (and possibly revoked) by this user.
    """
    if not user.email or user.email_verified_at is None:
        return False
    if user.email.lower() not in settings.bootstrap_admin_emails:
        return False
    ever_admin = db.scalar(
        select(func.count())
        .select_from(StaffRole)
        .where(StaffRole.user_id == user.id, StaffRole.role == StaffRoleName.ADMIN)
    )
    if ever_admin:
        return False
    grant = StaffRole(user_id=user.id, role=StaffRoleName.ADMIN, granted_by_user_id=None)
    db.add(grant)
    db.flush()
    audit.record(
        db,
        "staff_role.bootstrap_granted",
        actor_user_id=None,
        target_type="user",
        target_id=user.id,
        details={"role": StaffRoleName.ADMIN.value, "staff_role_id": str(grant.id)},
    )
    return True


def grant_role(
    db: Session, settings: Settings, *, actor: User, target: User, role: StaffRoleName
) -> StaffRole:
    if not target.is_active:
        raise AppError("user_not_active", "This account is not active.", status_code=409)
    if not is_staff_email_eligible(settings, target):
        raise AppError(
            "staff_email_required",
            "Staff roles can only be granted to accounts with a verified company email.",
            status_code=409,
        )
    if role.value in active_role_names(db, target.id):
        raise AppError("role_already_granted", "This user already has that role.", status_code=409)

    grant = StaffRole(user_id=target.id, role=role, granted_by_user_id=actor.id)
    db.add(grant)
    db.flush()
    audit.record(
        db,
        "staff_role.granted",
        actor_user_id=actor.id,
        target_type="user",
        target_id=target.id,
        details={"role": role.value, "staff_role_id": str(grant.id)},
    )
    return grant


def revoke_role(db: Session, *, actor: User, staff_role_id: uuid.UUID) -> StaffRole:
    grant = db.scalars(
        select(StaffRole).where(StaffRole.id == staff_role_id).with_for_update()
    ).first()
    if grant is None or grant.revoked_at is not None:
        raise AppError("not_found", "Staff role not found.", status_code=404)

    if grant.role == StaffRoleName.ADMIN:
        # Lock all active admin rows so two concurrent revocations can't remove the last admin.
        active_admins = list(
            db.scalars(
                select(StaffRole.id)
                .where(StaffRole.role == StaffRoleName.ADMIN, StaffRole.revoked_at.is_(None))
                .with_for_update()
            )
        )
        if len(active_admins) <= 1:
            raise AppError(
                "last_admin", "The last active admin cannot be removed.", status_code=409
            )

    grant.revoked_at = utcnow()
    grant.revoked_by_user_id = actor.id
    audit.record(
        db,
        "staff_role.revoked",
        actor_user_id=actor.id,
        target_type="user",
        target_id=grant.user_id,
        details={"role": grant.role, "staff_role_id": str(grant.id)},
    )
    return grant
