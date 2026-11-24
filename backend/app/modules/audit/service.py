"""Write audit entries inside the caller's transaction (committed with the action)."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.modules.audit.models import AuditLog


def record(
    db: Session,
    action: str,
    *,
    actor_user_id: uuid.UUID | None = None,
    target_type: str | None = None,
    target_id: uuid.UUID | None = None,
    details: dict[str, Any] | None = None,
) -> AuditLog:
    entry = AuditLog(
        actor_user_id=actor_user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details or {},
    )
    db.add(entry)
    return entry
