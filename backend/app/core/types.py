"""Shared Pydantic field types."""

from datetime import UTC, datetime
from typing import Annotated

from pydantic import AfterValidator


def _to_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        raise ValueError("datetime must be timezone-aware")
    return value.astimezone(UTC)


UtcDatetime = Annotated[datetime, AfterValidator(_to_utc)]
"""API timestamps are always serialised in UTC (doc 12), whatever the DB session timezone."""
