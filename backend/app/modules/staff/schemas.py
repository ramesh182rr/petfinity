from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict

from app.core.types import UtcDatetime
from app.modules.staff.models import StaffRoleName


class StaffRoleGrant(BaseModel):
    user_id: uuid.UUID
    role: StaffRoleName


class StaffRoleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    role: StaffRoleName
    granted_by_user_id: uuid.UUID | None
    granted_at: UtcDatetime
    revoked_at: UtcDatetime | None
