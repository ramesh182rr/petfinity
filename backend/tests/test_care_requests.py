"""Care requests, offers and care bookings (milestones 3.2-3.3, decision 0015)."""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from app.core.clock import utcnow
from app.modules.auth.otp_delivery import RecordingOtpSender
from tests.conftest import bearer, sign_in
from tests.test_discovery_api import verify
from tests.test_providers_clinics import PROFILES

IST = ZoneInfo("Asia/Kolkata")
REQUESTS = "/api/v1/care-requests"
BOOKINGS = "/api/v1/bookings"
PETS = "/api/v1/pets"
# Adyar (parent) and caretakers ~4 km (Meena) and ~30 km (far) away.
ADYAR = {"latitude": "13.006700", "longitude": "80.257500"}


def user(api: TestClient, otp_sender: RecordingOtpSender, email: str) -> dict[str, str]:
    return bearer(sign_in(api, otp_sender, email)["access_token"])


def at_ist(days: int, hour: int) -> datetime:
    local = (utcnow().astimezone(IST) + timedelta(days=days)).replace(
        hour=hour, minute=0, second=0, microsecond=0
    )
    return local.astimezone(UTC)


def iso(dt: datetime) -> str:
    return dt.isoformat().replace("+00:00", "Z")


def make_caretaker(
    api: TestClient,
    headers: dict[str, str],
    engine: Engine,
    *,
    lat: str = "13.040000",
    lng: str = "80.230000",
    capacity: int = 1,
    services: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    profile: dict[str, Any] = api.post(
        PROFILES,
        json={
            "provider_type": "caretaker",
            "display_name": "Meena S.",
            "area_key": "chennai",
            "latitude": lat,
            "longitude": lng,
            "service_radius_km": 10,
            "home_type": "independent_house",
            "outdoor_space": True,
            "max_concurrent": capacity,
        },
        headers=headers,
    ).json()
    api.put(
        f"/api/v1/manage/provider_profile/{profile['id']}/care/services",
        json={
            "services": services
            or [
                {"care_type": "boarding", "rate_minor": 90000, "species": ["dog", "cat"]},
                {"care_type": "home_visit", "rate_minor": 30000, "species": ["dog", "cat"]},
            ]
        },
        headers=headers,
    )
    verify(engine, "provider_profiles", profile["id"])
    return {**profile, "headers": headers}


@pytest.fixture
def parent(api: TestClient, otp_sender: RecordingOtpSender) -> dict[str, str]:
    return user(api, otp_sender, "parent@example.com")


@pytest.fixture
def meena(api: TestClient, otp_sender: RecordingOtpSender, db_engine: Engine) -> dict[str, Any]:
    return make_caretaker(api, user(api, otp_sender, "meena@example.com"), db_engine)


def pet(api: TestClient, headers: dict[str, str], species: str = "dog", name: str = "Bruno") -> str:
    return str(
        api.post(
            PETS,
            json={
                "name": name,
                "species": species,
                "breed": "Indie",
                "temperament": "Friendly, scared of fireworks",
            },
            headers=headers,
        ).json()["id"]
    )


def boarding(pet_ids: list[str], **over: Any) -> dict[str, Any]:
    return {
        "care_type": "boarding",
        "pet_ids": pet_ids,
        "start_at": iso(at_ist(5, 18)),
        "end_at": iso(at_ist(8, 10)),
        "area_key": "chennai",
        "locality": "Adyar",
        **ADYAR,
        "notes": "Two walks a day please",
        "budget_minor": 300000,
        **over,
    }


def feed(api: TestClient, ct: dict[str, Any], scope: str = "open") -> list[dict[str, Any]]:
    body = api.get(
        f"/api/v1/manage/provider_profile/{ct['id']}/care/requests",
        params={"scope": scope},
        headers=ct["headers"],
    )
    assert body.status_code == 200, body.text
    items: list[dict[str, Any]] = body.json()["items"]
    return items


def offer_url(ct: dict[str, Any], request_id: str) -> str:
    return f"/api/v1/manage/provider_profile/{ct['id']}/care/requests/{request_id}/offer"


# ---------------------------------------------------------------- 3.2 requests


def test_post_and_match_a_request(
    api: TestClient,
    parent: dict[str, str],
    meena: dict[str, Any],
    otp_sender: RecordingOtpSender,
    db_engine: Engine,
) -> None:
    created = api.post(REQUESTS, json=boarding([pet(api, parent)]), headers=parent)
    assert created.status_code == 201, created.text
    req = created.json()
    assert req["status"] == "open"
    assert (req["units"], req["unit"]) == (3, "night")
    assert req["accepting_offers"] is True
    assert req["offers"] == []
    assert req["area_name"] == "Chennai"
    assert req["pets"][0]["temperament"] == "Friendly, scared of fireworks"
    assert parse(req["offers_close_at"]) - utcnow() <= timedelta(hours=24, seconds=5)

    # Meena (4 km away, boarding, dogs) sees it, without the address or the parent's identity.
    items = feed(api, meena)
    assert [i["id"] for i in items] == [req["id"]]
    seen = items[0]
    assert seen["distance_km"] in (4, 5)
    assert seen["suggested_price_minor"] == 270000  # 3 nights x ₹900
    raw = json.dumps(seen)
    assert "Adyar" in raw  # the locality is public
    assert "13.0067" not in raw
    assert "parent@example.com" not in raw

    # A caretaker 30 km away, one without boarding, an unverified one: none see it.
    far = make_caretaker(
        api, user(api, otp_sender, "far@example.com"), db_engine, lat="13.260000", lng="80.270000"
    )
    visits_only = make_caretaker(
        api,
        user(api, otp_sender, "visits@example.com"),
        db_engine,
        services=[{"care_type": "home_visit", "rate_minor": 30000, "species": ["dog"]}],
    )
    assert feed(api, far) == []
    assert feed(api, visits_only) == []
    pending = make_caretaker(api, user(api, otp_sender, "new@example.com"), db_engine)
    verify(db_engine, "provider_profiles", pending["id"], status="submitted")
    blocked = api.get(
        f"/api/v1/manage/provider_profile/{pending['id']}/care/requests", headers=pending["headers"]
    )
    assert blocked.json()["error"]["code"] == "not_verified"
    # And they can't open it directly either.
    direct = api.get(
        f"/api/v1/manage/provider_profile/{far['id']}/care/requests/{req['id']}",
        headers=far["headers"],
    )
    assert direct.status_code == 404


def test_matching_respects_species_pets_days_off_and_capacity(
    api: TestClient,
    parent: dict[str, str],
    meena: dict[str, Any],
    db_engine: Engine,
) -> None:
    rabbit = pet(api, parent, "rabbit", "Hopper")
    api.post(REQUESTS, json=boarding([rabbit]), headers=parent)
    three = [pet(api, parent, name=n) for n in ("A", "B", "C")]  # boarding takes max 2
    api.post(REQUESTS, json=boarding(three), headers=parent)
    assert feed(api, meena) == []

    ok = api.post(REQUESTS, json=boarding([pet(api, parent)]), headers=parent).json()
    assert [i["id"] for i in feed(api, meena)] == [ok["id"]]
    day = (at_ist(6, 12).astimezone(IST)).date().isoformat()
    api.post(
        f"/api/v1/manage/provider_profile/{meena['id']}/exceptions",
        json={"on_date": day, "kind": "closed"},
        headers=meena["headers"],
    )
    assert feed(api, meena) == []  # a day off inside the stay


def test_request_validation(api: TestClient, parent: dict[str, str]) -> None:
    dog = pet(api, parent)

    def code(body: dict[str, Any]) -> str:
        return str(api.post(REQUESTS, json=body, headers=parent).json()["error"]["code"])

    assert code(boarding([dog], start_at=iso(utcnow() + timedelta(hours=1)))) == "too_soon"
    assert code(boarding([dog], start_at=iso(at_ist(70, 10)), end_at=iso(at_ist(72, 10)))) == (
        "too_far"
    )
    assert code(boarding([dog], start_at=iso(at_ist(5, 9)), end_at=iso(at_ist(5, 18)))) == (
        "invalid_dates"
    )
    assert code(boarding([dog], care_type="home_visit")) == "visits_required"
    assert code(boarding([dog], visits_per_day=2)) == "visits_not_allowed"
    assert code(boarding([dog], care_type="house_sitting")) == "address_required"
    assert code(boarding([dog], area_key="kochi")) == "location_outside_area"
    assert code(boarding(["00000000-0000-0000-0000-000000000000"])) == "pet_not_found"
    visits = api.post(
        REQUESTS,
        json=boarding(
            [dog],
            care_type="home_visit",
            visits_per_day=2,
            start_at=iso(at_ist(5, 8)),
            end_at=iso(at_ist(7, 20)),
            address="4, Beach Road",
        ),
        headers=parent,
    ).json()
    assert (visits["units"], visits["unit"]) == (6, "visit")  # 3 days x 2
    for _ in range(4):
        api.post(REQUESTS, json=boarding([dog]), headers=parent)
    assert code(boarding([dog])) == "too_many_requests"


def test_cancel_and_expiry(
    api: TestClient,
    parent: dict[str, str],
    meena: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    req = api.post(REQUESTS, json=boarding([pet(api, parent)]), headers=parent).json()
    api.put(offer_url(meena, req["id"]), json={"price_minor": 250000}, headers=meena["headers"])
    cancelled = api.post(f"{REQUESTS}/{req['id']}/cancel", headers=parent).json()
    assert cancelled["status"] == "cancelled"
    assert cancelled["offers"][0]["status"] == "declined"
    again = api.post(f"{REQUESTS}/{req['id']}/cancel", headers=parent)
    assert again.json()["error"]["code"] == "request_closed"

    lonely = api.post(
        REQUESTS, json=boarding([pet(api, parent, name="Kitty")]), headers=parent
    ).json()
    monkeypatch.setattr(
        "app.core.clock.utcnow", lambda: parse(lonely["offers_close_at"]) + timedelta(minutes=1)
    )
    assert api.get(f"{REQUESTS}/{lonely['id']}", headers=parent).json()["status"] == "expired"
    past = api.get(REQUESTS, params={"scope": "past"}, headers=parent).json()["items"]
    assert {r["status"] for r in past} == {"cancelled", "expired"}


# ---------------------------------------------------------------- 3.3 offers and booking


def test_offer_compare_accept_and_book(
    api: TestClient,
    parent: dict[str, str],
    meena: dict[str, Any],
    otp_sender: RecordingOtpSender,
    db_engine: Engine,
) -> None:
    with db_engine.begin() as conn:
        conn.execute(
            text(
                "UPDATE users SET display_name = 'Lakshmi Iyer' WHERE email = 'parent@example.com'"
            )
        )
    req = api.post(
        REQUESTS,
        json=boarding([pet(api, parent)], care_type="house_sitting", address="12, 2nd Main Rd"),
        headers=parent,
    ).json()
    house = [{"care_type": "house_sitting", "rate_minor": 120000, "species": ["dog"]}]
    api.put(
        f"/api/v1/manage/provider_profile/{meena['id']}/care/services",
        json={"services": house},
        headers=meena["headers"],
    )
    arjun = make_caretaker(
        api, user(api, otp_sender, "arjun@example.com"), db_engine, services=house
    )

    offered = api.put(
        offer_url(meena, req["id"]),
        json={"price_minor": 330000, "message": "  Happy to stay over! "},
        headers=meena["headers"],
    )
    assert offered.status_code == 200, offered.text
    assert offered.json()["my_offer"]["message"] == "Happy to stay over!"
    updated = api.put(
        offer_url(meena, req["id"]), json={"price_minor": 320000}, headers=meena["headers"]
    ).json()
    assert updated["my_offer"]["price_minor"] == 320000
    api.put(offer_url(arjun, req["id"]), json={"price_minor": 360000}, headers=arjun["headers"])
    assert [i["id"] for i in feed(api, meena, "offered")] == [req["id"]]
    assert feed(api, meena) == []  # already offered: not in the open feed

    mine = api.get(f"{REQUESTS}/{req['id']}", headers=parent).json()
    assert [o["price_minor"] for o in mine["offers"]] == [320000, 360000]  # cheapest first
    first = mine["offers"][0]["caretaker"]
    assert first["display_name"] == "Meena S."
    assert (first["home_type"], first["rate_minor"], first["completed_care"]) == (
        "independent_house",
        120000,
        0,
    )
    assert "latitude" not in json.dumps(first)

    url = f"{REQUESTS}/{req['id']}/offers/{mine['offers'][0]['id']}/accept"
    accepted = api.post(url, headers=parent)
    assert accepted.status_code == 201, accepted.text
    b = accepted.json()
    assert b["booking_type"] == "care"
    assert b["status"] == "confirmed"
    assert b["service_mode"] == "house_sitting"
    assert b["service_title"] == "House sitting · 3 nights"
    assert b["amount_minor"] == 320000
    assert b["listing"]["kind"] == "caretaker"
    assert b["policy"]["free_cancellation_hours_before"] == 48
    assert "reschedule" not in b["allowed_actions"]
    replay = api.post(url, headers=parent)
    assert (replay.status_code, replay.json()["id"]) == (200, b["id"])

    after = api.get(f"{REQUESTS}/{req['id']}", headers=parent).json()
    assert after["status"] == "booked"
    assert after["booking_id"] == b["id"]
    assert [o["status"] for o in after["offers"]] == ["accepted", "declined"]

    # The caretaker now sees the address and the parent's name in the booking.
    as_meena = api.get(f"{BOOKINGS}/{b['id']}", headers=meena["headers"]).json()
    assert as_meena["visit_address"] == "12, 2nd Main Rd"
    assert as_meena["owner_name"] == "Lakshmi Iyer"
    assert feed(api, meena, "offered")[0]["booking_id"] == b["id"]
    inbox = api.get(
        f"/api/v1/manage/provider_profile/{meena['id']}/bookings", headers=meena["headers"]
    ).json()["items"]
    assert [x["id"] for x in inbox] == [b["id"]]
    note = api.get("/api/v1/notifications", headers=meena["headers"]).json()["items"][0]
    assert note["title"].startswith("Offer accepted")


def test_offer_rules(
    api: TestClient,
    parent: dict[str, str],
    meena: dict[str, Any],
    otp_sender: RecordingOtpSender,
    db_engine: Engine,
) -> None:
    req = api.post(REQUESTS, json=boarding([pet(api, parent)]), headers=parent).json()
    url = offer_url(meena, req["id"])
    assert api.put(url, json={"price_minor": -1}, headers=meena["headers"]).status_code == 422
    api.put(url, json={"price_minor": 250000}, headers=meena["headers"])
    assert api.delete(url, headers=meena["headers"]).status_code == 204
    assert api.delete(url, headers=meena["headers"]).status_code == 404
    again = api.put(url, json={"price_minor": 240000}, headers=meena["headers"])
    assert again.json()["my_offer"]["status"] == "pending"  # re-offer after withdrawing

    # Closes at five offers.
    others = []
    for i in range(4):
        others.append(make_caretaker(api, user(api, otp_sender, f"c{i}@example.com"), db_engine))
        api.put(
            offer_url(others[-1], req["id"]),
            json={"price_minor": 200000 + i},
            headers=others[-1]["headers"],
        )
    sixth = make_caretaker(api, user(api, otp_sender, "late@example.com"), db_engine)
    assert feed(api, sixth) == []
    closed = api.put(offer_url(sixth, req["id"]), json={"price_minor": 1}, headers=sixth["headers"])
    assert closed.json()["error"]["code"] == "offers_closed"
    shown = api.get(f"{REQUESTS}/{req['id']}", headers=parent).json()
    assert (shown["accepting_offers"], shown["offer_count"]) == (False, 5)


def test_capacity_and_care_cancellation_policy(
    api: TestClient,
    parent: dict[str, str],
    meena: dict[str, Any],
    otp_sender: RecordingOtpSender,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    other_parent = user(api, otp_sender, "other@example.com")
    first = api.post(REQUESTS, json=boarding([pet(api, parent)]), headers=parent).json()
    second = api.post(
        REQUESTS, json=boarding([pet(api, other_parent)]), headers=other_parent
    ).json()
    for r in (first, second):
        api.put(offer_url(meena, r["id"]), json={"price_minor": 270000}, headers=meena["headers"])
    one = api.get(f"{REQUESTS}/{first['id']}", headers=parent).json()
    booked = api.post(
        f"{REQUESTS}/{first['id']}/offers/{one['offers'][0]['id']}/accept", headers=parent
    ).json()
    # Meena takes 1 booking at a time: the overlapping second can't be accepted now.
    two = api.get(f"{REQUESTS}/{second['id']}", headers=other_parent).json()
    clash = api.post(
        f"{REQUESTS}/{second['id']}/offers/{two['offers'][0]['id']}/accept", headers=other_parent
    )
    assert clash.json()["error"]["code"] == "caretaker_unavailable"

    # 48 h policy: paid, cancelled 24 h before → half back.
    url = f"{BOOKINGS}/{booked['id']}"
    api.post(f"{url}/payment", json={"method": "pay_now"}, headers=parent)
    monkeypatch.setattr(
        "app.core.clock.utcnow", lambda: parse(booked["start_at"]) - timedelta(hours=24)
    )
    out = api.post(f"{url}/cancel", json={}, headers=parent).json()
    assert out["cancellation_outcome"] == "late_half_refund"
    assert out["payment_status"] == "partially_refunded"
    assert [(p["kind"], p["amount_minor"]) for p in out["payments"]] == [
        ("charge", 270000),
        ("refund", 135000),
    ]
    moved = api.post(f"{url}/reschedule", json={"start_at": iso(at_ist(9, 10))}, headers=parent)
    assert moved.json()["error"]["code"] in ("action_not_allowed", "invalid_transition")


def test_strangers_and_ownership(
    api: TestClient, parent: dict[str, str], meena: dict[str, Any], otp_sender: RecordingOtpSender
) -> None:
    req = api.post(REQUESTS, json=boarding([pet(api, parent)]), headers=parent).json()
    stranger = user(api, otp_sender, "x@example.com")
    assert api.get(f"{REQUESTS}/{req['id']}", headers=stranger).status_code == 404
    assert api.post(f"{REQUESTS}/{req['id']}/cancel", headers=stranger).status_code == 404
    api.put(offer_url(meena, req["id"]), json={"price_minor": 1000}, headers=meena["headers"])
    offer_id = api.get(f"{REQUESTS}/{req['id']}", headers=parent).json()["offers"][0]["id"]
    stolen = api.post(f"{REQUESTS}/{req['id']}/offers/{offer_id}/accept", headers=stranger)
    assert stolen.status_code == 404
    # A caretaker can't use someone else's profile id.
    other = user(api, otp_sender, "y@example.com")
    assert (
        api.get(
            f"/api/v1/manage/provider_profile/{meena['id']}/care/requests", headers=other
        ).status_code
        == 404
    )


def parse(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))
