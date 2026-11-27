"""Notifications: store first (in-app inbox), then push from the outbox (decision 0013)."""

from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import clock
from app.core.errors import AppError
from app.modules.notifications.models import Notification, PushDevice, PushStatus
from app.modules.notifications.push import PushMessage, PushSender

# Pushes older than this are not sent any more (a stale reminder is worse than none).
PUSH_MAX_AGE = timedelta(hours=6)
MAX_PUSH_ATTEMPTS = 3
PAGE_SIZE = 30


def notify(
    db: Session,
    user_id: uuid.UUID,
    kind: str,
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
    *,
    dedupe_key: str | None = None,
) -> Notification | None:
    """Store a notification; returns None when `dedupe_key` was already used for this user."""
    note = Notification(
        user_id=user_id,
        kind=kind,
        title=title[:120],
        body=body[:300],
        data=data or {},
        dedupe_key=dedupe_key,
        push_status=PushStatus.PENDING,
    )
    if dedupe_key is None:
        db.add(note)
        return note
    try:
        with db.begin_nested():
            db.add(note)
            db.flush()
    except IntegrityError:
        return None
    return note


# ---------------------------------------------------------------- inbox


def list_for(
    db: Session, user_id: uuid.UUID, *, before: datetime | None, limit: int = PAGE_SIZE
) -> list[Notification]:
    query = select(Notification).where(Notification.user_id == user_id)
    if before is not None:
        query = query.where(Notification.created_at < before)
    return list(
        db.scalars(
            query.order_by(Notification.created_at.desc(), Notification.id.desc()).limit(limit)
        )
    )


def unread_count(db: Session, user_id: uuid.UUID) -> int:
    return int(
        db.scalar(
            select(func.count())
            .select_from(Notification)
            .where(Notification.user_id == user_id, Notification.read_at.is_(None))
        )
        or 0
    )


def mark_read(db: Session, user_id: uuid.UUID, notification_id: uuid.UUID) -> Notification:
    note = db.get(Notification, notification_id)
    if note is None or note.user_id != user_id:
        raise AppError("not_found", "We couldn't find that notification.", status_code=404)
    if note.read_at is None:
        note.read_at = clock.utcnow()
    db.flush()
    return note


def mark_all_read(db: Session, user_id: uuid.UUID) -> None:
    db.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.read_at.is_(None))
        .values(read_at=clock.utcnow())
    )


# ---------------------------------------------------------------- devices


def register_device(db: Session, user_id: uuid.UUID, token: str, platform: str) -> None:
    """Idempotent. A token that moves to another account (new sign-in) follows the user."""
    device = db.scalars(select(PushDevice).where(PushDevice.token == token)).first()
    now = clock.utcnow()
    if device is None:
        db.add(PushDevice(user_id=user_id, token=token, platform=platform, last_seen_at=now))
    else:
        device.user_id, device.platform = user_id, platform
        device.last_seen_at, device.disabled_at = now, None
    db.flush()


def unregister_device(db: Session, user_id: uuid.UUID, token: str) -> None:
    device = db.scalars(select(PushDevice).where(PushDevice.token == token)).first()
    if device is not None and device.user_id == user_id:
        db.delete(device)
        db.flush()


# ---------------------------------------------------------------- delivery (outbox)


def deliver_pending(db: Session, sender: PushSender, *, limit: int = 200) -> int:
    """Push pending notifications to each recipient's active devices. Returns how many sent."""
    now = clock.utcnow()
    pending = list(
        db.scalars(
            select(Notification)
            .where(Notification.push_status == PushStatus.PENDING)
            .order_by(Notification.created_at)
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
    )
    if not pending:
        return 0
    devices: dict[uuid.UUID, list[PushDevice]] = defaultdict(list)
    for device in db.scalars(
        select(PushDevice).where(
            PushDevice.user_id.in_({n.user_id for n in pending}), PushDevice.disabled_at.is_(None)
        )
    ):
        devices[device.user_id].append(device)

    messages: list[PushMessage] = []
    owners: list[tuple[Notification, PushDevice]] = []
    for note in pending:
        targets = devices.get(note.user_id, [])
        if not targets or now - note.created_at > PUSH_MAX_AGE:
            note.push_status = PushStatus.SKIPPED
            continue
        note.push_attempts += 1
        for device in targets:
            messages.append(
                PushMessage(
                    token=device.token,
                    title=note.title,
                    body=note.body,
                    data={**note.data, "notification_id": str(note.id)},
                )
            )
            owners.append((note, device))

    sent: set[uuid.UUID] = set()
    failed: set[uuid.UUID] = set()
    if messages:
        for (note, device), result in zip(owners, sender.send(messages), strict=True):
            if result.ok:
                sent.add(note.id)
            else:
                failed.add(note.id)
                if result.device_gone:
                    device.disabled_at = now
    for note in pending:
        if note.id in sent:
            note.push_status = PushStatus.SENT
        elif note.id in failed and note.push_attempts >= MAX_PUSH_ATTEMPTS:
            note.push_status = PushStatus.FAILED
    db.flush()
    return len(sent)
