"""Passwordless OTP sign-in and refresh-token sessions (decision 0007).

Services commit explicitly: failed OTP attempts must be persisted even though
the request then fails.
"""

from __future__ import annotations

import hmac
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.core.config import Settings
from app.core.errors import AppError
from app.modules.audit import service as audit
from app.modules.auth.identifiers import Channel, Identifier, parse_identifier
from app.modules.auth.models import AuthSession, OtpChallenge
from app.modules.auth.otp_delivery import OtpSender
from app.modules.auth.tokens import (
    AccessClaims,
    create_access_token,
    generate_otp_code,
    generate_refresh_token,
    keyed_hash,
    sha256_hex,
)
from app.modules.staff import service as staff
from app.modules.users import service as users
from app.modules.users.models import User

logger = logging.getLogger(__name__)


def _invalid_code() -> AppError:
    return AppError("invalid_code", "That code is incorrect or has expired.", status_code=400)


@dataclass(frozen=True)
class OtpRequestResult:
    destination_masked: str
    expires_in_seconds: int
    resend_after_seconds: int


@dataclass(frozen=True)
class TokenPair:
    access_token: str
    refresh_token: str
    expires_in: int
    refresh_expires_at: datetime


@dataclass(frozen=True)
class SignInResult:
    user: User
    tokens: TokenPair
    is_new_user: bool


# --- hashing helpers -----------------------------------------------------------


def _pepper(settings: Settings) -> str:
    return settings.otp_pepper.get_secret_value()


def _destination_hash(settings: Settings, identifier: Identifier) -> str:
    return keyed_hash(_pepper(settings), f"{identifier.channel.value}:{identifier.value}")


def _code_hash(settings: Settings, challenge_id: uuid.UUID, code: str) -> str:
    return keyed_hash(_pepper(settings), f"{challenge_id}:{code}")


def _ip_hash(settings: Settings, ip: str | None) -> str | None:
    return keyed_hash(_pepper(settings), f"ip:{ip}") if ip else None


def _rate_limited(retry_after: int) -> AppError:
    return AppError(
        "rate_limited",
        "Too many code requests. Please wait and try again.",
        status_code=429,
        details={"retry_after_seconds": max(retry_after, 1)},
    )


# --- OTP request ---------------------------------------------------------------


def request_otp(
    db: Session,
    settings: Settings,
    sender: OtpSender,
    *,
    channel: Channel,
    destination: str,
    client_ip: str | None,
) -> OtpRequestResult:
    identifier = parse_identifier(channel, destination)
    now = utcnow()
    hour_ago = now - timedelta(hours=1)
    dest_hash = _destination_hash(settings, identifier)
    ip_hash = _ip_hash(settings, client_ip)

    recent = list(
        db.scalars(
            select(OtpChallenge.created_at)
            .where(OtpChallenge.destination_hash == dest_hash, OtpChallenge.created_at > hour_ago)
            .order_by(OtpChallenge.created_at.desc())
        )
    )
    if recent:
        since_last = (now - recent[0]).total_seconds()
        if since_last < settings.otp_resend_cooldown_seconds:
            raise _rate_limited(int(settings.otp_resend_cooldown_seconds - since_last))
    if len(recent) >= settings.otp_max_per_destination_per_hour:
        oldest = recent[-1]
        raise _rate_limited(int((oldest + timedelta(hours=1) - now).total_seconds()))
    if ip_hash is not None:
        ip_count = db.scalar(
            select(func.count())
            .select_from(OtpChallenge)
            .where(OtpChallenge.ip_hash == ip_hash, OtpChallenge.created_at > hour_ago)
        )
        if (ip_count or 0) >= settings.otp_max_per_ip_per_hour:
            raise _rate_limited(3600)

    # A new code supersedes any outstanding ones for this destination.
    db.execute(
        update(OtpChallenge)
        .where(OtpChallenge.destination_hash == dest_hash, OtpChallenge.consumed_at.is_(None))
        .values(consumed_at=now)
    )

    code = generate_otp_code()
    challenge = OtpChallenge(
        id=uuid.uuid4(),
        channel=identifier.channel.value,
        destination_hash=dest_hash,
        ip_hash=ip_hash,
        expires_at=now + timedelta(seconds=settings.otp_ttl_seconds),
        created_at=now,
        code_hash="",
    )
    challenge.code_hash = _code_hash(settings, challenge.id, code)
    db.add(challenge)
    db.commit()

    # Sent after commit so a delivered code always has a stored challenge.
    sender.send(identifier, code, settings.otp_ttl_seconds // 60)

    return OtpRequestResult(
        destination_masked=identifier.masked(),
        expires_in_seconds=settings.otp_ttl_seconds,
        resend_after_seconds=settings.otp_resend_cooldown_seconds,
    )


# --- OTP verify / sign in --------------------------------------------------------


def verify_otp(
    db: Session,
    settings: Settings,
    *,
    channel: Channel,
    destination: str,
    code: str,
    user_agent: str | None,
) -> SignInResult:
    identifier = parse_identifier(channel, destination)
    now = utcnow()
    dest_hash = _destination_hash(settings, identifier)

    challenge = db.scalars(
        select(OtpChallenge)
        .where(OtpChallenge.destination_hash == dest_hash, OtpChallenge.consumed_at.is_(None))
        .order_by(OtpChallenge.created_at.desc())
        .limit(1)
        .with_for_update()
    ).first()
    if challenge is None or challenge.expires_at <= now:
        db.rollback()
        raise _invalid_code()
    if challenge.attempts >= settings.otp_max_attempts:
        db.rollback()
        raise AppError(
            "too_many_attempts", "Too many incorrect attempts. Request a new code.", status_code=429
        )

    challenge.attempts += 1
    expected = _code_hash(settings, challenge.id, code.strip())
    if not hmac.compare_digest(expected, challenge.code_hash):
        db.commit()  # persist the failed attempt
        raise _invalid_code()

    challenge.consumed_at = now
    user = users.find_by_identifier(db, identifier, for_update=True)
    is_new_user = user is None
    if user is None:
        user = users.create_verified_user(db, identifier, now)
    else:
        users.mark_verified(user, identifier, now)

    if not user.is_active:
        db.commit()  # keep the code consumed
        raise AppError(
            "account_suspended",
            "This account is suspended. Please contact support.",
            status_code=403,
        )

    staff.bootstrap_admin_if_listed(db, settings, user)
    tokens = _create_session(db, settings, user, user_agent, now)
    audit.record(
        db,
        "auth.signed_in",
        actor_user_id=user.id,
        target_type="user",
        target_id=user.id,
        details={"via": identifier.channel.value, "new_user": is_new_user},
    )
    db.commit()
    return SignInResult(user=user, tokens=tokens, is_new_user=is_new_user)


# --- sessions ------------------------------------------------------------------


def _create_session(
    db: Session, settings: Settings, user: User, user_agent: str | None, now: datetime
) -> TokenPair:
    refresh_token = generate_refresh_token()
    absolute = now + timedelta(days=settings.refresh_token_absolute_ttl_days)
    session = AuthSession(
        id=uuid.uuid4(),
        user_id=user.id,
        refresh_token_hash=sha256_hex(refresh_token),
        user_agent=(user_agent or "")[:200] or None,
        created_at=now,
        last_used_at=now,
        expires_at=min(now + timedelta(days=settings.refresh_token_ttl_days), absolute),
        absolute_expires_at=absolute,
    )
    db.add(session)
    db.flush()
    return TokenPair(
        access_token=create_access_token(settings, user.id, session.id),
        refresh_token=refresh_token,
        expires_in=settings.access_token_ttl_seconds,
        refresh_expires_at=session.expires_at,
    )


def _invalid_refresh() -> AppError:
    return AppError(
        "invalid_refresh_token", "Your session has ended. Please sign in again.", status_code=401
    )


def refresh_session(
    db: Session, settings: Settings, *, refresh_token: str, user_agent: str | None
) -> TokenPair:
    now = utcnow()
    token_hash = sha256_hex(refresh_token)
    session = db.scalars(
        select(AuthSession).where(AuthSession.refresh_token_hash == token_hash).with_for_update()
    ).first()

    if session is None:
        reused = db.scalars(
            select(AuthSession)
            .where(AuthSession.previous_refresh_token_hash == token_hash)
            .with_for_update()
        ).first()
        if reused is not None and reused.revoked_at is None:
            # A rotated token was presented again: assume theft, end the session.
            reused.revoked_at = now
            reused.revoke_reason = "refresh_reuse"
            audit.record(
                db,
                "auth.refresh_reuse_detected",
                actor_user_id=None,
                target_type="auth_session",
                target_id=reused.id,
            )
            db.commit()
            logger.warning("refresh_token_reuse", extra={"session_id": str(reused.id)})
        else:
            db.rollback()
        raise _invalid_refresh()

    user = users.get_user(db, session.user_id)
    if (
        session.revoked_at is not None
        or session.expires_at <= now
        or session.absolute_expires_at <= now
        or user is None
        or not user.is_active
    ):
        db.rollback()
        raise _invalid_refresh()

    new_refresh = generate_refresh_token()
    session.previous_refresh_token_hash = session.refresh_token_hash
    session.refresh_token_hash = sha256_hex(new_refresh)
    session.last_used_at = now
    session.expires_at = min(
        now + timedelta(days=settings.refresh_token_ttl_days), session.absolute_expires_at
    )
    if user_agent:
        session.user_agent = user_agent[:200]
    db.commit()
    return TokenPair(
        access_token=create_access_token(settings, user.id, session.id),
        refresh_token=new_refresh,
        expires_in=settings.access_token_ttl_seconds,
        refresh_expires_at=session.expires_at,
    )


def revoke_session(db: Session, session_id: uuid.UUID, *, reason: str) -> None:
    session = db.get(AuthSession, session_id, with_for_update=True)
    if session is not None and session.revoked_at is None:
        session.revoked_at = utcnow()
        session.revoke_reason = reason
        audit.record(
            db,
            "auth.signed_out",
            actor_user_id=session.user_id,
            target_type="auth_session",
            target_id=session.id,
        )
    db.commit()


def authenticate(db: Session, claims: AccessClaims) -> User:
    """Validate that an access token's session is live and its user is active."""
    session = db.get(AuthSession, claims.session_id)
    now = utcnow()
    if (
        session is None
        or session.user_id != claims.user_id
        or session.revoked_at is not None
        or session.absolute_expires_at <= now
    ):
        raise AppError(
            "unauthorized", "Your session has ended. Please sign in again.", status_code=401
        )
    user = users.get_user(db, claims.user_id)
    if user is None:
        raise AppError("unauthorized", "Please sign in again.", status_code=401)
    if not user.is_active:
        raise AppError(
            "account_suspended",
            "This account is suspended. Please contact support.",
            status_code=403,
        )
    return user
