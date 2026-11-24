from __future__ import annotations

from pydantic import BaseModel, Field

from app.core.types import UtcDatetime
from app.modules.auth.identifiers import Channel
from app.modules.users.schemas import MeResponse


class OtpRequest(BaseModel):
    channel: Channel
    destination: str = Field(
        min_length=3,
        max_length=320,
        description="Email address, or mobile number (E.164 or 10-digit Indian)",
    )


class OtpRequestResponse(BaseModel):
    destination_masked: str
    expires_in_seconds: int
    resend_after_seconds: int


class OtpVerify(BaseModel):
    channel: Channel
    destination: str = Field(min_length=3, max_length=320)
    code: str = Field(pattern=r"^\s*\d{6}\s*$")


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"  # noqa: S105 - OAuth token type, not a secret
    expires_in: int = Field(description="Access token lifetime in seconds")
    refresh_expires_at: UtcDatetime


class SignInResponse(TokenResponse):
    user: MeResponse
    is_new_user: bool


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=20, max_length=200)
