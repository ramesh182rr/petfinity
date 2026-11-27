from __future__ import annotations

import re
import uuid
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.types import UtcDatetime

_EXPO_TOKEN = re.compile(r"^Expo(nent)?PushToken\[[A-Za-z0-9_\-]{10,100}\]$")


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    kind: str
    title: str
    body: str
    data: dict[str, Any]
    read_at: UtcDatetime | None
    created_at: UtcDatetime


class NotificationPage(BaseModel):
    items: list[NotificationOut]
    unread_count: int
    next_before: UtcDatetime | None = Field(description="Pass as `before` for the next page")


class UnreadCount(BaseModel):
    unread_count: int


class PushDeviceIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str = Field(description="Expo push token, e.g. ExponentPushToken[xxxx]")
    platform: Literal["android", "ios"]

    @field_validator("token")
    @classmethod
    def _expo_token(cls, value: str) -> str:
        value = value.strip()
        if not _EXPO_TOKEN.fullmatch(value):
            raise ValueError("not an Expo push token")
        return value


class PushDeviceOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str
