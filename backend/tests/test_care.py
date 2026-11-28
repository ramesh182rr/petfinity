"""Caretaker services, home details, days off and readiness (milestone 3.1, decision 0015)."""

from __future__ import annotations

from datetime import timedelta
from typing import Any
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from app.core.clock import utcnow
from app.modules.auth.otp_delivery import RecordingOtpSender
from tests.conftest import bearer, sign_in
from tests.test_discovery_api import verify
from tests.test_providers_clinics import PROFILES, VET

CARETAKER = {
    "provider_type": "caretaker",
    "display_name": "Meena S.",
    "bio": "Lifelong dog person.",
    "years_experience": 4,
    "city": "Chennai",
}
VISITS = {"care_type": "home_visit", "rate_minor": 30000, "species": ["dog", "cat"]}
BOARDING = {"care_type": "boarding", "rate_minor": 90000, "species": ["dog"], "max_pets": 2}


@pytest.fixture
def owner(api: TestClient, otp_sender: RecordingOtpSender) -> dict[str, str]:
    return bearer(sign_in(api, otp_sender, "meena@example.com")["access_token"])


@pytest.fixture
def caretaker(api: TestClient, owner: dict[str, str]) -> dict[str, Any]:
    body: dict[str, Any] = api.post(PROFILES, json=CARETAKER, headers=owner).json()
    return body


def care(profile_id: str) -> str:
    return f"/api/v1/manage/provider_profile/{profile_id}/care"


def test_services_and_readiness(
    api: TestClient, owner: dict[str, str], caretaker: dict[str, Any], db_engine: Engine
) -> None:
    empty = api.get(care(caretaker["id"]), headers=owner).json()
    assert empty["services"] == []
    assert empty["missing"] == ["services", "service_area", "capacity", "verification"]
    assert empty["receiving_requests"] is False

    saved = api.put(
        f"{care(caretaker['id'])}/services",
        json={"services": [BOARDING, VISITS]},
        headers=owner,
    )
    assert saved.status_code == 200, saved.text
    body = saved.json()
    # Sorted by care type, with the unit the rate is per.
    assert [(s["care_type"], s["rate_unit"]) for s in body["services"]] == [
        ("home_visit", "visit"),
        ("boarding", "night"),
    ]
    assert body["services"][0]["max_pets"] == 2  # default
    # Boarding happens at the caretaker's home, so home details are now needed.
    assert "home_details" in body["missing"]

    profile = api.patch(
        f"{PROFILES}/{caretaker['id']}",
        json={
            "area_key": "chennai",
            "latitude": "13.040000",
            "longitude": "80.230000",
            "service_radius_km": 5,
            "home_type": "independent_house",
            "outdoor_space": True,
            "pets_at_home": "  One friendly beagle ",
            "max_concurrent": 2,
        },
        headers=owner,
    ).json()
    assert profile["pets_at_home"] == "One friendly beagle"
    assert api.get(care(caretaker["id"]), headers=owner).json()["missing"] == ["verification"]
    verify(db_engine, "provider_profiles", caretaker["id"])
    ready = api.get(care(caretaker["id"]), headers=owner).json()
    assert (ready["missing"], ready["receiving_requests"]) == ([], True)

    # Replacing drops types no longer listed and updates the rest in place.
    first_id = ready["services"][0]["id"]
    again = api.put(
        f"{care(caretaker['id'])}/services",
        json={"services": [{**VISITS, "rate_minor": 35000, "active": False}]},
        headers=owner,
    ).json()
    assert [s["care_type"] for s in again["services"]] == ["home_visit"]
    assert again["services"][0]["id"] == first_id
    assert again["services"][0]["rate_minor"] == 35000
    assert again["missing"] == ["services"]  # nothing active
    with db_engine.connect() as conn:
        actions = conn.execute(text("SELECT action FROM audit_logs")).scalars().all()
    assert "care.services_updated" in actions


def test_validation_and_access(
    api: TestClient,
    owner: dict[str, str],
    caretaker: dict[str, Any],
    otp_sender: RecordingOtpSender,
) -> None:
    url = f"{care(caretaker['id'])}/services"
    duplicate = api.put(url, json={"services": [VISITS, VISITS]}, headers=owner)
    assert duplicate.json()["error"]["code"] == "duplicate_care_type"
    assert (
        api.put(
            url, json={"services": [{**VISITS, "care_type": "grooming"}]}, headers=owner
        ).status_code
        == 422
    )
    assert (
        api.put(url, json={"services": [{**VISITS, "species": []}]}, headers=owner).status_code
        == 422
    )
    assert (
        api.put(url, json={"services": [{**VISITS, "max_pets": 11}]}, headers=owner).status_code
        == 422
    )

    stranger = bearer(sign_in(api, otp_sender, "x@example.com")["access_token"])
    assert api.get(care(caretaker["id"]), headers=stranger).status_code == 404

    vet = api.post(PROFILES, json=VET, headers=owner).json()
    not_caretaker = api.get(care(vet["id"]), headers=owner)
    assert not_caretaker.json()["error"]["code"] == "not_a_caretaker"
    vet_home = api.patch(f"{PROFILES}/{vet['id']}", json={"home_type": "apartment"}, headers=owner)
    assert vet_home.json()["error"]["code"] == "caretaker_only"
    assert (
        api.patch(
            f"{PROFILES}/{caretaker['id']}", json={"max_concurrent": 6}, headers=owner
        ).status_code
        == 422
    )
    assert (
        api.patch(
            f"{PROFILES}/{caretaker['id']}", json={"home_type": "castle"}, headers=owner
        ).status_code
        == 422
    )


def test_caretaker_days_off(
    api: TestClient, owner: dict[str, str], caretaker: dict[str, Any]
) -> None:
    base = f"/api/v1/manage/provider_profile/{caretaker['id']}"
    day = (utcnow().astimezone(ZoneInfo("Asia/Kolkata")) + timedelta(days=5)).date().isoformat()
    added = api.post(
        f"{base}/exceptions",
        json={"on_date": day, "kind": "closed", "note": "Family wedding"},
        headers=owner,
    )
    assert added.status_code == 201, added.text
    assert [e["on_date"] for e in api.get(f"{base}/exceptions", headers=owner).json()] == [day]
    special = api.post(
        f"{base}/exceptions",
        json={
            "on_date": day,
            "kind": "custom_hours",
            "start_time": "09:00",
            "end_time": "12:00",
            "capacity": 1,
        },
        headers=owner,
    )
    assert special.json()["error"]["code"] == "days_off_only"
    # Caretakers still have no vet-style service list, hours or slots.
    assert api.get(f"{base}/services", headers=owner).json()["error"]["code"] == (
        "services_not_supported"
    )
    assert api.delete(f"{base}/exceptions/{added.json()['id']}", headers=owner).status_code == 204
