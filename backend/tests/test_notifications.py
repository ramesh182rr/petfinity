"""Notifications, push delivery and reminders (milestone 2.9, decision 0013)."""

from __future__ import annotations

import json
from datetime import timedelta
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text
from sqlalchemy.orm import Session

from app.modules.auth.otp_delivery import RecordingOtpSender
from app.modules.notifications.bookings import queue_reminders
from app.modules.notifications.push import (
    ExpoPushSender,
    LogPushSender,
    PushMessage,
    PushResult,
)
from app.modules.notifications.service import deliver_pending
from tests.test_bookings_api import add_pet, at, book, parse, slot_at, user, vet_listing, vet_times
from tests.test_bookings_api import api_settings_overrides as api_settings_overrides
from tests.test_bookings_api import clinic as clinic
from tests.test_bookings_api import operator as operator
from tests.test_bookings_api import parent as parent
from tests.test_bookings_api import vet as vet

NOTES = "/api/v1/notifications"
DEVICES = "/api/v1/me/push-devices"
TOKEN_VET = "ExponentPushToken[vet-device-1234567]"
TOKEN_PARENT = "ExponentPushToken[parent-device-123456]"


def inbox(api: TestClient, headers: dict[str, str]) -> dict[str, Any]:
    body: dict[str, Any] = api.get(NOTES, headers=headers).json()
    return body


def pushes(api: TestClient) -> list[PushMessage]:
    sender: LogPushSender = api.app.state.push_sender  # type: ignore[attr-defined]
    return sender.sent


def request_visit(
    api: TestClient, parent: dict[str, str], vet: dict[str, Any], index: int = 14
) -> dict[str, Any]:
    listing = vet_listing(vet, api)
    body: dict[str, Any] = book(
        api,
        parent,
        listing,
        add_pet(api, parent),
        vet_times(api, parent, listing)[index],
        listing_kind="vet",
        visit_address="4, Beach Road",
    ).json()
    return body


def test_request_and_confirm_notify_the_other_side(
    api: TestClient, parent: dict[str, str], vet: dict[str, Any], otp_sender: RecordingOtpSender
) -> None:
    registered = api.post(
        DEVICES, json={"token": TOKEN_VET, "platform": "android"}, headers=vet["headers"]
    )
    assert registered.status_code == 204
    b = request_visit(api, parent, vet)

    vet_inbox = inbox(api, vet["headers"])
    assert vet_inbox["unread_count"] == 1
    note = vet_inbox["items"][0]
    assert note["kind"] == "booking_request"
    assert note["title"].startswith("New request: Pet-dog")
    assert "Reply by" in note["body"]
    assert "Beach Road" not in json.dumps(note)  # never the home address
    assert note["data"] == {"route": f"/provider/booking/{b['id']}", "booking_id": b["id"]}
    assert inbox(api, parent)["items"] == []  # not told about their own action

    # Pushed right after the response, to the registered device only.
    sent = pushes(api)
    assert [m.token for m in sent] == [TOKEN_VET]
    assert sent[0].data["notification_id"] == note["id"]

    api.post(f"/api/v1/bookings/{b['id']}/confirm", headers=vet["headers"])
    parent_inbox = inbox(api, parent)
    assert [n["kind"] for n in parent_inbox["items"]] == ["booking_confirmed"]
    assert parent_inbox["items"][0]["data"]["route"] == f"/bookings/{b['id']}"
    assert len(pushes(api)) == 1  # the parent has no device: stored, not pushed

    # Read state.
    one = api.post(f"{NOTES}/{note['id']}/read", headers=vet["headers"]).json()
    assert one["read_at"] is not None
    assert api.get(f"{NOTES}/unread-count", headers=vet["headers"]).json() == {"unread_count": 0}
    stranger = user(api, otp_sender, "nosy@example.com")
    assert api.post(f"{NOTES}/{note['id']}/read", headers=stranger).status_code == 404
    assert api.post(f"{NOTES}/read-all", headers=parent).json() == {"unread_count": 0}
    assert inbox(api, parent)["unread_count"] == 0


def test_clinic_operators_and_cancellation_messages(
    api: TestClient,
    operator: dict[str, str],
    parent: dict[str, str],
    clinic: dict[str, Any],
) -> None:
    pet = add_pet(api, parent)
    first = book(api, parent, clinic, pet, slot_at(2, 10)).json()
    assert inbox(api, operator)["items"][0]["kind"] == "booking_new"

    api.post(f"/api/v1/bookings/{first['id']}/payment", json={"method": "pay_now"}, headers=parent)
    api.post(
        f"/api/v1/bookings/{first['id']}/cancel", json={"reason": "Vet unwell"}, headers=operator
    )
    cancelled = inbox(api, parent)["items"][0]
    assert cancelled["kind"] == "booking_cancelled"
    assert "“Vet unwell”" in cancelled["body"]
    assert "refunded in full" in cancelled["body"]

    second = book(api, parent, clinic, pet, slot_at(2, 11)).json()
    api.post(f"/api/v1/bookings/{second['id']}/cancel", json={}, headers=parent)
    kinds = sorted(n["kind"] for n in inbox(api, operator)["items"])
    assert kinds == ["booking_cancelled", "booking_new", "booking_new"]
    parent_cancels = [n for n in inbox(api, parent)["items"] if n["kind"] == "booking_cancelled"]
    assert len(parent_cancels) == 1  # not told about their own cancellation


def test_expiry_and_decline_tell_the_parent(
    api: TestClient, parent: dict[str, str], vet: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    declined = request_visit(api, parent, vet)
    api.post(
        f"/api/v1/bookings/{declined['id']}/decline",
        json={"reason": "Fully booked"},
        headers=vet["headers"],
    )
    assert "“Fully booked”" in inbox(api, parent)["items"][0]["body"]

    waiting = request_visit(api, parent, vet, index=16)
    at(monkeypatch, parse(waiting["response_deadline"]) + timedelta(minutes=1))
    api.get(f"/api/v1/bookings/{waiting['id']}", headers=parent)
    assert inbox(api, parent)["items"][0]["kind"] == "booking_expired"
    vet_kinds = {n["kind"] for n in inbox(api, vet["headers"])["items"]}
    assert "booking_expired" in vet_kinds


def test_reminders_are_sent_once_per_window(
    api: TestClient, parent: dict[str, str], clinic: dict[str, Any], db_engine: Engine
) -> None:
    b = book(api, parent, clinic, add_pet(api, parent), slot_at(2, 10)).json()
    start = parse(b["start_at"])
    with Session(db_engine) as db, db.begin():
        db.execute(
            text("UPDATE bookings SET created_at = now() - interval '3 days' WHERE id = :id"),
            {"id": b["id"]},
        )
        assert queue_reminders(db, start - timedelta(hours=30)) == 0  # too early
        assert queue_reminders(db, start - timedelta(hours=23)) == 1
        assert queue_reminders(db, start - timedelta(hours=22)) == 0  # already sent
        assert queue_reminders(db, start - timedelta(minutes=90)) == 1
        assert queue_reminders(db, start - timedelta(minutes=60)) == 0
    by_kind = {n["kind"]: n for n in inbox(api, parent)["items"]}
    assert set(by_kind) == {"reminder_2h", "reminder_24h"}
    assert by_kind["reminder_2h"]["title"] == "In 2 hours: Consultation"
    reminder = by_kind["reminder_24h"]
    assert reminder["title"] == "Reminder: Consultation tomorrow"
    assert "Free cancellation until" in reminder["body"]

    # Booked inside the 24 h window: no "tomorrow" reminder, only the 2 h one.
    late = book(api, parent, clinic, add_pet(api, parent), slot_at(1, 9)).json()
    late_start = parse(late["start_at"])
    with Session(db_engine) as db, db.begin():
        db.execute(
            text("UPDATE bookings SET created_at = :at WHERE id = :id"),
            {"at": late_start - timedelta(hours=20), "id": late["id"]},
        )
        assert queue_reminders(db, late_start - timedelta(hours=19)) == 0
        # Cancelled bookings get no reminders.
        db.execute(
            text("UPDATE bookings SET status = 'cancelled_by_owner' WHERE id = :id"),
            {"id": b["id"]},
        )
        assert queue_reminders(db, late_start - timedelta(hours=1)) == 1


def test_job_delivers_pending_and_skips_stale(
    api: TestClient, parent: dict[str, str], clinic: dict[str, Any], db_engine: Engine
) -> None:
    from app.jobs.notifications import run

    api.post(DEVICES, json={"token": TOKEN_PARENT, "platform": "ios"}, headers=parent)
    book(api, parent, clinic, add_pet(api, parent), slot_at(2, 10))
    with db_engine.begin() as conn:
        # The operator's "new appointment" push is pending but 7 hours old: too stale to send.
        conn.execute(
            text(
                "UPDATE notifications SET created_at = now() - interval '7 hours', "
                "push_status = 'pending'"
            )
        )
        # Move the visit to tomorrow, booked days ago: due for the day-before reminder.
        conn.execute(
            text(
                "UPDATE bookings SET created_at = now() - interval '3 days', "
                "start_at = now() + interval '20 hours', "
                "end_at = now() + interval '20 hours 30 minutes'"
            )
        )
    sender = LogPushSender()
    queued, sent = run(db_engine, sender)
    assert (queued, sent) == (1, 1)
    assert [m.token for m in sender.sent] == [TOKEN_PARENT]
    with db_engine.connect() as conn:
        rows = conn.execute(text("SELECT kind, push_status FROM notifications")).all()
    statuses: dict[str, str] = {kind: status for kind, status in rows}
    assert statuses == {"booking_new": "skipped", "reminder_24h": "sent"}


def test_push_devices(
    api: TestClient, parent: dict[str, str], otp_sender: RecordingOtpSender, db_engine: Engine
) -> None:
    bad = api.post(DEVICES, json={"token": "not-a-token", "platform": "android"}, headers=parent)
    assert bad.status_code == 422
    body = {"token": TOKEN_PARENT, "platform": "android"}
    assert api.post(DEVICES, json=body, headers=parent).status_code == 204
    assert api.post(DEVICES, json=body, headers=parent).status_code == 204  # idempotent
    other = user(api, otp_sender, "second@example.com")
    api.post(DEVICES, json=body, headers=other)  # same phone, new account
    with db_engine.connect() as conn:
        owners = (
            conn.execute(
                text("SELECT u.email FROM push_devices d JOIN users u ON u.id = d.user_id")
            )
            .scalars()
            .all()
        )
    assert owners == ["second@example.com"]
    api.post(f"{DEVICES}/unregister", json={"token": TOKEN_PARENT}, headers=parent)  # not theirs
    with db_engine.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM push_devices")).scalar_one() == 1
    api.post(f"{DEVICES}/unregister", json={"token": TOKEN_PARENT}, headers=other)
    with db_engine.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM push_devices")).scalar_one() == 0


def test_notification_paging(api: TestClient, parent: dict[str, str], db_engine: Engine) -> None:
    with db_engine.begin() as conn:
        owner = conn.execute(
            text("SELECT id FROM users WHERE email = 'parent@example.com'")
        ).scalar_one()
        for i in range(5):
            conn.execute(
                text(
                    "INSERT INTO notifications (user_id, kind, title, body, data, push_status, "
                    "created_at) VALUES (:u, 'test', :t, 'b', '{}', 'skipped', "
                    "now() - make_interval(mins => :i))"
                ),
                {"u": owner, "t": f"n{i}", "i": i},
            )
    first = api.get(NOTES, params={"limit": 3}, headers=parent).json()
    assert [n["title"] for n in first["items"]] == ["n0", "n1", "n2"]
    assert first["unread_count"] == 5
    rest = api.get(NOTES, params={"limit": 3, "before": first["next_before"]}, headers=parent)
    assert [n["title"] for n in rest.json()["items"]] == ["n3", "n4"]
    assert rest.json()["next_before"] is None


def test_expo_sender_maps_tickets() -> None:
    seen: list[Any] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append((request.headers.get("authorization"), json.loads(request.content)))
        tickets = [
            {"status": "ok", "id": "t1"},
            {"status": "error", "message": "gone", "details": {"error": "DeviceNotRegistered"}},
        ]
        return httpx.Response(200, json={"data": tickets})

    sender = ExpoPushSender(
        "https://push.test/send", "secret", transport=httpx.MockTransport(handler)
    )
    results = sender.send(
        [PushMessage(TOKEN_VET, "t", "b", {"route": "/x"}), PushMessage(TOKEN_PARENT, "t", "b", {})]
    )
    assert [(r.ok, r.device_gone) for r in results] == [(True, False), (False, True)]
    auth, payload = seen[0]
    assert auth == "Bearer secret"
    assert payload[0]["channelId"] == "bookings"

    broken = ExpoPushSender(
        "https://push.test/send", None, transport=httpx.MockTransport(lambda _: httpx.Response(500))
    )
    assert broken.send([PushMessage(TOKEN_VET, "t", "b", {})])[0].error == "request_failed"


def test_device_not_registered_disables_the_device(
    api: TestClient,
    parent: dict[str, str],
    clinic: dict[str, Any],
    operator: dict[str, str],
    db_engine: Engine,
) -> None:
    class Gone:
        def send(self, messages: list[PushMessage]) -> list[PushResult]:
            return [
                PushResult(ok=False, device_gone=True, error="DeviceNotRegistered")
                for _ in messages
            ]

    api.post(DEVICES, json={"token": TOKEN_VET, "platform": "android"}, headers=operator)
    api.app.state.push_sender = Gone()  # type: ignore[attr-defined]
    book(api, parent, clinic, add_pet(api, parent), slot_at(2, 10))
    with db_engine.connect() as conn:
        assert conn.execute(text("SELECT disabled_at IS NOT NULL FROM push_devices")).scalar_one()
    with Session(db_engine) as db, db.begin():
        assert deliver_pending(db, Gone()) == 0  # disabled devices aren't tried again
