"""Profile updates, capabilities and audited staff roles (decision 0006)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from app.modules.auth.otp_delivery import RecordingOtpSender
from tests.conftest import bearer, sign_in

ME = "/api/v1/me"
STAFF = "/api/v1/admin/staff-roles"
FOUNDER = "founder@gmail.com"


def test_update_display_name(api: TestClient, otp_sender: RecordingOtpSender) -> None:
    body = sign_in(api, otp_sender, "name@example.com")
    headers = bearer(body["access_token"])

    updated = api.patch(ME, json={"display_name": "  Priya   Nair "}, headers=headers)
    assert updated.status_code == 200
    assert updated.json()["display_name"] == "Priya Nair"

    for bad in ["   ", "x" * 61, "bad\u0007name"]:
        response = api.patch(ME, json={"display_name": bad}, headers=headers)
        assert response.status_code == 422, bad


class TestStaffRoles:
    @pytest.fixture
    def api_settings_overrides(self) -> dict[str, object]:
        return {"bootstrap_admin_emails": FOUNDER, "staff_email_domains": "petfinity.in"}

    def test_bootstrap_admin_on_first_verified_email_sign_in(
        self, api: TestClient, otp_sender: RecordingOtpSender, db_engine: Engine
    ) -> None:
        body = sign_in(api, otp_sender, FOUNDER)
        assert isinstance(body["user"], dict)
        assert body["user"]["capabilities"] == ["pet_parent", "admin"]

        with db_engine.connect() as conn:
            assert (
                conn.execute(
                    text(
                        "SELECT count(*) FROM audit_logs "
                        "WHERE action = 'staff_role.bootstrap_granted'"
                    )
                ).scalar()
                == 1
            )

    def test_bootstrap_is_never_repeated_after_revocation(
        self, api: TestClient, otp_sender: RecordingOtpSender, db_engine: Engine
    ) -> None:
        sign_in(api, otp_sender, FOUNDER)
        with db_engine.begin() as conn:
            conn.execute(text("UPDATE staff_roles SET revoked_at = now()"))

        again = sign_in(api, otp_sender, FOUNDER)
        assert isinstance(again["user"], dict)
        assert again["user"]["capabilities"] == ["pet_parent"]

    def test_non_admin_cannot_manage_staff(
        self, api: TestClient, otp_sender: RecordingOtpSender
    ) -> None:
        member = sign_in(api, otp_sender, "member@example.com")
        headers = bearer(member["access_token"])

        assert api.get(STAFF, headers=headers).status_code == 403
        assert api.get(STAFF).status_code == 401

    def test_grant_requires_verified_staff_domain_email(
        self, api: TestClient, otp_sender: RecordingOtpSender
    ) -> None:
        admin = bearer(sign_in(api, otp_sender, FOUNDER)["access_token"])
        outsider = sign_in(api, otp_sender, "helper@gmail.com")
        assert isinstance(outsider["user"], dict)

        response = api.post(
            STAFF, json={"user_id": outsider["user"]["id"], "role": "moderator"}, headers=admin
        )
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "staff_email_required"

    def test_grant_and_revoke_moderator(
        self, api: TestClient, otp_sender: RecordingOtpSender, db_engine: Engine
    ) -> None:
        admin = bearer(sign_in(api, otp_sender, FOUNDER)["access_token"])
        mod = sign_in(api, otp_sender, "Meera@Petfinity.in")
        assert isinstance(mod["user"], dict)

        granted = api.post(
            STAFF, json={"user_id": mod["user"]["id"], "role": "moderator"}, headers=admin
        )
        assert granted.status_code == 201
        grant_id = granted.json()["id"]

        me = api.get(ME, headers=bearer(mod["access_token"])).json()
        assert me["capabilities"] == ["pet_parent", "moderator"]

        duplicate = api.post(
            STAFF, json={"user_id": mod["user"]["id"], "role": "moderator"}, headers=admin
        )
        assert duplicate.status_code == 409

        revoked = api.delete(f"{STAFF}/{grant_id}", headers=admin)
        assert revoked.status_code == 200
        assert revoked.json()["revoked_at"] is not None
        me = api.get(ME, headers=bearer(mod["access_token"])).json()
        assert me["capabilities"] == ["pet_parent"]

        with db_engine.connect() as conn:
            actions = set(conn.execute(text("SELECT action FROM audit_logs")).scalars())
        assert {"staff_role.granted", "staff_role.revoked"} <= actions

    def test_last_admin_cannot_be_removed(
        self, api: TestClient, otp_sender: RecordingOtpSender
    ) -> None:
        admin = bearer(sign_in(api, otp_sender, FOUNDER)["access_token"])
        grants = api.get(STAFF, headers=admin).json()
        assert len(grants) == 1

        response = api.delete(f"{STAFF}/{grants[0]['id']}", headers=admin)
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "last_admin"

    def test_moderator_cannot_grant_roles(
        self, api: TestClient, otp_sender: RecordingOtpSender
    ) -> None:
        admin = bearer(sign_in(api, otp_sender, FOUNDER)["access_token"])
        mod = sign_in(api, otp_sender, "mod@petfinity.in")
        assert isinstance(mod["user"], dict)
        api.post(STAFF, json={"user_id": mod["user"]["id"], "role": "moderator"}, headers=admin)

        response = api.post(
            STAFF,
            json={"user_id": mod["user"]["id"], "role": "admin"},
            headers=bearer(mod["access_token"]),
        )
        assert response.status_code == 403
