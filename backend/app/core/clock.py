"""Single source of 'now' (timezone-aware UTC), easy to patch in tests."""

from datetime import UTC, datetime


def utcnow() -> datetime:
    return datetime.now(UTC)
