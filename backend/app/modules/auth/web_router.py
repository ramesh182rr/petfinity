"""Browser sign-in for the admin web app (decision 0009).

Browsers can't use the OS keychain, so the refresh token lives in an httpOnly,
Secure, SameSite=Strict cookie scoped to /api/v1/auth/web. JavaScript never sees
it; the short-lived access token is held in memory by the web app.

CSRF: SameSite=Strict, plus a required custom header (X-Requested-With) that a
cross-site form cannot send and that triggers a CORS preflight for other origins.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Header, Response, status
from pydantic import BaseModel

from app.api.deps import AppSettings, CurrentAuth, DbSession
from app.core.config import Settings
from app.core.errors import AppError, error_responses
from app.core.types import UtcDatetime
from app.modules.auth import service
from app.modules.auth.schemas import OtpVerify
from app.modules.auth.service import TokenPair
from app.modules.users.router import to_me_response
from app.modules.users.schemas import MeResponse

COOKIE_NAME = "pf_web_refresh"
COOKIE_PATH = "/api/v1/auth/web"
CSRF_HEADER_VALUE = "petfinity-web"

router = APIRouter(prefix="/auth/web", tags=["auth"])
_ERRORS = error_responses(400, 401, 403, 429)


def require_csrf_header(
    x_requested_with: Annotated[str | None, Header()] = None,
) -> None:
    if x_requested_with != CSRF_HEADER_VALUE:
        raise AppError("forbidden", "Missing request header.", status_code=403)


Csrf = Annotated[None, Depends(require_csrf_header)]


class WebSession(BaseModel):
    access_token: str
    token_type: str = "bearer"  # noqa: S105 - OAuth token type, not a secret
    expires_in: int
    refresh_expires_at: UtcDatetime


class WebSignInResponse(WebSession):
    user: MeResponse
    is_new_user: bool


def _set_cookie(response: Response, settings: Settings, tokens: TokenPair) -> None:
    response.set_cookie(
        COOKIE_NAME,
        tokens.refresh_token,
        expires=tokens.refresh_expires_at,
        path=COOKIE_PATH,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
    )


def _clear_cookie(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        COOKIE_NAME,
        path=COOKIE_PATH,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
    )


@router.post(
    "/otp/verify",
    response_model=WebSignInResponse,
    responses=_ERRORS,
    summary="Verify a code (browser): refresh token set as an httpOnly cookie",
)
def web_verify(
    body: OtpVerify,
    response: Response,
    db: DbSession,
    settings: AppSettings,
    _csrf: Csrf,
    user_agent: Annotated[str | None, Header()] = None,
) -> WebSignInResponse:
    result = service.verify_otp(
        db,
        settings,
        channel=body.channel,
        destination=body.destination,
        code=body.code,
        user_agent=user_agent,
    )
    _set_cookie(response, settings, result.tokens)
    return WebSignInResponse(
        access_token=result.tokens.access_token,
        expires_in=result.tokens.expires_in,
        refresh_expires_at=result.tokens.refresh_expires_at,
        user=to_me_response(db, result.user),
        is_new_user=result.is_new_user,
    )


@router.post(
    "/refresh",
    response_model=WebSession,
    responses=_ERRORS,
    summary="Rotate the cookie refresh token and issue a new access token",
)
def web_refresh(
    response: Response,
    db: DbSession,
    settings: AppSettings,
    _csrf: Csrf,
    pf_web_refresh: Annotated[str | None, Cookie()] = None,
    user_agent: Annotated[str | None, Header()] = None,
) -> WebSession:
    if not pf_web_refresh:
        raise AppError("invalid_refresh_token", "Please sign in.", status_code=401)
    # On failure the error response is returned as-is; an invalid cookie is harmless
    # (the server already rejects it) and the app shows the sign-in screen.
    tokens = service.refresh_session(
        db, settings, refresh_token=pf_web_refresh, user_agent=user_agent
    )
    _set_cookie(response, settings, tokens)
    return WebSession(
        access_token=tokens.access_token,
        expires_in=tokens.expires_in,
        refresh_expires_at=tokens.refresh_expires_at,
    )


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=_ERRORS,
    summary="End the browser session and clear the cookie",
)
def web_logout(db: DbSession, settings: AppSettings, auth: CurrentAuth, _csrf: Csrf) -> Response:
    service.revoke_session(db, auth.session_id, reason="logout")
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    _clear_cookie(response, settings)
    return response
