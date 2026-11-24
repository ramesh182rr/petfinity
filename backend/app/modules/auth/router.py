"""Authentication endpoints (decision 0007)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Header, Request, Response, status

from app.api.deps import AppSettings, CurrentAuth, DbSession, get_otp_sender
from app.core.errors import error_responses
from app.modules.auth import service
from app.modules.auth.otp_delivery import OtpSender
from app.modules.auth.schemas import (
    OtpRequest,
    OtpRequestResponse,
    OtpVerify,
    RefreshRequest,
    SignInResponse,
    TokenResponse,
)
from app.modules.users.router import to_me_response

router = APIRouter(prefix="/auth", tags=["auth"])

_ERRORS = error_responses(400, 401, 403, 422, 429)


def _client_ip(request: Request) -> str | None:
    # Behind Render's proxy, uvicorn --proxy-headers sets request.client from X-Forwarded-For.
    return request.client.host if request.client else None


@router.post(
    "/otp/request",
    response_model=OtpRequestResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Send a one-time sign-in code to an email address or mobile number",
    description="Same response whether or not an account exists (no account enumeration).",
    responses=_ERRORS,
)
def request_otp(
    body: OtpRequest,
    request: Request,
    db: DbSession,
    settings: AppSettings,
    sender: Annotated[OtpSender, Depends(get_otp_sender)],
) -> OtpRequestResponse:
    result = service.request_otp(
        db,
        settings,
        sender,
        channel=body.channel,
        destination=body.destination,
        client_ip=_client_ip(request),
    )
    return OtpRequestResponse(
        destination_masked=result.destination_masked,
        expires_in_seconds=result.expires_in_seconds,
        resend_after_seconds=result.resend_after_seconds,
    )


@router.post(
    "/otp/verify",
    response_model=SignInResponse,
    summary="Verify a code; signs in, creating the account on first use",
    responses=_ERRORS,
)
def verify_otp(
    body: OtpVerify,
    db: DbSession,
    settings: AppSettings,
    user_agent: Annotated[str | None, Header()] = None,
) -> SignInResponse:
    result = service.verify_otp(
        db,
        settings,
        channel=body.channel,
        destination=body.destination,
        code=body.code,
        user_agent=user_agent,
    )
    tokens = result.tokens
    return SignInResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        expires_in=tokens.expires_in,
        refresh_expires_at=tokens.refresh_expires_at,
        user=to_me_response(db, result.user),
        is_new_user=result.is_new_user,
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Rotate the refresh token and issue a new access token",
    responses=_ERRORS,
)
def refresh(
    body: RefreshRequest,
    db: DbSession,
    settings: AppSettings,
    user_agent: Annotated[str | None, Header()] = None,
) -> TokenResponse:
    tokens = service.refresh_session(
        db, settings, refresh_token=body.refresh_token, user_agent=user_agent
    )
    return TokenResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        expires_in=tokens.expires_in,
        refresh_expires_at=tokens.refresh_expires_at,
    )


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="End the current session",
    responses=_ERRORS,
)
def logout(db: DbSession, auth: CurrentAuth) -> Response:
    service.revoke_session(db, auth.session_id, reason="logout")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
