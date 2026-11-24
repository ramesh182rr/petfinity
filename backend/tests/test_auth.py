"""Passwordless OTP sign-in, sessions and refresh rotation (decision 0007)."""

from __future__ import annotations

from datetime import timedelta

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from app.core.clock import utcnow
from app.modules.auth.otp_delivery import RecordingOtpSender
from tests.conftest import bearer, sign_in

REQUEST = "/api/v1/auth/otp/request"
VERIFY = "/api/v1/auth/otp/verify"
REFRESH = "/api/v1/auth/refresh"
LOGOUT = "/api/v1/auth/logout"
ME = "/api/v1/me"


def request_code(api: TestClient, destination: str, channel: str = "email") -> TestClient:
    response = api.post(REQUEST, json={"channel": channel, "destination": destination})
    assert response.status_code == 202, response.text
    return api


# --- sign-up / sign-in ---------------------------------------------------------------


def test_email_sign_up_then_sign_in(api: TestClient, otp_sender: RecordingOtpSender) -> None:
    first = sign_in(api, otp_sender, "Asha.Kumar@Example.com")

    assert first["is_new_user"] is True
    assert first["token_type"] == "bearer"
    user = first["user"]
    assert isinstance(user, dict)
    assert user["email"] == "asha.kumar@example.com"
    assert user["email_verified"] is True
    assert user["phone"] is None
    assert user["capabilities"] == ["pet_parent"]

    second = sign_in(api, otp_sender, "asha.kumar@example.com")
    assert second["is_new_user"] is False
    assert isinstance(second["user"], dict)
    assert second["user"]["id"] == user["id"]


@pytest.mark.parametrize("raw", ["9876543210", "+91 98765 43210", "0091-98765-43210"])
def test_phone_sign_in_normalises_indian_numbers(
    api: TestClient, otp_sender: RecordingOtpSender, raw: str
) -> None:
    response = api.post(REQUEST, json={"channel": "phone", "destination": raw})
    assert response.status_code == 202
    assert response.json()["destination_masked"] == "+91******3210"

    body = sign_in(api, otp_sender, raw, channel="phone")
    assert isinstance(body["user"], dict)
    assert body["user"]["phone"] == "+919876543210"
    assert body["user"]["phone_verified"] is True


@pytest.mark.parametrize(
    ("channel", "destination"),
    [
        ("email", "not-an-email"),
        ("email", "a@b"),
        ("phone", "+91 1234567890"),  # Indian numbers must start 6-9
        ("phone", "12345"),
        ("phone", "+91987654321"),  # 9 digits
    ],
)
def test_invalid_identifiers_rejected(api: TestClient, channel: str, destination: str) -> None:
    response = api.post(REQUEST, json={"channel": channel, "destination": destination})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_identifier"


def test_request_response_does_not_reveal_whether_account_exists(
    api: TestClient, otp_sender: RecordingOtpSender
) -> None:
    sign_in(api, otp_sender, "existing@example.com")

    existing = api.post(REQUEST, json={"channel": "email", "destination": "existing@example.com"})
    new = api.post(REQUEST, json={"channel": "email", "destination": "newcomer@example.com"})

    assert existing.status_code == new.status_code == 202
    assert set(existing.json()) == set(new.json())
    assert existing.json()["expires_in_seconds"] == new.json()["expires_in_seconds"]


# --- code verification rules ----------------------------------------------------------


def test_wrong_code_then_attempt_limit(api: TestClient, otp_sender: RecordingOtpSender) -> None:
    request_code(api, "pet@example.com")
    real_code = otp_sender.sent["pet@example.com"]
    wrong = "000000" if real_code != "000000" else "111111"

    for _ in range(5):
        response = api.post(
            VERIFY, json={"channel": "email", "destination": "pet@example.com", "code": wrong}
        )
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "invalid_code"

    locked = api.post(
        VERIFY, json={"channel": "email", "destination": "pet@example.com", "code": real_code}
    )
    assert locked.status_code == 429
    assert locked.json()["error"]["code"] == "too_many_attempts"


def test_expired_code_rejected(
    api: TestClient, otp_sender: RecordingOtpSender, db_engine: Engine
) -> None:
    request_code(api, "late@example.com")
    with db_engine.begin() as conn:
        conn.execute(text("UPDATE otp_challenges SET expires_at = now() - interval '1 second'"))

    response = api.post(
        VERIFY,
        json={
            "channel": "email",
            "destination": "late@example.com",
            "code": otp_sender.sent["late@example.com"],
        },
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_code"


def test_new_code_supersedes_old_and_codes_are_single_use(
    api: TestClient, otp_sender: RecordingOtpSender
) -> None:
    request_code(api, "twice@example.com")
    old_code = otp_sender.sent["twice@example.com"]
    request_code(api, "twice@example.com")
    new_code = otp_sender.sent["twice@example.com"]

    payload = {"channel": "email", "destination": "twice@example.com"}
    if old_code != new_code:
        assert api.post(VERIFY, json={**payload, "code": old_code}).status_code == 400
    assert api.post(VERIFY, json={**payload, "code": new_code}).status_code == 200
    assert api.post(VERIFY, json={**payload, "code": new_code}).status_code == 400


def test_code_for_one_channel_does_not_work_for_another(
    api: TestClient, otp_sender: RecordingOtpSender
) -> None:
    request_code(api, "9876543210", channel="phone")
    code = otp_sender.sent["+919876543210"]
    response = api.post(
        VERIFY, json={"channel": "email", "destination": "someone@example.com", "code": code}
    )
    assert response.status_code == 400


def test_secrets_and_identifiers_not_stored_in_clear_text(
    api: TestClient, otp_sender: RecordingOtpSender, db_engine: Engine
) -> None:
    body = sign_in(api, otp_sender, "private@example.com")
    code = otp_sender.sent["private@example.com"]

    with db_engine.connect() as conn:
        challenge = conn.execute(
            text("SELECT destination_hash, code_hash, ip_hash FROM otp_challenges")
        ).one()
        session = conn.execute(text("SELECT refresh_token_hash FROM auth_sessions")).one()
        audit_details = conn.execute(text("SELECT details::text FROM audit_logs")).scalars().all()

    assert "private@example.com" not in challenge.destination_hash
    assert code not in challenge.code_hash
    assert challenge.ip_hash is None or "testclient" not in challenge.ip_hash
    assert session.refresh_token_hash != body["refresh_token"]
    assert all("private@example.com" not in details for details in audit_details)


# --- rate limits ---------------------------------------------------------------------


class TestRateLimits:
    @pytest.fixture
    def api_settings_overrides(self) -> dict[str, object]:
        return {
            "otp_max_per_destination_per_hour": 2,
            "otp_max_per_ip_per_hour": 3,
            "otp_resend_cooldown_seconds": 0,
        }

    def test_per_destination_limit(self, api: TestClient) -> None:
        payload = {"channel": "email", "destination": "spam@example.com"}
        assert api.post(REQUEST, json=payload).status_code == 202
        assert api.post(REQUEST, json=payload).status_code == 202

        limited = api.post(REQUEST, json=payload)
        assert limited.status_code == 429
        error = limited.json()["error"]
        assert error["code"] == "rate_limited"
        assert error["details"]["retry_after_seconds"] > 0

    def test_per_ip_limit_across_destinations(self, api: TestClient) -> None:
        for i in range(3):
            response = api.post(
                REQUEST, json={"channel": "email", "destination": f"user{i}@example.com"}
            )
            assert response.status_code == 202
        limited = api.post(REQUEST, json={"channel": "email", "destination": "user9@example.com"})
        assert limited.status_code == 429


class TestResendCooldown:
    @pytest.fixture
    def api_settings_overrides(self) -> dict[str, object]:
        return {"otp_resend_cooldown_seconds": 60}

    def test_immediate_resend_blocked(self, api: TestClient) -> None:
        payload = {"channel": "email", "destination": "eager@example.com"}
        assert api.post(REQUEST, json=payload).status_code == 202
        second = api.post(REQUEST, json=payload)
        assert second.status_code == 429
        assert 0 < second.json()["error"]["details"]["retry_after_seconds"] <= 60


# --- sessions ------------------------------------------------------------------------


def test_me_requires_valid_token(api: TestClient, otp_sender: RecordingOtpSender) -> None:
    assert api.get(ME).status_code == 401
    assert api.get(ME, headers=bearer("garbage")).status_code == 401

    body = sign_in(api, otp_sender, "me@example.com")
    me = api.get(ME, headers=bearer(body["access_token"]))
    assert me.status_code == 200
    assert me.json()["email"] == "me@example.com"


def test_tampered_or_expired_access_tokens_rejected(
    api: TestClient, otp_sender: RecordingOtpSender
) -> None:
    body = sign_in(api, otp_sender, "jwt@example.com")
    claims = jwt.decode(str(body["access_token"]), options={"verify_signature": False})

    forged = jwt.encode(claims, "x" * 48, algorithm="HS256")
    assert api.get(ME, headers=bearer(forged)).status_code == 401

    secret = "test-jwt-secret-" + "x" * 32
    expired = jwt.encode(
        {**claims, "exp": int((utcnow() - timedelta(minutes=1)).timestamp())},
        secret,
        algorithm="HS256",
    )
    assert api.get(ME, headers=bearer(expired)).status_code == 401

    wrong_audience = jwt.encode({**claims, "aud": "someone-else"}, secret, algorithm="HS256")
    assert api.get(ME, headers=bearer(wrong_audience)).status_code == 401


def test_refresh_rotates_tokens_and_detects_reuse(
    api: TestClient, otp_sender: RecordingOtpSender
) -> None:
    body = sign_in(api, otp_sender, "rotate@example.com")
    first_refresh = body["refresh_token"]

    rotated = api.post(REFRESH, json={"refresh_token": first_refresh})
    assert rotated.status_code == 200
    second = rotated.json()
    assert second["refresh_token"] != first_refresh
    assert api.get(ME, headers=bearer(second["access_token"])).status_code == 200

    # Replaying the rotated token looks like theft: the whole session ends.
    replay = api.post(REFRESH, json={"refresh_token": first_refresh})
    assert replay.status_code == 401
    assert api.post(REFRESH, json={"refresh_token": second["refresh_token"]}).status_code == 401
    assert api.get(ME, headers=bearer(second["access_token"])).status_code == 401


def test_unknown_refresh_token_rejected(api: TestClient) -> None:
    response = api.post(REFRESH, json={"refresh_token": "x" * 43})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_refresh_token"


def test_logout_ends_session(api: TestClient, otp_sender: RecordingOtpSender) -> None:
    body = sign_in(api, otp_sender, "bye@example.com")
    headers = bearer(body["access_token"])

    assert api.post(LOGOUT, headers=headers).status_code == 204
    assert api.get(ME, headers=headers).status_code == 401
    assert api.post(REFRESH, json={"refresh_token": body["refresh_token"]}).status_code == 401


def test_other_sessions_survive_logout(api: TestClient, otp_sender: RecordingOtpSender) -> None:
    phone_session = sign_in(api, otp_sender, "multi@example.com")
    tablet_session = sign_in(api, otp_sender, "multi@example.com")

    api.post(LOGOUT, headers=bearer(phone_session["access_token"]))
    assert api.get(ME, headers=bearer(tablet_session["access_token"])).status_code == 200


def test_suspended_account_is_locked_out(
    api: TestClient, otp_sender: RecordingOtpSender, db_engine: Engine
) -> None:
    body = sign_in(api, otp_sender, "blocked@example.com")
    with db_engine.begin() as conn:
        conn.execute(text("UPDATE users SET status = 'suspended'"))

    me = api.get(ME, headers=bearer(body["access_token"]))
    assert me.status_code == 403
    assert me.json()["error"]["code"] == "account_suspended"
    assert api.post(REFRESH, json={"refresh_token": body["refresh_token"]}).status_code == 401

    request_code(api, "blocked@example.com")
    again = api.post(
        VERIFY,
        json={
            "channel": "email",
            "destination": "blocked@example.com",
            "code": otp_sender.sent["blocked@example.com"],
        },
    )
    assert again.status_code == 403


def test_sign_in_is_audited(
    api: TestClient, otp_sender: RecordingOtpSender, db_engine: Engine
) -> None:
    sign_in(api, otp_sender, "audit@example.com")
    with db_engine.connect() as conn:
        actions = conn.execute(text("SELECT action FROM audit_logs ORDER BY created_at")).scalars()
        assert list(actions) == ["user.created", "auth.signed_in"]


def test_timestamps_are_returned_in_utc(api: TestClient, otp_sender: RecordingOtpSender) -> None:
    body = sign_in(api, otp_sender, "utc@example.com")
    assert isinstance(body["user"], dict)
    assert str(body["user"]["created_at"]).endswith(("Z", "+00:00"))
    assert str(body["refresh_expires_at"]).endswith(("Z", "+00:00"))
