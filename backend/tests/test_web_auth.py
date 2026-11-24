"""Browser sign-in with an httpOnly refresh cookie (decision 0009)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.modules.auth.otp_delivery import RecordingOtpSender
from tests.conftest import bearer

WEB = "/api/v1/auth/web"
CSRF = {"X-Requested-With": "petfinity-web"}


def web_sign_in(api: TestClient, sender: RecordingOtpSender, email: str) -> dict[str, object]:
    api.post("/api/v1/auth/otp/request", json={"channel": "email", "destination": email})
    response = api.post(
        f"{WEB}/otp/verify",
        headers=CSRF,
        json={"channel": "email", "destination": email, "code": sender.sent[email]},
    )
    assert response.status_code == 200, response.text
    body: dict[str, object] = response.json()
    return body


def test_cookie_session_lifecycle(api: TestClient, otp_sender: RecordingOtpSender) -> None:
    api.base_url = "https://testserver"  # Secure cookies are only sent over HTTPS
    api.post("/api/v1/auth/otp/request", json={"channel": "email", "destination": "w@example.com"})
    verify = api.post(
        f"{WEB}/otp/verify",
        headers=CSRF,
        json={
            "channel": "email",
            "destination": "w@example.com",
            "code": otp_sender.sent["w@example.com"],
        },
    )
    assert verify.status_code == 200
    body = verify.json()
    assert "refresh_token" not in body  # never exposed to JavaScript
    cookie = verify.headers["set-cookie"]
    assert "pf_web_refresh=" in cookie
    assert "HttpOnly" in cookie
    assert "Secure" in cookie
    assert "SameSite=strict" in cookie
    assert "Path=/api/v1/auth/web" in cookie

    old_cookie = api.cookies.get("pf_web_refresh")
    refreshed = api.post(f"{WEB}/refresh", headers=CSRF)
    assert refreshed.status_code == 200
    assert api.cookies.get("pf_web_refresh") != old_cookie  # rotated
    access = refreshed.json()["access_token"]
    assert api.get("/api/v1/me", headers=bearer(access)).status_code == 200

    logout = api.post(f"{WEB}/logout", headers={**CSRF, **bearer(access)})
    assert logout.status_code == 204
    assert api.post(f"{WEB}/refresh", headers=CSRF).status_code == 401


def test_requires_csrf_header(api: TestClient, otp_sender: RecordingOtpSender) -> None:
    api.base_url = "https://testserver"
    web_sign_in(api, otp_sender, "csrf@example.com")
    assert api.post(f"{WEB}/refresh").status_code == 403
    assert (
        api.post(f"{WEB}/refresh", headers={"X-Requested-With": "XMLHttpRequest"}).status_code
        == 403
    )
    api.post("/api/v1/auth/otp/request", json={"channel": "email", "destination": "c2@example.com"})
    no_header = api.post(
        f"{WEB}/otp/verify",
        json={
            "channel": "email",
            "destination": "c2@example.com",
            "code": otp_sender.sent["c2@example.com"],
        },
    )
    assert no_header.status_code == 403


def test_refresh_without_cookie(api: TestClient) -> None:
    response = api.post(f"{WEB}/refresh", headers=CSRF)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_refresh_token"
