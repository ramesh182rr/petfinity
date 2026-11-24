"""Admin verification review (milestone 2.2)."""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from app.modules.auth.otp_delivery import RecordingOtpSender
from tests.conftest import bearer, sign_in
from tests.test_providers_clinics import CLINIC, CLINICS, PROFILES, VET
from tests.test_verification import JPEG, PDF, add_document, base

ADMIN_EMAIL = "admin@petfinity.in"
QUEUE = "/api/v1/admin/verification/submissions"


@pytest.fixture
def api_settings_overrides() -> dict[str, object]:
    return {"bootstrap_admin_emails": ADMIN_EMAIL, "staff_email_domains": "petfinity.in"}


@pytest.fixture
def admin(api: TestClient, otp_sender: RecordingOtpSender) -> dict[str, str]:
    return bearer(sign_in(api, otp_sender, ADMIN_EMAIL)["access_token"])


@pytest.fixture
def applicant(api: TestClient, otp_sender: RecordingOtpSender) -> dict[str, str]:
    return bearer(sign_in(api, otp_sender, "dr.priya@example.com")["access_token"])


def submit_vet(api: TestClient, headers: dict[str, str]) -> dict[str, Any]:
    profile: dict[str, Any] = api.post(PROFILES, json=VET, headers=headers).json()
    url = base("provider_profile", profile["id"])
    add_document(api, headers, url, "identity", JPEG, "image/jpeg")
    add_document(api, headers, url, "vet_registration", PDF, "application/pdf")
    assert api.post(f"{url}/submit", json={"note": "Reg. 2016"}, headers=headers).status_code == 201
    return profile


def pending(api: TestClient, admin: dict[str, str]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = api.get(QUEUE, headers=admin).json()["items"]
    return items


def test_only_admins_can_review(
    api: TestClient,
    admin: dict[str, str],
    applicant: dict[str, str],
    otp_sender: RecordingOtpSender,
) -> None:
    submit_vet(api, applicant)
    assert api.get(QUEUE).status_code == 401
    assert api.get(QUEUE, headers=applicant).status_code == 403
    sub_id = pending(api, admin)[0]["id"]
    decide = api.post(f"{QUEUE}/{sub_id}/decision", json={"decision": "approve"}, headers=applicant)
    assert decide.status_code == 403


def test_queue_review_and_approve(
    api: TestClient, admin: dict[str, str], applicant: dict[str, str], db_engine: Engine
) -> None:
    profile = submit_vet(api, applicant)
    items = pending(api, admin)
    assert len(items) == 1
    entry = items[0]
    assert entry["subject_label"] == "Dr. Priya Nair"
    assert entry["subject_kind"] == "veterinarian"
    assert entry["city"] == "Chennai"
    assert entry["submitter"]["email"] == "dr.priya@example.com"

    detail = api.get(f"{QUEUE}/{entry['id']}", headers=admin).json()
    assert detail["provider"]["registration_number"] == "TNSVC/1234"
    assert detail["applicant_note"] == "Reg. 2016"
    assert [d["doc_type"] for d in detail["documents"]] == ["identity", "vet_registration"]
    assert all(d["url_expires_in"] == 300 for d in detail["documents"])

    # Admin can open the private document through its short-lived link.
    pdf = api.get(detail["documents"][1]["url"])
    assert pdf.status_code == 200
    assert pdf.content == PDF

    approved = api.post(
        f"{QUEUE}/{entry['id']}/decision", json={"decision": "approve"}, headers=admin
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"

    mine = api.get(f"{PROFILES}/{profile['id']}", headers=applicant).json()
    assert mine["verification_status"] == "verified"
    assert mine["verified_at"] is not None
    assert pending(api, admin) == []

    again = api.post(
        f"{QUEUE}/{entry['id']}/decision", json={"decision": "reject", "reason": "x"}, headers=admin
    )
    assert again.status_code == 409

    with db_engine.connect() as conn:
        actions = list(
            conn.execute(text("SELECT action FROM audit_logs ORDER BY created_at")).scalars()
        )
    assert "verification.submission_viewed" in actions
    assert actions[-1] == "verification.approve"


def test_needs_info_then_resubmit(
    api: TestClient, admin: dict[str, str], applicant: dict[str, str]
) -> None:
    profile = submit_vet(api, applicant)
    sub_id = pending(api, admin)[0]["id"]

    no_reason = api.post(
        f"{QUEUE}/{sub_id}/decision", json={"decision": "needs_info"}, headers=admin
    )
    assert no_reason.status_code == 422
    assert no_reason.json()["error"]["code"] == "reason_required"

    asked = api.post(
        f"{QUEUE}/{sub_id}/decision",
        json={"decision": "needs_info", "reason": "The registration certificate is blurry."},
        headers=admin,
    )
    assert asked.json()["status"] == "needs_info"

    # Applicant sees the reason, can add a clearer document and resubmit.
    url = base("provider_profile", profile["id"])
    overview = api.get(url, headers=applicant).json()
    assert overview["verification_status"] == "needs_info"
    assert overview["can_edit_documents"] is True
    assert overview["latest_submission"]["decision_reason"] == (
        "The registration certificate is blurry."
    )
    add_document(api, applicant, url, "vet_registration", PDF, "application/pdf")
    assert api.post(f"{url}/submit", json={}, headers=applicant).status_code == 201

    queue = pending(api, admin)
    assert len(queue) == 1
    detail = api.get(f"{QUEUE}/{queue[0]['id']}", headers=admin).json()
    assert len(detail["documents"]) == 1  # only the newly added document
    assert detail["history"][0]["status"] == "needs_info"


def test_reject_and_filters(
    api: TestClient, admin: dict[str, str], applicant: dict[str, str]
) -> None:
    submit_vet(api, applicant)
    clinic = api.post(CLINICS, json=CLINIC, headers=applicant).json()
    url = base("clinic", clinic["id"])
    add_document(api, applicant, url, "clinic_registration", PDF, "application/pdf")
    api.post(f"{url}/submit", json={}, headers=applicant)

    queue = pending(api, admin)
    assert [q["subject_kind"] for q in queue] == ["veterinarian", "clinic"]  # oldest first
    clinics_only = api.get(QUEUE, params={"subject_type": "clinic"}, headers=admin).json()
    assert [q["subject_label"] for q in clinics_only["items"]] == ["Paws & Care Clinic"]

    rejected = api.post(
        f"{QUEUE}/{queue[1]['id']}/decision",
        json={"decision": "reject", "reason": "Licence belongs to another clinic."},
        headers=admin,
    )
    assert rejected.json()["status"] == "rejected"
    mine = api.get(f"{CLINICS}/{clinic['id']}", headers=applicant).json()
    assert mine["verification_status"] == "rejected"

    history = api.get(QUEUE, params={"status": "rejected"}, headers=admin).json()["items"]
    assert [h["id"] for h in history] == [queue[1]["id"]]


def test_no_self_review(api: TestClient, admin: dict[str, str]) -> None:
    submit_vet(api, admin)  # the admin applies as a vet themselves
    sub_id = pending(api, admin)[0]["id"]
    response = api.post(f"{QUEUE}/{sub_id}/decision", json={"decision": "approve"}, headers=admin)
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "self_review"


def test_suspend_and_reactivate(
    api: TestClient, admin: dict[str, str], applicant: dict[str, str], db_engine: Engine
) -> None:
    profile = submit_vet(api, applicant)
    url = f"/api/v1/admin/verification/provider_profile/{profile['id']}/status"

    assert (
        api.post(url, json={"status": "suspended", "reason": "x"}, headers=admin).status_code == 422
    )
    suspended = api.post(
        url, json={"status": "suspended", "reason": "Complaint under review"}, headers=admin
    )
    assert suspended.json()["status"] == "suspended"
    assert api.get(f"{PROFILES}/{profile['id']}", headers=applicant).json()["status"] == (
        "suspended"
    )
    me = api.get("/api/v1/me", headers=applicant).json()
    assert "veterinarian" not in me["capabilities"]

    assert (
        api.post(url, json={"status": "suspended", "reason": "again"}, headers=admin).status_code
        == 409
    )
    assert (
        api.post(url, json={"status": "active", "reason": "Resolved"}, headers=admin).json()[
            "status"
        ]
        == "active"
    )
    assert (
        api.post(
            url, json={"status": "active", "reason": "Resolved"}, headers=applicant
        ).status_code
        == 403
    )
    with db_engine.connect() as conn:
        actions = set(conn.execute(text("SELECT action FROM audit_logs")).scalars())
    assert {"provider.suspended", "provider.reactivated"} <= actions
