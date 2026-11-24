"""Token and hashing primitives (decision 0007)."""

from __future__ import annotations

import hashlib
import hmac
import secrets
import uuid
from dataclasses import dataclass
from datetime import timedelta

import jwt

from app.core.clock import utcnow
from app.core.config import Settings

ALGORITHM = "HS256"


def keyed_hash(secret: str, value: str) -> str:
    """HMAC-SHA256 hex digest: used for OTP codes, identifiers and IPs at rest."""
    return hmac.new(secret.encode(), value.encode(), hashlib.sha256).hexdigest()


def sha256_hex(value: str) -> str:
    """Plain SHA-256 for high-entropy secrets (refresh tokens)."""
    return hashlib.sha256(value.encode()).hexdigest()


def generate_otp_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(32)  # 256 bits


@dataclass(frozen=True)
class AccessClaims:
    user_id: uuid.UUID
    session_id: uuid.UUID


class InvalidTokenError(Exception):
    pass


def create_access_token(settings: Settings, user_id: uuid.UUID, session_id: uuid.UUID) -> str:
    now = utcnow()
    payload = {
        "sub": str(user_id),
        "sid": str(session_id),
        "typ": "access",
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=settings.access_token_ttl_seconds)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret.get_secret_value(), algorithm=ALGORITHM)


def decode_access_token(settings: Settings, token: str) -> AccessClaims:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret.get_secret_value(),
            algorithms=[ALGORITHM],
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
            options={"require": ["sub", "sid", "exp", "iat", "typ"]},
        )
        if payload.get("typ") != "access":
            raise InvalidTokenError("wrong token type")
        return AccessClaims(user_id=uuid.UUID(payload["sub"]), session_id=uuid.UUID(payload["sid"]))
    except (jwt.PyJWTError, ValueError, KeyError) as exc:
        raise InvalidTokenError(str(exc)) from exc
