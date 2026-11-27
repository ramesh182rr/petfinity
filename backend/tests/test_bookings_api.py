"""Booking engine API (milestone 2.6): decisions 0004, 0005 and 0012."""

from __future__ import annotations

import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text
from sqlalchemy.exc import IntegrityError

from app.core.clock import utcnow
from app.modules.auth.otp_delivery import RecordingOtpSender
from tests.conftest import bearer, sign_in
from tests.test_discovery_api import CONSULT, verify
from tests.test_discovery_api import vet as vet
from tests.test_providers_clinics import CLINIC, CLINICS

BOOKINGS = "/api/v1/bookings"
PETS = "/api/v1/pets"
ADMIN_EMAIL = "admin@petfinity.in"
IST = ZoneInfo("Asia/Kolkata")


@pytest.fixture
def api_settings_overrides() -> dict[str, object]:
    return {"bootstrap_admin_emails": ADMIN_EMAIL, "staff_email_domains": "petfinity.in"}


def user(api: TestClient, otp_sender: RecordingOtpSender, email: str) -> dict[str, str]:
    return bearer(sign_in(api, otp_sender, email)["access_token"])


@pytest.fixture
def operator(api: TestClient, otp_sender: RecordingOtpSender) -> dict[str, str]:
    return user(api, otp_sender, "operator@example.com")


@pytest.fixture
def parent(api: TestClient, otp_sender: RecordingOtpSender) -> dict[str, str]:
    return user(api, otp_sender, "parent@example.com")


def add_pet(api: TestClient, headers: dict[str, str], species: str = "dog") -> str:
    pet: dict[str, Any] = api.post(
        PETS, json={"name": f"Pet-{species}", "species": species}, headers=headers
    ).json()
    return str(pet["id"])


def make_clinic(
    api: TestClient, headers: dict[str, str], engine: Engine, capacity: int = 1
) -> dict[str, Any]:
    clinic: dict[str, Any] = api.post(CLINICS, json=CLINIC, headers=headers).json()
    base = f"/api/v1/manage/clinic/{clinic['id']}"
    service = api.post(f"{base}/services", json=CONSULT, headers=headers).json()
    rules = [
        {"weekday": d, "start_time": "00:00", "end_time": "23:55", "capacity": capacity}
        for d in range(7)
    ]
    assert (
        api.put(f"{base}/availability", json={"rules": rules}, headers=headers).status_code == 200
    )
    verify(engine, "clinics", clinic["id"])
    return {**clinic, "service_id": service["id"]}


@pytest.fixture
def clinic(api: TestClient, operator: dict[str, str], db_engine: Engine) -> dict[str, Any]:
    return make_clinic(api, operator, db_engine)


def open_times(
    api: TestClient, headers: dict[str, str], kind: str, listing_id: str, service_id: str, days: int
) -> list[str]:
    on = (utcnow().astimezone(IST) + timedelta(days=days)).date().isoformat()
    body = api.get(
        f"/api/v1/discover/{kind}/{listing_id}/slots",
        params={"service_id": service_id, "date": on},
        headers=headers,
    ).json()
    return [s["start"] for s in body["slots"]]


def slot_at(days: int, hour: int, minute: int = 0) -> str:
    local = (utcnow().astimezone(IST) + timedelta(days=days)).replace(
        hour=hour, minute=minute, second=0, microsecond=0
    )
    return local.astimezone(UTC).isoformat().replace("+00:00", "Z")


def book(
    api: TestClient,
    headers: dict[str, str],
    clinic: dict[str, Any],
    pet_id: str,
    start: str,
    *,
    key: str | None = None,
    **over: Any,
) -> Any:
    body = {
        "listing_kind": "clinic",
        "listing_id": clinic["id"],
        "service_id": clinic["service_id"],
        "start_at": start,
        "pet_ids": [pet_id],
        **over,
    }
    return api.post(
        BOOKINGS, json=body, headers={**headers, "Idempotency-Key": key or uuid.uuid4().hex}
    )


def at(monkeypatch: pytest.MonkeyPatch, when: datetime) -> None:
    monkeypatch.setattr("app.core.clock.utcnow", lambda: when)


def parse(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


# ---------------------------------------------------------------- instant bookings


def test_instant_booking_lifecycle(
    api: TestClient,
    operator: dict[str, str],
    parent: dict[str, str],
    clinic: dict[str, Any],
    otp_sender: RecordingOtpSender,
) -> None:
    pet = add_pet(api, parent)
    start = slot_at(2, 10)
    assert start in [
        s.replace("+00:00", "Z")
        for s in open_times(api, parent, "clinics", clinic["id"], clinic["service_id"], 2)
    ]

    created = book(api, parent, clinic, pet, start, owner_notes="  Limping since Monday ")
    assert created.status_code == 201, created.text
    b = created.json()
    assert b["status"] == "confirmed"
    assert b["confirmation_mode"] == "instant"
    assert b["payment_status"] == "unpaid"
    assert b["payment_is_mock"] is True
    assert b["amount_minor"] == 50000
    assert b["service_title"] == "Consultation"
    assert b["listing"] == {
        "kind": "clinic",
        "id": clinic["id"],
        "name": "Paws & Care Clinic",
        "locality": "Adyar",
    }
    assert b["owner_notes"] == "Limping since Monday"
    assert [p["id"] for p in b["pets"]] == [pet]
    assert parse(b["end_at"]) - parse(b["start_at"]) == timedelta(minutes=30)
    assert parse(b["policy"]["free_cancellation_until"]) == parse(start) - timedelta(hours=2)
    assert b["viewer_role"] == "owner"
    assert b["owner_name"] is None
    assert b["allowed_actions"] == ["cancel", "reschedule", "pay", "pay_at_visit"]
    assert [e["event"] for e in b["events"]] == ["created"]

    # Capacity 1: the slot is gone for everyone else.
    times = open_times(api, parent, "clinics", clinic["id"], clinic["service_id"], 2)
    assert start not in [s.replace("+00:00", "Z") for s in times]

    # Owner list and provider inbox.
    mine = api.get(BOOKINGS, headers=parent).json()["items"]
    assert [x["id"] for x in mine] == [b["id"]]
    assert api.get(BOOKINGS, params={"scope": "past"}, headers=parent).json()["items"] == []
    inbox = api.get(f"/api/v1/manage/clinic/{clinic['id']}/bookings", headers=operator).json()[
        "items"
    ]
    assert inbox[0]["viewer_role"] == "provider"
    assert inbox[0]["owner_name"] is None or isinstance(inbox[0]["owner_name"], str)
    assert inbox[0]["allowed_actions"] == ["cancel"]  # check-in opens an hour before

    # Strangers see nothing.
    stranger = user(api, otp_sender, "stranger@example.com")
    assert api.get(f"{BOOKINGS}/{b['id']}", headers=stranger).status_code == 404
    assert (
        api.get(f"/api/v1/manage/clinic/{clinic['id']}/bookings", headers=stranger).status_code
        == 404
    )


def test_visit_flow_check_in_complete_and_no_show(
    api: TestClient,
    operator: dict[str, str],
    parent: dict[str, str],
    clinic: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pet = add_pet(api, parent)
    first = book(api, parent, clinic, pet, slot_at(2, 10)).json()
    second = book(api, parent, clinic, pet, slot_at(2, 11)).json()
    url = f"{BOOKINGS}/{first['id']}"

    early = api.post(f"{url}/check-in", headers=operator)
    assert early.status_code == 409
    assert early.json()["error"]["code"] == "action_not_allowed"

    at(monkeypatch, parse(first["start_at"]) - timedelta(minutes=30))
    assert api.post(f"{url}/complete", headers=operator).status_code == 409
    checked = api.post(f"{url}/check-in", headers=operator).json()
    assert checked["status"] == "in_progress"
    assert checked["allowed_actions"] == ["complete"]
    assert api.post(f"{url}/check-in", headers=parent).status_code == 409  # not the owner's call
    done = api.post(f"{url}/complete", headers=operator).json()
    assert done["status"] == "completed"
    assert [e["event"] for e in done["events"]] == ["created", "checked_in", "completed"]
    assert done["events"][1]["actor_role"] == "provider"

    # No-show only after a 15-minute grace period.
    url2 = f"{BOOKINGS}/{second['id']}"
    at(monkeypatch, parse(second["start_at"]) + timedelta(minutes=10))
    assert api.post(f"{url2}/no-show", headers=operator).status_code == 409
    at(monkeypatch, parse(second["start_at"]) + timedelta(minutes=20))
    assert api.post(f"{url2}/no-show", headers=operator).json()["status"] == "no_show"
    past = api.get(BOOKINGS, params={"scope": "past"}, headers=parent).json()["items"]
    assert {x["status"] for x in past} == {"completed", "no_show"}


# ---------------------------------------------------------------- idempotency


def test_idempotency_key(api: TestClient, parent: dict[str, str], clinic: dict[str, Any]) -> None:
    pet = add_pet(api, parent)
    start = slot_at(2, 9)
    body = {
        "listing_kind": "clinic",
        "listing_id": clinic["id"],
        "service_id": clinic["service_id"],
        "start_at": start,
        "pet_ids": [pet],
    }
    missing = api.post(BOOKINGS, json=body, headers=parent)
    assert missing.status_code == 400
    assert missing.json()["error"]["code"] == "idempotency_key_required"

    headers = {**parent, "Idempotency-Key": "booking-attempt-0001"}
    first = api.post(BOOKINGS, json=body, headers=headers)
    again = api.post(BOOKINGS, json=body, headers=headers)
    assert first.status_code == 201
    assert again.status_code == 200
    assert again.headers["Idempotent-Replayed"] == "true"
    assert again.json()["id"] == first.json()["id"]
    assert len(api.get(BOOKINGS, headers=parent).json()["items"]) == 1

    reused = api.post(BOOKINGS, json={**body, "start_at": slot_at(2, 9, 30)}, headers=headers)
    assert reused.status_code == 422
    assert reused.json()["error"]["code"] == "idempotency_key_reused"


# ---------------------------------------------------------------- capacity


def test_capacity_units(
    api: TestClient,
    operator: dict[str, str],
    otp_sender: RecordingOtpSender,
    db_engine: Engine,
) -> None:
    clinic = make_clinic(api, operator, db_engine, capacity=2)
    start = slot_at(3, 15)
    parents = [user(api, otp_sender, f"p{i}@example.com") for i in range(3)]
    results = [book(api, p, clinic, add_pet(api, p), start) for p in parents]
    assert [r.status_code for r in results] == [201, 201, 409]
    assert results[2].json()["error"]["code"] == "slot_unavailable"
    with db_engine.connect() as conn:
        units = conn.execute(text("SELECT capacity_unit FROM bookings ORDER BY 1")).scalars().all()
    assert units == [1, 2]

    # Cancelling frees a unit for the next parent.
    api.post(f"{BOOKINGS}/{results[0].json()['id']}/cancel", json={}, headers=parents[0])
    assert book(api, parents[2], clinic, add_pet(api, parents[2]), start).status_code == 201


def test_concurrent_requests_never_overbook(
    api: TestClient,
    operator: dict[str, str],
    otp_sender: RecordingOtpSender,
    db_engine: Engine,
) -> None:
    clinic = make_clinic(api, operator, db_engine, capacity=2)
    start = slot_at(4, 12)
    parents = [user(api, otp_sender, f"race{i}@example.com") for i in range(6)]
    pets = [add_pet(api, p) for p in parents]
    with ThreadPoolExecutor(max_workers=6) as pool:
        codes = list(
            pool.map(lambda i: book(api, parents[i], clinic, pets[i], start).status_code, range(6))
        )
    assert sorted(codes) == [201, 201, 409, 409, 409, 409]


def test_exclusion_constraint_is_the_last_line_of_defence(
    api: TestClient, parent: dict[str, str], clinic: dict[str, Any], db_engine: Engine
) -> None:
    book(api, parent, clinic, add_pet(api, parent), slot_at(2, 14))
    with pytest.raises(IntegrityError, match="ex_bookings_no_overlap"), db_engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO bookings (booking_type, owner_id, clinic_id, service_id, "
                "service_title, service_mode, confirmation_mode, amount_minor, "
                "cancellation_policy, status, start_at, end_at, timezone, resource_id, "
                "capacity_unit, payment_status, idempotency_key, request_hash) "
                "SELECT booking_type, owner_id, clinic_id, service_id, service_title, "
                "service_mode, confirmation_mode, amount_minor, cancellation_policy, status, "
                "start_at + interval '10 minutes', end_at, timezone, resource_id, "
                "capacity_unit, payment_status, 'another-key-123', request_hash FROM bookings"
            )
        )


# ---------------------------------------------------------------- validation


def test_booking_validation(
    api: TestClient,
    operator: dict[str, str],
    parent: dict[str, str],
    clinic: dict[str, Any],
    otp_sender: RecordingOtpSender,
    db_engine: Engine,
) -> None:
    pet = add_pet(api, parent)

    def code(response: Any) -> str:
        return str(response.json()["error"]["code"])

    # Not an open slot (off the 30-minute grid, or in the past).
    assert code(book(api, parent, clinic, pet, slot_at(2, 10, 10))) == "slot_unavailable"
    yesterday = (utcnow() - timedelta(days=1)).isoformat()
    assert code(book(api, parent, clinic, pet, yesterday)) == "slot_unavailable"
    # Someone else's pet, or a species the service doesn't take.
    other = user(api, otp_sender, "other@example.com")
    assert code(book(api, parent, clinic, add_pet(api, other), slot_at(2, 10))) == "pet_not_found"
    rabbit = add_pet(api, parent, "rabbit")
    assert code(book(api, parent, clinic, rabbit, slot_at(2, 10))) == "species_not_offered"
    # The provider can't book their own clinic.
    assert code(book(api, operator, clinic, add_pet(api, operator), slot_at(2, 10))) == (
        "own_listing"
    )
    # Unlisted clinics don't exist for parents.
    verify(db_engine, "clinics", clinic["id"], status="needs_info")
    assert book(api, parent, clinic, pet, slot_at(2, 10)).status_code == 404


# ---------------------------------------------------------------- request mode (home visits)


def vet_times(api: TestClient, headers: dict[str, str], listing: dict[str, Any]) -> list[str]:
    """Home visits are 45 minutes long, so take real slot starts (3 days ahead)."""
    times = open_times(api, headers, "vets", listing["id"], listing["service_id"], 3)
    return [t.replace("+00:00", "Z") for t in times]


def vet_listing(vet: dict[str, Any], api: TestClient) -> dict[str, Any]:
    services = api.get(
        f"/api/v1/manage/provider_profile/{vet['id']}/services", headers=vet["headers"]
    ).json()
    return {"id": vet["id"], "service_id": services[0]["id"]}


def test_request_mode_confirm_and_address_privacy(
    api: TestClient, parent: dict[str, str], vet: dict[str, Any]
) -> None:
    listing = vet_listing(vet, api)
    pet = add_pet(api, parent)
    start = vet_times(api, parent, listing)[14]
    no_address = book(api, parent, listing, pet, start, listing_kind="vet")
    assert no_address.json()["error"]["code"] == "address_required"

    created = book(
        api, parent, listing, pet, start, listing_kind="vet", visit_address="4, Beach Road, Adyar"
    )
    assert created.status_code == 201, created.text
    b = created.json()
    assert b["status"] == "pending_provider"
    assert b["payment_status"] == "not_due"  # never charged before the provider confirms
    deadline = parse(b["response_deadline"])
    assert deadline - utcnow() <= timedelta(hours=2, seconds=5)
    assert b["allowed_actions"] == ["cancel", "reschedule"]

    url = f"{BOOKINGS}/{b['id']}"
    as_vet = api.get(url, headers=vet["headers"]).json()
    assert as_vet["visit_address"] is None  # hidden until confirmed
    assert as_vet["allowed_actions"] == ["confirm", "decline"]
    requests = api.get(
        f"/api/v1/manage/provider_profile/{vet['id']}/bookings",
        params={"scope": "requests"},
        headers=vet["headers"],
    ).json()["items"]
    assert [r["id"] for r in requests] == [b["id"]]
    upcoming = api.get(
        f"/api/v1/manage/provider_profile/{vet['id']}/bookings", headers=vet["headers"]
    ).json()["items"]
    assert upcoming == []  # requests aren't on the calendar until confirmed

    assert api.post(f"{url}/confirm", headers=parent).status_code == 409
    confirmed = api.post(f"{url}/confirm", headers=vet["headers"]).json()
    assert confirmed["status"] == "confirmed"
    assert confirmed["visit_address"] == "4, Beach Road, Adyar"
    assert confirmed["payment_status"] == "unpaid"
    assert [e["event"] for e in confirmed["events"]] == ["created", "confirmed"]


def test_request_decline_and_expiry(
    api: TestClient, parent: dict[str, str], vet: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    listing = vet_listing(vet, api)
    pet = add_pet(api, parent)
    extra = {"listing_kind": "vet", "visit_address": "4, Beach Road"}
    times = vet_times(api, parent, listing)
    declined = book(api, parent, listing, pet, times[14], **extra).json()
    declined_out = api.post(
        f"{BOOKINGS}/{declined['id']}/decline",
        json={"reason": "Not visiting Adyar that day"},
        headers=vet["headers"],
    ).json()
    assert declined_out["status"] == "declined"
    assert declined_out["cancel_reason"] == "Not visiting Adyar that day"

    waiting = book(api, parent, listing, pet, times[15], **extra).json()
    at(monkeypatch, parse(waiting["response_deadline"]) + timedelta(minutes=1))
    expired = api.get(f"{BOOKINGS}/{waiting['id']}", headers=parent).json()
    assert expired["status"] == "expired"
    assert expired["events"][-1]["actor_role"] == "system"
    late = api.post(f"{BOOKINGS}/{waiting['id']}/confirm", headers=vet["headers"])
    assert late.json()["error"]["code"] == "request_expired"


def test_expiry_job_releases_slots(
    api: TestClient, parent: dict[str, str], vet: dict[str, Any], db_engine: Engine
) -> None:
    from app.jobs.expire_bookings import run

    listing = vet_listing(vet, api)
    start = vet_times(api, parent, listing)[16]
    b = book(
        api, parent, listing, add_pet(api, parent), start, listing_kind="vet", visit_address="x"
    ).json()
    with db_engine.begin() as conn:
        conn.execute(text("UPDATE bookings SET response_deadline = now() - interval '1 minute'"))
    assert run(db_engine) == 1
    assert run(db_engine) == 0
    assert api.get(f"{BOOKINGS}/{b['id']}", headers=parent).json()["status"] == "expired"
    times = open_times(api, parent, "vets", vet["id"], listing["service_id"], 3)
    assert start in [s.replace("+00:00", "Z") for s in times]


# ---------------------------------------------------------------- cancellation policy & payments


def test_free_cancellation_refunds_a_mock_payment(
    api: TestClient, parent: dict[str, str], clinic: dict[str, Any]
) -> None:
    b = book(api, parent, clinic, add_pet(api, parent), slot_at(2, 16)).json()
    url = f"{BOOKINGS}/{b['id']}"
    paid = api.post(f"{url}/payment", json={"method": "pay_now"}, headers=parent).json()
    assert paid["payment_status"] == "paid"
    assert paid["payments"][0]["provider"] == "mock"
    assert paid["payments"][0]["reference"].startswith("mock_charge_")
    assert "pay" not in paid["allowed_actions"]
    assert api.post(f"{url}/payment", json={"method": "pay_now"}, headers=parent).status_code == 409

    cancelled = api.post(f"{url}/cancel", json={}, headers=parent).json()
    assert cancelled["status"] == "cancelled_by_owner"
    assert cancelled["cancellation_outcome"] == "full_refund"
    assert cancelled["payment_status"] == "refunded"
    assert [p["kind"] for p in cancelled["payments"]] == ["charge", "refund"]
    assert cancelled["events"][-1]["details"] == {"outcome": "full_refund", "late": False}


def test_late_cancellation_and_reschedule_cutoff(
    api: TestClient, parent: dict[str, str], clinic: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    pet = add_pet(api, parent)
    b = book(api, parent, clinic, pet, slot_at(2, 17)).json()
    url = f"{BOOKINGS}/{b['id']}"
    api.post(f"{url}/payment", json={"method": "pay_now"}, headers=parent)

    at(monkeypatch, parse(b["start_at"]) - timedelta(hours=1))
    detail = api.get(url, headers=parent).json()
    assert "reschedule" not in detail["allowed_actions"]
    moved = api.post(f"{url}/reschedule", json={"start_at": slot_at(2, 18)}, headers=parent)
    assert moved.json()["error"]["code"] == "reschedule_too_late"
    late = api.post(f"{url}/cancel", json={}, headers=parent).json()
    assert late["cancellation_outcome"] == "late_no_refund"
    assert late["payment_status"] == "not_refunded"
    assert [p["kind"] for p in late["payments"]] == ["charge"]

    # Pay at the visit: a late cancellation has nothing to refund either way.
    other = book(api, parent, clinic, pet, slot_at(2, 19)).json()
    at(monkeypatch, utcnow())
    chosen = api.post(
        f"{BOOKINGS}/{other['id']}/payment", json={"method": "pay_at_visit"}, headers=parent
    ).json()
    assert chosen["payment_status"] == "pay_at_visit"
    assert chosen["allowed_actions"] == ["cancel", "reschedule", "pay"]


def test_provider_and_admin_cancellations_need_a_reason(
    api: TestClient,
    operator: dict[str, str],
    parent: dict[str, str],
    clinic: dict[str, Any],
    otp_sender: RecordingOtpSender,
    db_engine: Engine,
) -> None:
    pet = add_pet(api, parent)
    first = book(api, parent, clinic, pet, slot_at(2, 8)).json()
    url = f"{BOOKINGS}/{first['id']}"
    api.post(f"{url}/payment", json={"method": "pay_now"}, headers=parent)
    no_reason = api.post(f"{url}/cancel", json={}, headers=operator)
    assert no_reason.json()["error"]["code"] == "reason_required"
    out = api.post(f"{url}/cancel", json={"reason": "Vet unwell"}, headers=operator).json()
    assert out["status"] == "cancelled_by_provider"
    assert out["cancellation_outcome"] == "full_refund"
    assert out["payment_status"] == "refunded"

    admin = user(api, otp_sender, ADMIN_EMAIL)
    second = book(api, parent, clinic, pet, slot_at(2, 9)).json()
    as_admin = api.get(f"{BOOKINGS}/{second['id']}", headers=admin).json()
    assert as_admin["viewer_role"] == "admin"
    assert as_admin["allowed_actions"] == ["cancel"]
    done = api.post(
        f"{BOOKINGS}/{second['id']}/cancel", json={"reason": "Duplicate"}, headers=admin
    ).json()
    assert done["status"] == "cancelled_by_admin"
    assert done["cancellation_outcome"] == "not_charged"
    with db_engine.connect() as conn:
        actions = conn.execute(text("SELECT action FROM audit_logs")).scalars().all()
    assert "booking.cancelled_by_admin" in actions


def test_reschedule_instant_and_request(
    api: TestClient, parent: dict[str, str], clinic: dict[str, Any], vet: dict[str, Any]
) -> None:
    pet = add_pet(api, parent)
    b = book(api, parent, clinic, pet, slot_at(2, 10)).json()
    moved = api.post(
        f"{BOOKINGS}/{b['id']}/reschedule", json={"start_at": slot_at(2, 12)}, headers=parent
    ).json()
    assert moved["status"] == "confirmed"
    assert parse(moved["start_at"]) == parse(slot_at(2, 12))
    assert moved["events"][-1]["event"] == "rescheduled"
    # The old time is free again; the new one is taken.
    times = [
        s.replace("+00:00", "Z")
        for s in open_times(api, parent, "clinics", clinic["id"], clinic["service_id"], 2)
    ]
    assert slot_at(2, 10) in times
    assert slot_at(2, 12) not in times

    listing = vet_listing(vet, api)
    times = vet_times(api, parent, listing)
    r = book(api, parent, listing, pet, times[14], listing_kind="vet", visit_address="x").json()
    api.post(f"{BOOKINGS}/{r['id']}/confirm", headers=vet["headers"])
    again = api.post(
        f"{BOOKINGS}/{r['id']}/reschedule", json={"start_at": times[18]}, headers=parent
    ).json()
    assert again["status"] == "pending_provider"  # a new time needs the vet's OK again
    assert again["events"][-1]["from_status"] == "confirmed"
    assert again["response_deadline"] is not None


def test_owner_can_reschedule_into_its_own_slot_range(
    api: TestClient, parent: dict[str, str], clinic: dict[str, Any]
) -> None:
    pet = add_pet(api, parent)
    b = book(api, parent, clinic, pet, slot_at(2, 10)).json()
    # Moving by 30 minutes overlaps nothing but itself (capacity 1).
    moved = api.post(
        f"{BOOKINGS}/{b['id']}/reschedule", json={"start_at": slot_at(2, 10, 30)}, headers=parent
    )
    assert moved.status_code == 200, moved.text


def test_provider_inbox_persists_expiry(
    api: TestClient,
    parent: dict[str, str],
    vet: dict[str, Any],
    db_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    listing = vet_listing(vet, api)
    b = book(
        api,
        parent,
        listing,
        add_pet(api, parent),
        vet_times(api, parent, listing)[14],
        listing_kind="vet",
        visit_address="x",
    ).json()
    at(monkeypatch, parse(b["response_deadline"]) + timedelta(minutes=5))
    inbox = api.get(
        f"/api/v1/manage/provider_profile/{vet['id']}/bookings",
        params={"scope": "requests"},
        headers=vet["headers"],
    ).json()["items"]
    assert inbox == []
    with db_engine.connect() as conn:
        assert conn.execute(text("SELECT status FROM bookings")).scalar_one() == "expired"


def test_edge_cases(
    api: TestClient,
    operator: dict[str, str],
    parent: dict[str, str],
    clinic: dict[str, Any],
    vet: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pet = add_pet(api, parent)
    assert api.get(f"{BOOKINGS}/{uuid.uuid4()}", headers=parent).status_code == 404
    far = book(api, parent, clinic, pet, slot_at(70, 10))
    assert far.json()["error"]["code"] == "invalid_date"

    # A pending request cancelled by the parent was never charged.
    listing = vet_listing(vet, api)
    r = book(
        api,
        parent,
        listing,
        pet,
        vet_times(api, parent, listing)[14],
        listing_kind="vet",
        visit_address="x",
    ).json()
    out = api.post(f"{BOOKINGS}/{r['id']}/cancel", json={}, headers=parent).json()
    assert out["cancellation_outcome"] == "not_charged"
    assert api.post(f"{BOOKINGS}/{r['id']}/cancel", json={}, headers=parent).status_code == 409

    # An archived service can't be booked or rebooked.
    b = book(api, parent, clinic, pet, slot_at(2, 10)).json()
    base = f"/api/v1/manage/clinic/{clinic['id']}/services/{clinic['service_id']}"
    assert api.delete(base, headers=operator).status_code == 204
    gone = book(api, parent, clinic, pet, slot_at(2, 11))
    assert gone.json()["error"]["code"] == "service_unavailable"
    moved = api.post(
        f"{BOOKINGS}/{b['id']}/reschedule", json={"start_at": slot_at(2, 12)}, headers=parent
    )
    assert moved.json()["error"]["code"] == "service_unavailable"


def test_active_booking_limit(
    api: TestClient,
    parent: dict[str, str],
    clinic: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.modules.bookings.policy.MAX_ACTIVE_BOOKINGS_PER_OWNER", 2)
    pet = add_pet(api, parent)
    assert book(api, parent, clinic, pet, slot_at(2, 10)).status_code == 201
    assert book(api, parent, clinic, pet, slot_at(2, 11)).status_code == 201
    third = book(api, parent, clinic, pet, slot_at(2, 12))
    assert third.json()["error"]["code"] == "too_many_bookings"
