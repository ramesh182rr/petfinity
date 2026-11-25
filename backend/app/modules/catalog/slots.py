"""Slot generation (pure functions; no database access).

Slots are generated in the owner's local timezone and returned in UTC.
Each opening window yields back-to-back slots of the service's duration,
e.g. 09:00-13:00 with a 30-minute service → 09:00, 09:30, … 12:30.
Bookings are subtracted by the booking engine (milestone 2.6).
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from itertools import pairwise
from typing import Protocol
from zoneinfo import ZoneInfo

MIN_LEAD = timedelta(minutes=30)
HORIZON_DAYS = 60


@dataclass(frozen=True)
class Window:
    start: time
    end: time
    capacity: int


@dataclass(frozen=True)
class Slot:
    start: datetime  # aware, UTC
    end: datetime
    local_start: time
    capacity: int


class ExceptionLike(Protocol):
    """Anything shaped like an AvailabilityException."""

    on_date: date
    kind: str
    start_time: time | None
    end_time: time | None
    capacity: int | None


class RuleLike(Protocol):
    """Anything shaped like an AvailabilityRule (model rows or test doubles)."""

    weekday: int
    start_time: time
    end_time: time
    capacity: int


def windows_for_date(
    on: date,
    rules: Iterable[RuleLike],
    exceptions: Iterable[ExceptionLike],
) -> list[Window]:
    """Exceptions for the date win: 'closed' → none; 'custom_hours' → replace weekly hours."""
    todays = [e for e in exceptions if e.on_date == on]
    if any(e.kind == "closed" for e in todays):
        return []
    custom = [e for e in todays if e.kind == "custom_hours"]
    if custom:
        windows = [
            Window(e.start_time, e.end_time, e.capacity or 1)
            for e in custom
            if e.start_time is not None and e.end_time is not None
        ]
    else:
        windows = [
            Window(r.start_time, r.end_time, r.capacity) for r in rules if r.weekday == on.weekday()
        ]
    return sorted(windows, key=lambda w: w.start)


def generate_slots(
    on: date,
    windows: Iterable[Window],
    *,
    timezone: str,
    duration_minutes: int,
    now: datetime,
    min_lead: timedelta = MIN_LEAD,
) -> list[Slot]:
    tz = ZoneInfo(timezone)
    duration = timedelta(minutes=duration_minutes)
    earliest = now + min_lead
    slots: list[Slot] = []
    for window in windows:
        cursor = datetime.combine(on, window.start, tzinfo=tz)
        window_end = datetime.combine(on, window.end, tzinfo=tz)
        while cursor + duration <= window_end:
            if cursor >= earliest:
                slots.append(
                    Slot(
                        start=cursor.astimezone(ZoneInfo("UTC")),
                        end=(cursor + duration).astimezone(ZoneInfo("UTC")),
                        local_start=cursor.timetz().replace(tzinfo=None),
                        capacity=window.capacity,
                    )
                )
            cursor += duration
    return slots


def overlaps(ranges: list[tuple[time, time]]) -> bool:
    ordered = sorted(ranges)
    return any(prev[1] > nxt[0] for prev, nxt in pairwise(ordered))
