"""Discovery API: launch areas, search, public detail and slots (milestone 2.5)."""

from __future__ import annotations

import json
from datetime import UTC, date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from app.core.clock import utcnow
from app.modules.auth.otp_delivery import RecordingOtpSender
from app.modules.discovery import service as discovery
from app.modules.discovery.areas import (
    AREAS,
    AreaKey,
    area_for_city,
    distance_km,
    nearest_area,
)
from tests.conftest import bearer, sign_in
from tests.test_providers_clinics import CLINIC, CLINICS, PROFILES, VET

SEARCH = "/api/v1/discover/search"
ALL_DAY = [
    {"weekday": d, "start_time": "00:00", "end_time": "23:55", "capacity": 1} for d in range(7)
]
CONSULT = {
    "category": "general_consultation",
    "title": "Consultation",
    "price_minor": 50000,
    "duration_minutes": 30,
    "service_mode": "in_clinic",
}
HOME = {
    "category": "vaccination",
    "title": "Home vaccination",
    "price_minor": 90000,
    "duration_minutes": 45,
    "service_mode": "home_visit",
}
# Adyar, Chennai (the CLINIC fixture's coordinates) and a point ~20 km away (Avadi).
ADYAR = {"lat": 13.0067, "lng": 80.2575}
AVADI = {"lat": 13.1067, "lng": 80.0970}


def verify(engine: Engine, table: str, row_id: str, status: str = "verified") -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                f"UPDATE {table} SET verification_status = :s, "  # noqa: S608 - test helper
                "verified_at = CASE WHEN :ok THEN now() END WHERE id = :id"
            ),
            {"s": status, "ok": status == "verified", "id": row_id},
        )


@pytest.fixture
def operator(api: TestClient, otp_sender: RecordingOtpSender) -> dict[str, str]:
    return bearer(sign_in(api, otp_sender, "operator@example.com")["access_token"])


@pytest.fixture
def parent(api: TestClient, otp_sender: RecordingOtpSender) -> dict[str, str]:
    return bearer(sign_in(api, otp_sender, "parent@example.com")["access_token"])


def make_clinic(
    api: TestClient, headers: dict[str, str], engine: Engine, *, verified: bool = True, **over: Any
) -> dict[str, Any]:
    clinic: dict[str, Any] = api.post(CLINICS, json={**CLINIC, **over}, headers=headers).json()
    base = f"/api/v1/manage/clinic/{clinic['id']}"
    assert api.post(f"{base}/services", json=CONSULT, headers=headers).status_code == 201
    assert (
        api.put(f"{base}/availability", json={"rules": ALL_DAY}, headers=headers).status_code == 200
    )
    if verified:
        verify(engine, "clinics", clinic["id"])
    return clinic


@pytest.fixture
def vet(api: TestClient, otp_sender: RecordingOtpSender, db_engine: Engine) -> dict[str, Any]:
    headers = bearer(sign_in(api, otp_sender, "vet@example.com")["access_token"])
    profile: dict[str, Any] = api.post(
        PROFILES,
        json={
            **VET,
            "area_key": "chennai",
            "latitude": "13.040000",
            "longitude": "80.230000",
            "service_radius_km": 10,
        },
        headers=headers,
    ).json()
    base = f"/api/v1/manage/provider_profile/{profile['id']}"
    assert api.post(f"{base}/services", json=HOME, headers=headers).status_code == 201
    assert (
        api.put(f"{base}/availability", json={"rules": ALL_DAY}, headers=headers).status_code == 200
    )
    verify(db_engine, "provider_profiles", profile["id"])
    return {**profile, "headers": headers}


def search(api: TestClient, headers: dict[str, str], **params: Any) -> dict[str, Any]:
    response = api.get(SEARCH, params=params, headers=headers)
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


# ---------------------------------------------------------------- areas


def test_areas_list_and_auth(api: TestClient, parent: dict[str, str]) -> None:
    assert api.get("/api/v1/discover/areas").status_code == 401
    body = api.get("/api/v1/discover/areas", headers=parent).json()
    keys = [a["key"] for a in body["areas"]]
    assert len(keys) == 10
    assert {"chennai", "kochi", "bengaluru", "tiruchirappalli", "thrissur"} <= set(keys)
    assert body["default_radius_km"] == 10
    assert body["service_radius_choices_km"] == [5, 10, 15, 25]


def test_area_helpers() -> None:
    assert area_for_city(" Bangalore ") is AreaKey.BENGALURU
    assert area_for_city("Trichy") is AreaKey.TIRUCHIRAPPALLI
    assert area_for_city("Mumbai") is None
    assert nearest_area(13.0067, 80.2575) is AreaKey.CHENNAI
    assert nearest_area(19.07, 72.88) is None  # Mumbai: outside every launch area
    chennai, bengaluru = AREAS[AreaKey.CHENNAI], AREAS[AreaKey.BENGALURU]
    km = distance_km(chennai.latitude, chennai.longitude, bengaluru.latitude, bengaluru.longitude)
    assert 280 < km < 300


# ---------------------------------------------------------------- search


def test_search_needs_a_location(api: TestClient, parent: dict[str, str]) -> None:
    response = api.get(SEARCH, headers=parent)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "location_required"
    assert api.get(SEARCH, params={"lat": 13.0}, headers=parent).status_code == 422


def test_only_verified_active_clinics_with_services_are_listed(
    api: TestClient, operator: dict[str, str], parent: dict[str, str], db_engine: Engine
) -> None:
    listed = make_clinic(api, operator, db_engine)
    make_clinic(api, operator, db_engine, verified=False, name="Draft Clinic")
    suspended = make_clinic(api, operator, db_engine, name="Suspended Clinic")
    with db_engine.begin() as conn:
        conn.execute(
            text("UPDATE clinics SET status = 'suspended' WHERE id = :id"), {"id": suspended["id"]}
        )

    body = search(api, parent, area="chennai")
    assert [i["name"] for i in body["items"]] == ["Paws & Care Clinic"]
    item = body["items"][0]
    assert item["id"] == listed["id"]
    assert item["kind"] == "clinic"
    assert item["subtitle"] == "Adyar, Chennai"
    assert item["area_name"] == "Chennai"
    assert item["distance_is_approximate"] is False
    assert 0 < item["distance_km"] < 10
    assert item["price_from_minor"] == 50000
    assert item["modes"] == ["in_clinic"]
    assert item["categories"] == ["general_consultation"]
    assert item["verified_at"] is not None
    assert body["origin"]["label"] == "Chennai"
    assert "phone" not in item
    assert "email" not in item

    # Archive the only service → nothing bookable → not listed.
    services = api.get(f"/api/v1/manage/clinic/{listed['id']}/services", headers=operator).json()
    api.delete(
        f"/api/v1/manage/clinic/{listed['id']}/services/{services[0]['id']}", headers=operator
    )
    assert search(api, parent, area="chennai")["total"] == 0


def test_area_only_clinic_uses_area_centre(
    api: TestClient, operator: dict[str, str], parent: dict[str, str], db_engine: Engine
) -> None:
    clinic = make_clinic(api, operator, db_engine, latitude=None, longitude=None)
    assert clinic["area_key"] == "chennai"  # matched from the city
    item = search(api, parent, area="chennai")["items"][0]
    assert item["distance_is_approximate"] is True
    assert item["distance_km"] == 0.0


def test_radius_and_device_location(
    api: TestClient, operator: dict[str, str], parent: dict[str, str], db_engine: Engine
) -> None:
    make_clinic(api, operator, db_engine)
    assert search(api, parent, **AVADI)["total"] == 0  # ~20 km away, default 10 km
    wider = search(api, parent, **AVADI, radius_km=25)
    assert wider["total"] == 1
    assert wider["origin"]["label"] == "Near you"
    assert search(api, parent, area="bengaluru")["total"] == 0
    too_far = api.get(SEARCH, params={**AVADI, "radius_km": 26}, headers=parent)
    assert too_far.status_code == 422


def test_filters_and_sort(
    api: TestClient, operator: dict[str, str], parent: dict[str, str], db_engine: Engine
) -> None:
    cheap = make_clinic(api, operator, db_engine, name="Budget Pets", locality="Mylapore")
    pricey = make_clinic(api, operator, db_engine, name="Premium Vets", emergency_services=True)
    base = f"/api/v1/manage/clinic/{pricey['id']}"
    services = api.get(f"{base}/services", headers=operator).json()
    api.patch(
        f"{base}/services/{services[0]['id']}", json={"price_minor": 150000}, headers=operator
    )
    api.post(
        f"{base}/services",
        json={**CONSULT, "category": "dental", "title": "Dental"},
        headers=operator,
    )

    assert [i["name"] for i in search(api, parent, area="chennai", sort="price")["items"]] == [
        "Budget Pets",
        "Premium Vets",
    ]
    dental = search(api, parent, area="chennai", category="dental")["items"]
    assert [i["name"] for i in dental] == ["Premium Vets"]
    assert dental[0]["categories"] == ["dental"]
    capped = search(api, parent, area="chennai", price_max_minor=60000)["items"]
    assert [i["id"] for i in capped] == [cheap["id"], pricey["id"]]  # dental ₹500 still matches
    assert [i["name"] for i in search(api, parent, area="chennai", emergency=True)["items"]] == [
        "Premium Vets"
    ]
    assert [i["name"] for i in search(api, parent, area="chennai", q="mylap")["items"]] == [
        "Budget Pets"
    ]
    assert search(api, parent, area="chennai", mode="home_visit")["total"] == 0
    assert search(api, parent, area="chennai", species="rabbit")["total"] == 0

    # Close Premium Vets today → "open now" excludes it; next slot moves past today.
    with db_engine.begin() as conn:
        today = utcnow().astimezone(ZoneInfo("Asia/Kolkata")).date()
        conn.execute(
            text(
                "INSERT INTO availability_exceptions (clinic_id, on_date, kind) "
                "VALUES (:id, :d, 'closed')"
            ),
            {"id": pricey["id"], "d": today},
        )
    everyone = {i["name"]: i for i in search(api, parent, area="chennai")["items"]}
    assert everyone["Premium Vets"]["open_now"] is False
    next_slot = datetime.fromisoformat(everyone["Premium Vets"]["next_slot_at"])
    assert next_slot.astimezone(ZoneInfo("Asia/Kolkata")).date() > today
    assert everyone["Budget Pets"]["next_slot_at"] is not None
    open_now = search(api, parent, area="chennai", open_now=True)["items"]
    assert "Premium Vets" not in [i["name"] for i in open_now]


def test_paging(
    api: TestClient, operator: dict[str, str], parent: dict[str, str], db_engine: Engine
) -> None:
    for n in range(3):
        make_clinic(api, operator, db_engine, name=f"Clinic {n}")
    page = search(api, parent, area="chennai", limit=2, offset=2)
    assert page["total"] == 3
    assert len(page["items"]) == 1


# ---------------------------------------------------------------- home-visit vets


def test_home_visit_vet_inside_their_radius(
    api: TestClient, parent: dict[str, str], vet: dict[str, Any], db_engine: Engine
) -> None:
    near = search(api, parent, **ADYAR)  # ~4 km from the vet's base
    assert [i["kind"] for i in near["items"]] == ["vet"]
    item = near["items"][0]
    assert item["name"] == "Dr. Priya Nair"
    assert item["distance_km"] is None  # never reveal the base
    assert item["service_radius_km"] == 10
    assert item["modes"] == ["home_visit"]
    assert item["languages"] == ["Tamil", "English"]
    assert "latitude" not in json.dumps(near["items"])  # origin echoes the searcher only

    # Avadi is ~20 km from the base: outside a 10 km reach even with a 25 km search.
    assert search(api, parent, **AVADI, radius_km=25)["total"] == 0
    assert search(api, parent, area="chennai", kind="clinic")["total"] == 0
    assert search(api, parent, area="chennai", mode="in_clinic")["total"] == 0

    # Owner still sees their own coordinates.
    mine = api.get(f"{PROFILES}/{vet['id']}", headers=vet["headers"]).json()
    assert mine["latitude"] == "13.040000"
    assert mine["service_radius_km"] == 10


def test_vet_detail_and_clinic_doctors(
    api: TestClient, parent: dict[str, str], vet: dict[str, Any], db_engine: Engine
) -> None:
    clinic: dict[str, Any] = api.post(
        CLINICS, json={**CLINIC, "practises_here": True}, headers=vet["headers"]
    ).json()
    api.post(f"/api/v1/manage/clinic/{clinic['id']}/services", json=CONSULT, headers=vet["headers"])
    verify(db_engine, "clinics", clinic["id"])

    detail = api.get(f"/api/v1/discover/vets/{vet['id']}", params=ADYAR, headers=parent)
    assert detail.status_code == 200, detail.text
    body = detail.json()
    assert body["visits_you"] is True
    assert body["service_radius_km"] == 10
    assert body["area_name"] == "Chennai"
    assert [s["title"] for s in body["services"]] == ["Home vaccination"]
    assert [c["name"] for c in body["clinics"]] == ["Paws & Care Clinic"]
    assert any("Tamil Nadu State Veterinary Council" in c for c in body["badge"]["checks"])
    assert len(body["hours"]) == 7
    raw = json.dumps(body)
    assert "latitude" not in raw
    assert "registration_number" not in raw
    assert "TNSVC" not in raw

    far = api.get(f"/api/v1/discover/vets/{vet['id']}", params=AVADI, headers=parent).json()
    assert far["visits_you"] is False

    clinic_body = api.get(f"/api/v1/discover/clinics/{clinic['id']}", headers=parent).json()
    assert [d["display_name"] for d in clinic_body["doctors"]] == ["Dr. Priya Nair"]
    assert clinic_body["latitude"] == pytest.approx(13.0067)
    assert clinic_body["distance_km"] is None
    assert clinic_body["badge"]["checks"] == [
        "Business registration (shop & establishment or trade licence)"
    ]
    assert "phone" not in clinic_body
    assert "email" not in clinic_body


def test_unlisted_details_are_not_found(
    api: TestClient,
    operator: dict[str, str],
    parent: dict[str, str],
    db_engine: Engine,
    vet: dict[str, Any],
) -> None:
    draft = make_clinic(api, operator, db_engine, verified=False)
    assert api.get(f"/api/v1/discover/clinics/{draft['id']}", headers=parent).status_code == 404
    verify(db_engine, "provider_profiles", vet["id"], status="needs_info")
    assert api.get(f"/api/v1/discover/vets/{vet['id']}", headers=parent).status_code == 404
    # A clinic id is not a vet id.
    assert api.get(f"/api/v1/discover/vets/{draft['id']}", headers=parent).status_code == 404


def test_clinic_detail_hours_and_closures(
    api: TestClient, operator: dict[str, str], parent: dict[str, str], db_engine: Engine
) -> None:
    clinic = make_clinic(api, operator, db_engine)
    base = f"/api/v1/manage/clinic/{clinic['id']}"
    api.put(
        f"{base}/availability",
        json={"rules": [{"weekday": 0, "start_time": "09:00", "end_time": "13:00", "capacity": 3}]},
        headers=operator,
    )
    off = (utcnow().astimezone(ZoneInfo("Asia/Kolkata")) + timedelta(days=3)).date()
    api.post(
        f"{base}/exceptions",
        json={"on_date": off.isoformat(), "kind": "closed", "note": "Staff training"},
        headers=operator,
    )
    body = api.get(
        f"/api/v1/discover/clinics/{clinic['id']}", params={"area": "chennai"}, headers=parent
    ).json()
    assert body["hours"][0] == {
        "weekday": 0,
        "ranges": [{"start_time": "09:00:00", "end_time": "13:00:00"}],
    }
    assert body["hours"][1]["ranges"] == []
    assert body["closures"] == [
        {"on_date": off.isoformat(), "kind": "closed", "start_time": None, "end_time": None}
    ]
    assert "Staff training" not in json.dumps(body)  # internal note stays private
    assert "capacity" not in json.dumps(body)
    assert 0 < body["distance_km"] < 10


# ---------------------------------------------------------------- slots


def test_public_slots(
    api: TestClient,
    operator: dict[str, str],
    parent: dict[str, str],
    db_engine: Engine,
    vet: dict[str, Any],
) -> None:
    clinic = make_clinic(api, operator, db_engine)
    service_id = api.get(f"/api/v1/manage/clinic/{clinic['id']}/services", headers=operator).json()[
        0
    ]["id"]
    on = (utcnow().astimezone(ZoneInfo("Asia/Kolkata")) + timedelta(days=2)).date()
    url = f"/api/v1/discover/clinics/{clinic['id']}/slots"
    body = api.get(
        url, params={"service_id": service_id, "date": on.isoformat()}, headers=parent
    ).json()
    assert body["timezone"] == "Asia/Kolkata"
    assert body["slots"][0]["local_start"] == "00:00"
    assert len(body["slots"]) == 47  # 00:00 to 23:55 in 30-minute steps
    assert "capacity" not in body["slots"][0]

    # Another listing's service, a past date, or an unverified clinic → refused.
    vet_service = api.get(
        f"/api/v1/manage/provider_profile/{vet['id']}/services", headers=vet["headers"]
    ).json()[0]["id"]
    assert (
        api.get(
            url, params={"service_id": vet_service, "date": on.isoformat()}, headers=parent
        ).status_code
        == 404
    )
    past = (on - timedelta(days=5)).isoformat()
    assert (
        api.get(url, params={"service_id": service_id, "date": past}, headers=parent).json()[
            "error"
        ]["code"]
        == "invalid_date"
    )
    vet_slots = api.get(
        f"/api/v1/discover/vets/{vet['id']}/slots",
        params={"service_id": vet_service, "date": on.isoformat()},
        headers=parent,
    )
    assert vet_slots.status_code == 200
    verify(db_engine, "clinics", clinic["id"], status="draft")
    assert (
        api.get(
            url, params={"service_id": service_id, "date": on.isoformat()}, headers=parent
        ).status_code
        == 404
    )


# ---------------------------------------------------------------- provider locations


def test_clinic_location_rules(api: TestClient, operator: dict[str, str]) -> None:
    far = api.post(CLINICS, json={**CLINIC, "area_key": "kochi"}, headers=operator)
    assert far.status_code == 422
    assert far.json()["error"]["code"] == "location_outside_area"

    inferred = api.post(CLINICS, json={**CLINIC, "city": "Madras"}, headers=operator).json()
    assert inferred["area_key"] == "chennai"  # from the coordinates

    moved = api.patch(
        f"{CLINICS}/{inferred['id']}",
        json={"area_key": "bengaluru", "latitude": "12.935000", "longitude": "77.624000"},
        headers=operator,
    ).json()
    assert moved["area_key"] == "bengaluru"
    unknown = api.post(CLINICS, json={**CLINIC, "area_key": "mumbai"}, headers=operator)
    assert unknown.status_code == 422


def test_vet_location_validation(api: TestClient, otp_sender: RecordingOtpSender) -> None:
    headers = bearer(sign_in(api, otp_sender, "vet2@example.com")["access_token"])
    bad = api.post(PROFILES, json={**VET, "service_radius_km": 7}, headers=headers)
    assert bad.status_code == 422
    half = api.post(PROFILES, json={**VET, "latitude": "13.0"}, headers=headers)
    assert half.status_code == 422
    made = api.post(PROFILES, json={**VET, "city": "Bangalore"}, headers=headers).json()
    assert made["area_key"] == "bengaluru"  # matched from the city
    assert made["latitude"] is None


# ---------------------------------------------------------------- schedule maths


class _Rule:
    def __init__(self, weekday: int, start: time, end: time) -> None:
        self.weekday, self.start_time, self.end_time, self.capacity = weekday, start, end, 1


def test_open_now_and_next_slot_unit() -> None:
    monday = date(2026, 11, 30)
    rules = [_Rule(0, time(9), time(13))]
    schedule = discovery._Schedule(rules=rules, exceptions=[])  # type: ignore[arg-type]
    ist = ZoneInfo("Asia/Kolkata")
    at_ten = datetime.combine(monday, time(10), tzinfo=ist).astimezone(UTC)
    at_two = datetime.combine(monday, time(14), tzinfo=ist).astimezone(UTC)
    assert discovery.is_open_now(schedule, "Asia/Kolkata", at_ten) is True
    assert discovery.is_open_now(schedule, "Asia/Kolkata", at_two) is False
    # 10:00 + 30 min lead → 10:30 today; after hours → nothing within 7 days but next Monday.
    first = discovery.next_slot(schedule, "Asia/Kolkata", 30, at_ten)
    assert first == datetime.combine(monday, time(10, 30), tzinfo=ist).astimezone(UTC)
    later = discovery.next_slot(schedule, "Asia/Kolkata", 30, at_two)
    assert later == datetime.combine(monday + timedelta(days=7), time(9), tzinfo=ist).astimezone(
        UTC
    )
