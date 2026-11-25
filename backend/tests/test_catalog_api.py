"""Services, weekly hours, days off and slot preview API (milestone 2.4)."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from app.core.clock import utcnow
from app.modules.auth.otp_delivery import RecordingOtpSender
from tests.conftest import bearer, sign_in
from tests.test_providers_clinics import CLINIC, CLINICS, PROFILES, VET

SERVICE = {
    "category": "general_consultation",
    "title": "General consultation",
    "price_minor": 50000,
    "duration_minutes": 30,
    "service_mode": "in_clinic",
}


@pytest.fixture
def operator(api: TestClient, otp_sender: RecordingOtpSender) -> dict[str, str]:
    return bearer(sign_in(api, otp_sender, "operator@example.com")["access_token"])


@pytest.fixture
def clinic(api: TestClient, operator: dict[str, str]) -> dict[str, Any]:
    body: dict[str, Any] = api.post(CLINICS, json=CLINIC, headers=operator).json()
    return body


def manage(clinic_id: str) -> str:
    return f"/api/v1/manage/clinic/{clinic_id}"


def future_monday() -> date:
    today = utcnow().astimezone(ZoneInfo("Asia/Kolkata")).date()
    return today + timedelta(days=(7 - today.weekday()) % 7 or 7)


def test_create_service_with_defaults(
    api: TestClient, operator: dict[str, str], clinic: dict[str, Any]
) -> None:
    created = api.post(f"{manage(clinic['id'])}/services", json=SERVICE, headers=operator)
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["confirmation_mode"] == "instant"  # in-clinic default (decision 0004)
    assert body["species"] == ["cat", "dog"]
    assert body["currency"] == "INR"
    assert body["active"] is True

    home = api.post(
        f"{manage(clinic['id'])}/services",
        json={
            **SERVICE,
            "title": "Home check-up",
            "service_mode": "home_visit",
            "species": ["dog", "dog", "other"],
        },
        headers=operator,
    ).json()
    assert home["confirmation_mode"] == "request"  # home-visit default
    assert home["species"] == ["dog", "other"]

    listed = api.get(f"{manage(clinic['id'])}/services", headers=operator).json()
    assert [s["title"] for s in listed] == ["General consultation", "Home check-up"]


@pytest.mark.parametrize(
    ("override", "code"),
    [
        ({"service_mode": "teleconsult"}, "mode_unavailable"),
        ({"duration_minutes": 7}, "validation_error"),
        ({"duration_minutes": 600}, "validation_error"),
        ({"price_minor": -1}, "validation_error"),
        ({"category": "massage"}, "validation_error"),
        ({"species": []}, "validation_error"),
        ({"title": " "}, "validation_error"),
    ],
)
def test_service_validation(
    api: TestClient,
    operator: dict[str, str],
    clinic: dict[str, Any],
    override: dict[str, Any],
    code: str,
) -> None:
    response = api.post(
        f"{manage(clinic['id'])}/services", json={**SERVICE, **override}, headers=operator
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == code


def test_vet_profile_offers_home_visits_only(api: TestClient, operator: dict[str, str]) -> None:
    vet = api.post(PROFILES, json=VET, headers=operator).json()
    url = f"/api/v1/manage/provider_profile/{vet['id']}/services"
    clinic_visit = api.post(url, json=SERVICE, headers=operator)
    assert clinic_visit.json()["error"]["code"] == "clinic_required"
    home = api.post(url, json={**SERVICE, "service_mode": "home_visit"}, headers=operator)
    assert home.status_code == 201

    caretaker = api.post(
        PROFILES, json={"provider_type": "caretaker", "display_name": "Arun"}, headers=operator
    ).json()
    refused = api.get(
        f"/api/v1/manage/provider_profile/{caretaker['id']}/services", headers=operator
    )
    assert refused.status_code == 422
    assert refused.json()["error"]["code"] == "services_not_supported"


def test_only_operators_manage(
    api: TestClient, clinic: dict[str, Any], otp_sender: RecordingOtpSender, db_engine: Engine
) -> None:
    stranger = bearer(sign_in(api, otp_sender, "stranger@example.com")["access_token"])
    assert api.get(f"{manage(clinic['id'])}/services", headers=stranger).status_code == 404
    stranger_id = api.get("/api/v1/me", headers=stranger).json()["id"]
    with db_engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO clinic_members (clinic_id, user_id, member_role) "
                "VALUES (:c, :u, 'veterinarian')"
            ),
            {"c": clinic["id"], "u": stranger_id},
        )
    assert (
        api.post(f"{manage(clinic['id'])}/services", json=SERVICE, headers=stranger).status_code
        == 403
    )


def test_update_and_archive_service(
    api: TestClient, operator: dict[str, str], clinic: dict[str, Any], db_engine: Engine
) -> None:
    base = f"{manage(clinic['id'])}/services"
    service = api.post(base, json=SERVICE, headers=operator).json()
    updated = api.patch(
        f"{base}/{service['id']}", json={"price_minor": 60000, "active": False}, headers=operator
    ).json()
    assert updated["price_minor"] == 60000
    assert updated["active"] is False
    assert (
        api.patch(f"{base}/{service['id']}", json={"title": None}, headers=operator).status_code
        == 422
    )
    assert (
        api.patch(
            f"{base}/{service['id']}", json={"service_mode": "teleconsult"}, headers=operator
        ).status_code
        == 422
    )

    assert api.delete(f"{base}/{service['id']}", headers=operator).status_code == 204
    assert api.get(base, headers=operator).json() == []
    assert (
        api.patch(f"{base}/{service['id']}", json={"price_minor": 1}, headers=operator).status_code
        == 404
    )
    with db_engine.connect() as conn:  # archived, not deleted (bookings will reference it)
        assert conn.execute(text("SELECT archived_at IS NOT NULL FROM services")).scalar() is True


def test_weekly_hours_replace_and_validate(
    api: TestClient, operator: dict[str, str], clinic: dict[str, Any]
) -> None:
    url = f"{manage(clinic['id'])}/availability"
    hours = {
        "rules": [
            {"weekday": 0, "start_time": "09:00", "end_time": "13:00", "capacity": 2},
            {"weekday": 0, "start_time": "15:00", "end_time": "18:00"},
            {"weekday": 5, "start_time": "10:00", "end_time": "14:00"},
        ]
    }
    saved = api.put(url, json=hours, headers=operator)
    assert saved.status_code == 200
    body = saved.json()
    assert body["timezone"] == "Asia/Kolkata"
    assert [(r["weekday"], r["start_time"], r["capacity"]) for r in body["rules"]] == [
        (0, "09:00:00", 2),
        (0, "15:00:00", 1),
        (5, "10:00:00", 1),
    ]

    overlap = api.put(
        url,
        json={
            "rules": [
                {"weekday": 2, "start_time": "09:00", "end_time": "12:00"},
                {"weekday": 2, "start_time": "11:30", "end_time": "13:00"},
            ]
        },
        headers=operator,
    )
    assert overlap.status_code == 422
    assert overlap.json()["error"]["code"] == "overlapping_hours"
    assert api.get(url, headers=operator).json()["rules"][0]["weekday"] == 0  # unchanged

    for bad in (
        {"weekday": 7, "start_time": "09:00", "end_time": "10:00"},
        {"weekday": 1, "start_time": "10:00", "end_time": "09:00"},
        {"weekday": 1, "start_time": "09:07", "end_time": "10:00"},
        {"weekday": 1, "start_time": "09:00", "end_time": "10:00", "capacity": 50},
    ):
        assert api.put(url, json={"rules": [bad]}, headers=operator).status_code == 422

    cleared = api.put(url, json={"rules": []}, headers=operator).json()
    assert cleared["rules"] == []


def test_days_off_and_special_hours(
    api: TestClient, operator: dict[str, str], clinic: dict[str, Any]
) -> None:
    url = f"{manage(clinic['id'])}/exceptions"
    day = future_monday().isoformat()
    special = api.post(
        url,
        json={
            "on_date": day,
            "kind": "custom_hours",
            "start_time": "10:00",
            "end_time": "12:00",
            "note": "Half day",
        },
        headers=operator,
    )
    assert special.status_code == 201
    assert special.json()["capacity"] == 1

    clash = api.post(
        url,
        json={"on_date": day, "kind": "custom_hours", "start_time": "11:00", "end_time": "13:00"},
        headers=operator,
    )
    assert clash.json()["error"]["code"] == "overlapping_hours"
    closed_with_hours = api.post(url, json={"on_date": day, "kind": "closed"}, headers=operator)
    assert closed_with_hours.json()["error"]["code"] == "has_special_hours"

    assert api.delete(f"{url}/{special.json()['id']}", headers=operator).status_code == 204
    closed = api.post(
        url,
        json={"on_date": day, "kind": "closed", "note": "Pongal", "start_time": "10:00"},
        headers=operator,
    )
    assert closed.status_code == 201
    assert closed.json()["start_time"] is None  # times ignored for closed days
    assert (
        api.post(url, json={"on_date": day, "kind": "closed"}, headers=operator).json()["error"][
            "code"
        ]
        == "already_closed"
    )

    past = api.post(url, json={"on_date": "2020-01-01", "kind": "closed"}, headers=operator)
    assert past.json()["error"]["code"] == "invalid_date"
    assert [e["note"] for e in api.get(url, headers=operator).json()] == ["Pongal"]


def test_slot_preview(api: TestClient, operator: dict[str, str], clinic: dict[str, Any]) -> None:
    base = manage(clinic["id"])
    service = api.post(
        f"{base}/services", json={**SERVICE, "duration_minutes": 45}, headers=operator
    ).json()
    api.put(
        f"{base}/availability",
        json={
            "rules": [
                {"weekday": 0, "start_time": "09:00", "end_time": "11:00", "capacity": 2},
                {"weekday": 0, "start_time": "16:00", "end_time": "17:30"},
            ]
        },
        headers=operator,
    )
    monday = future_monday()

    preview = api.get(
        f"{base}/slots",
        params={"service_id": service["id"], "date": monday.isoformat()},
        headers=operator,
    ).json()
    assert preview["timezone"] == "Asia/Kolkata"
    assert [(s["local_start"], s["capacity"]) for s in preview["slots"]] == [
        ("09:00", 2),
        ("09:45", 2),
        ("16:00", 1),
        ("16:45", 1),
    ]
    assert preview["slots"][0]["start"].endswith(("Z", "+00:00"))

    tuesday = (monday + timedelta(days=1)).isoformat()
    assert (
        api.get(
            f"{base}/slots", params={"service_id": service["id"], "date": tuesday}, headers=operator
        ).json()["slots"]
        == []
    )

    api.post(
        f"{base}/exceptions",
        json={"on_date": monday.isoformat(), "kind": "closed"},
        headers=operator,
    )
    assert (
        api.get(
            f"{base}/slots",
            params={"service_id": service["id"], "date": monday.isoformat()},
            headers=operator,
        ).json()["slots"]
        == []
    )

    too_far = (monday + timedelta(days=90)).isoformat()
    assert (
        api.get(
            f"{base}/slots", params={"service_id": service["id"], "date": too_far}, headers=operator
        ).status_code
        == 422
    )


def test_changes_are_audited(
    api: TestClient, operator: dict[str, str], clinic: dict[str, Any], db_engine: Engine
) -> None:
    base = manage(clinic["id"])
    service = api.post(f"{base}/services", json=SERVICE, headers=operator).json()
    api.patch(f"{base}/services/{service['id']}", json={"price_minor": 1}, headers=operator)
    api.put(f"{base}/availability", json={"rules": []}, headers=operator)
    with db_engine.connect() as conn:
        actions = set(conn.execute(text("SELECT action FROM audit_logs")).scalars())
    assert {"service.created", "service.updated", "availability.updated"} <= actions
