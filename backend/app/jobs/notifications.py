"""Booking reminders and the push outbox (decision 0013).

    uv run python -m app.jobs.notifications

Run every 5 minutes (Render cron), after `app.jobs.expire_bookings`. It queues
day-before and 2-hours-before reminders (each sent once), then pushes anything
still pending. The API also pushes right after each booking change, so this is
the safety net plus the reminder clock.
"""

from __future__ import annotations

from sqlalchemy import Engine

import app.db.registry  # noqa: F401 - registers every model's mapper
from app.core import clock
from app.core.config import get_settings
from app.db.session import create_db_engine, create_session_factory
from app.modules.notifications.bookings import queue_reminders
from app.modules.notifications.push import PushSender, create_push_sender
from app.modules.notifications.service import deliver_pending


def run(engine: Engine, sender: PushSender) -> tuple[int, int]:
    """Returns (reminders queued, pushes sent)."""
    factory = create_session_factory(engine)
    with factory() as db, db.begin():
        queued = queue_reminders(db, clock.utcnow())
    sent = 0
    while True:
        with factory() as db, db.begin():
            batch = deliver_pending(db, sender)
        sent += batch
        if batch == 0:
            return queued, sent


def main() -> int:
    settings = get_settings()
    queued, sent = run(create_db_engine(settings), create_push_sender(settings))
    print(f"Queued {queued} reminder(s); sent {sent} push notification(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
