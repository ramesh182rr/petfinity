"""Which capacity units are taken when (no imports from catalog/discovery: avoids cycles)."""

from __future__ import annotations

import uuid
from collections import defaultdict
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import ColumnElement, and_, not_, select
from sqlalchemy.orm import Session

from app.modules.bookings.models import HOLDING_STATUSES, Booking, BookingStatus


@dataclass(frozen=True)
class Busy:
    start: datetime
    end: datetime
    unit: int


def holding_clause(now: datetime) -> ColumnElement[bool]:
    """Slot-holding bookings; a request past its deadline no longer holds (it will expire)."""
    return and_(
        Booking.status.in_(HOLDING_STATUSES),
        not_(
            and_(
                Booking.status == BookingStatus.PENDING_PROVIDER,
                Booking.response_deadline < now,
            )
        ),
    )


def busy_by_resource(
    db: Session,
    resource_ids: Sequence[uuid.UUID],
    start: datetime,
    end: datetime,
    now: datetime,
    *,
    exclude_booking: uuid.UUID | None = None,
) -> dict[uuid.UUID, list[Busy]]:
    grouped: dict[uuid.UUID, list[Busy]] = defaultdict(list)
    if not resource_ids:
        return grouped
    query = select(
        Booking.resource_id, Booking.start_at, Booking.end_at, Booking.capacity_unit
    ).where(
        Booking.resource_id.in_(resource_ids),
        Booking.start_at < end,
        Booking.end_at > start,
        holding_clause(now),
    )
    if exclude_booking is not None:
        query = query.where(Booking.id != exclude_booking)
    for resource_id, b_start, b_end, unit in db.execute(query):
        grouped[resource_id].append(Busy(b_start, b_end, unit))
    return grouped


def free_unit(start: datetime, end: datetime, capacity: int, busy: Iterable[Busy]) -> int | None:
    """The lowest capacity unit with nothing overlapping [start, end), if any."""
    taken = {b.unit for b in busy if b.start < end and start < b.end}
    return next((unit for unit in range(1, capacity + 1) if unit not in taken), None)
