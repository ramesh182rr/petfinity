"""Expire booking requests the provider didn't answer in time (decision 0004).

    uv run python -m app.jobs.expire_bookings

Run every few minutes from a scheduler (a Render cron job in staging and
production). The API also expires overdue requests whenever it reads or books
for a listing, so a missed run never blocks a slot: this job just keeps
statuses tidy and is where reminders and notifications will hook in (2.9).
"""

from __future__ import annotations

from sqlalchemy import Engine

import app.db.registry  # noqa: F401 - registers every model's mapper
from app.core import clock
from app.core.config import get_settings
from app.db.session import create_db_engine, create_session_factory
from app.modules.bookings.service import expire_overdue


def run(engine: Engine) -> int:
    """Expire every overdue request; returns how many changed."""
    factory = create_session_factory(engine)
    total = 0
    while True:
        with factory() as db, db.begin():
            changed = expire_overdue(db, clock.utcnow())
        total += changed
        if changed == 0:
            return total


def main() -> int:
    expired = run(create_db_engine(get_settings()))
    print(f"Expired {expired} booking request(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
