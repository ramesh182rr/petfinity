"""Notification inbox and push device registration (milestone 2.9)."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, FastAPI, Query, Request, Response, status

from app.api.deps import CurrentUser, DbSession
from app.core.errors import error_responses
from app.modules.notifications import service as notifications
from app.modules.notifications.schemas import (
    NotificationOut,
    NotificationPage,
    PushDeviceIn,
    PushDeviceOut,
    UnreadCount,
)

log = logging.getLogger(__name__)
router = APIRouter(tags=["notifications"])
_ERRORS = error_responses(401, 404, 422)


def deliver_now(app: FastAPI) -> None:
    """Push whatever is pending (runs after the response; the cron job is the safety net)."""
    try:
        with app.state.session_factory() as db, db.begin():
            notifications.deliver_pending(db, app.state.push_sender, limit=50)
    except Exception:  # never fail a request because of push delivery
        log.exception("push delivery failed; the scheduled job will retry")


def push_after_response(request: Request, background: BackgroundTasks) -> None:
    """Router dependency: after any change that may create notifications, push them."""
    background.add_task(deliver_now, request.app)


@router.get(
    "/notifications", response_model=NotificationPage, responses=_ERRORS, summary="My notifications"
)
def list_notifications(
    db: DbSession,
    user: CurrentUser,
    before: datetime | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = notifications.PAGE_SIZE,
) -> NotificationPage:
    items = notifications.list_for(db, user.id, before=before, limit=limit)
    return NotificationPage(
        items=[NotificationOut.model_validate(n) for n in items],
        unread_count=notifications.unread_count(db, user.id),
        next_before=items[-1].created_at if len(items) == limit else None,
    )


@router.get(
    "/notifications/unread-count",
    response_model=UnreadCount,
    responses=_ERRORS,
    summary="Unread notifications (for the bell badge)",
)
def unread(db: DbSession, user: CurrentUser) -> UnreadCount:
    return UnreadCount(unread_count=notifications.unread_count(db, user.id))


@router.post(
    "/notifications/{notification_id}/read",
    response_model=NotificationOut,
    responses=_ERRORS,
    summary="Mark one notification read",
)
def read_one(notification_id: uuid.UUID, db: DbSession, user: CurrentUser) -> NotificationOut:
    note = notifications.mark_read(db, user.id, notification_id)
    db.commit()
    return NotificationOut.model_validate(note)


@router.post(
    "/notifications/read-all",
    response_model=UnreadCount,
    responses=_ERRORS,
    summary="Mark all notifications read",
)
def read_all(db: DbSession, user: CurrentUser) -> UnreadCount:
    notifications.mark_all_read(db, user.id)
    db.commit()
    return UnreadCount(unread_count=0)


@router.post(
    "/me/push-devices",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=_ERRORS,
    summary="Register this device's Expo push token (idempotent)",
)
def register_device(data: PushDeviceIn, db: DbSession, user: CurrentUser) -> Response:
    notifications.register_device(db, user.id, data.token, data.platform)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/me/push-devices/unregister",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=_ERRORS,
    summary="Stop pushes to this device (e.g. on sign-out)",
)
def unregister_device(data: PushDeviceOut, db: DbSession, user: CurrentUser) -> Response:
    notifications.unregister_device(db, user.id, data.token)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
