"""Pure slot-generation logic (milestone 2.4)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, time

from app.modules.catalog.slots import Window, generate_slots, overlaps, windows_for_date


@dataclass
class Rule:
    weekday: int
    start_time: time
    end_time: time
    capacity: int = 1


@dataclass
class Exc:
    on_date: date
    kind: str
    start_time: time | None = None
    end_time: time | None = None
    capacity: int | None = None


MONDAY = date(2026, 12, 7)
LONG_AGO = datetime(2026, 1, 1, tzinfo=UTC)
RULES = [Rule(0, time(9), time(13)), Rule(0, time(15), time(18), 2), Rule(1, time(10), time(12))]


def test_weekly_rules_with_break() -> None:
    windows = windows_for_date(MONDAY, RULES, [])
    assert windows == [Window(time(9), time(13), 1), Window(time(15), time(18), 2)]


def test_closed_day_has_no_windows() -> None:
    assert windows_for_date(MONDAY, RULES, [Exc(MONDAY, "closed")]) == []


def test_special_hours_replace_weekly_hours() -> None:
    windows = windows_for_date(MONDAY, RULES, [Exc(MONDAY, "custom_hours", time(10), time(11), 3)])
    assert windows == [Window(time(10), time(11), 3)]


def test_exceptions_for_other_dates_are_ignored() -> None:
    other = Exc(date(2026, 12, 8), "closed")
    assert len(windows_for_date(MONDAY, RULES, [other])) == 2


def test_slots_fill_windows_back_to_back_in_local_time() -> None:
    slots = generate_slots(
        MONDAY,
        [Window(time(9), time(10, 30), 2)],
        timezone="Asia/Kolkata",
        duration_minutes=30,
        now=LONG_AGO,
    )
    assert [s.local_start for s in slots] == [time(9), time(9, 30), time(10)]
    # 09:00 IST = 03:30 UTC
    assert slots[0].start == datetime(2026, 12, 7, 3, 30, tzinfo=UTC)
    assert slots[0].end == datetime(2026, 12, 7, 4, 0, tzinfo=UTC)
    assert all(s.capacity == 2 for s in slots)


def test_slots_never_overrun_the_window() -> None:
    slots = generate_slots(
        MONDAY,
        [Window(time(9), time(10), 1)],
        timezone="Asia/Kolkata",
        duration_minutes=45,
        now=LONG_AGO,
    )
    assert [s.local_start for s in slots] == [time(9)]


def test_past_and_too_soon_slots_are_hidden() -> None:
    now = datetime(2026, 12, 7, 4, 0, tzinfo=UTC)  # 09:30 IST
    slots = generate_slots(
        MONDAY,
        [Window(time(9), time(12), 1)],
        timezone="Asia/Kolkata",
        duration_minutes=30,
        now=now,
    )
    # 30-minute lead time: earliest bookable start is 10:00 IST
    assert slots[0].local_start == time(10)


def test_overlap_detection() -> None:
    assert overlaps([(time(9), time(12)), (time(11), time(13))])
    assert not overlaps([(time(9), time(12)), (time(12), time(13))])
    assert not overlaps([(time(15), time(16)), (time(9), time(10))])
