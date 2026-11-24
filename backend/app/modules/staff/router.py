"""Admin management of staff roles (decision 0006). Admin only; every change is audited."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, status

from app.api.deps import AdminUser, AppSettings, DbSession
from app.core.errors import AppError, error_responses
from app.modules.staff import service
from app.modules.staff.schemas import StaffRoleGrant, StaffRoleResponse
from app.modules.users import service as users

router = APIRouter(prefix="/admin/staff-roles", tags=["admin"])

_ERRORS = error_responses(401, 403, 404, 409, 422)


@router.get(
    "", response_model=list[StaffRoleResponse], summary="List active staff roles", responses=_ERRORS
)
def list_staff_roles(db: DbSession, _admin: AdminUser) -> list[StaffRoleResponse]:
    return [StaffRoleResponse.model_validate(grant) for grant in service.list_active(db)]


@router.post(
    "",
    response_model=StaffRoleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Grant a staff role (verified company email required)",
    responses=_ERRORS,
)
def grant_staff_role(
    body: StaffRoleGrant, db: DbSession, settings: AppSettings, admin: AdminUser
) -> StaffRoleResponse:
    target = users.get_user(db, body.user_id)
    if target is None:
        raise AppError("not_found", "User not found.", status_code=404)
    grant = service.grant_role(db, settings, actor=admin, target=target, role=body.role)
    db.commit()
    return StaffRoleResponse.model_validate(grant)


@router.delete(
    "/{staff_role_id}",
    response_model=StaffRoleResponse,
    summary="Revoke a staff role",
    responses=_ERRORS,
)
def revoke_staff_role(
    staff_role_id: uuid.UUID, db: DbSession, admin: AdminUser
) -> StaffRoleResponse:
    grant = service.revoke_role(db, actor=admin, staff_role_id=staff_role_id)
    db.commit()
    return StaffRoleResponse.model_validate(grant)
