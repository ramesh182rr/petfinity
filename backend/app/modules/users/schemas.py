from __future__ import annotations

import uuid

from pydantic import BaseModel, Field, field_validator

from app.core.types import UtcDatetime


class MeResponse(BaseModel):
    id: uuid.UUID
    display_name: str | None
    email: str | None
    email_verified: bool
    phone: str | None
    phone_verified: bool
    capabilities: list[str] = Field(
        description="Derived capabilities, e.g. pet_parent, moderator, admin (decision 0006)"
    )
    created_at: UtcDatetime


class MeUpdate(BaseModel):
    display_name: str = Field(min_length=1, max_length=60)

    @field_validator("display_name")
    @classmethod
    def _clean_name(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("display name cannot be blank")
        if any(ord(ch) < 32 for ch in cleaned):
            raise ValueError("display name contains invalid characters")
        return cleaned
