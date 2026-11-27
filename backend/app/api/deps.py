"""Shared request dependencies: settings, DB session, authenticated user, staff roles.

Authorisation layers (decision 0006): authenticated -> capability -> resource scope
-> verification/state gate. These dependencies cover the first two; resource
scope is always checked in the owning module's service.
"""

from __future__ import annotations

import uuid
from collections.abc import Callable
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import AppError
from app.db.session import get_db
from app.modules.auth import service as auth_service
from app.modules.auth.otp_delivery import OtpSender
from app.modules.auth.tokens import InvalidTokenError, decode_access_token
from app.modules.staff import service as staff_service
from app.modules.staff.models import StaffRoleName
from app.modules.users.models import User

_bearer = HTTPBearer(auto_error=False, description="Access token from /auth/otp/verify")


def get_settings_dep(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


def get_otp_sender(request: Request) -> OtpSender:
    sender: OtpSender = request.app.state.otp_sender
    return sender


DbSession = Annotated[Session, Depends(get_db)]
AppSettings = Annotated[Settings, Depends(get_settings_dep)]


@dataclass(frozen=True)
class AuthContext:
    user: User
    session_id: uuid.UUID


def get_auth_context(
    db: DbSession,
    settings: AppSettings,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> AuthContext:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise AppError("unauthorized", "Please sign in to continue.", status_code=401)
    try:
        claims = decode_access_token(settings, credentials.credentials)
    except InvalidTokenError as exc:
        raise AppError(
            "unauthorized", "Your session has expired. Please sign in again.", status_code=401
        ) from exc
    user = auth_service.authenticate(db, claims)
    return AuthContext(user=user, session_id=claims.session_id)


CurrentAuth = Annotated[AuthContext, Depends(get_auth_context)]


def get_current_user(auth: CurrentAuth) -> User:
    return auth.user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_staff_role(role: StaffRoleName) -> Callable[[Session, User], User]:
    def dependency(db: DbSession, user: CurrentUser) -> User:
        if not staff_service.has_role(db, user.id, role):
            raise AppError("forbidden", "You don't have permission to do that.", status_code=403)
        return user

    return dependency


AdminUser = Annotated[User, Depends(require_staff_role(StaffRoleName.ADMIN))]


def require_moderation(db: DbSession, user: CurrentUser) -> User:
    """Moderators or admins (decision 0006): content moderation such as reviews."""
    roles = staff_service.active_role_names(db, user.id)
    if not roles & {StaffRoleName.MODERATOR.value, StaffRoleName.ADMIN.value}:
        raise AppError("forbidden", "You don't have permission to do that.", status_code=403)
    return user


ModeratorUser = Annotated[User, Depends(require_moderation)]
