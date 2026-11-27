"""Reviews, reports, replies and moderation (milestone 2.10, decision 0014)."""

from __future__ import annotations

import json
from datetime import timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from app.modules.auth.otp_delivery import RecordingOtpSender
from app.modules.reviews.screening import flag_reason
from tests.test_bookings_api import ADMIN_EMAIL, add_pet, at, book, parse, slot_at, user
from tests.test_bookings_api import api_settings_overrides as api_settings_overrides
from tests.test_bookings_api import clinic as clinic
from tests.test_bookings_api import operator as operator
from tests.test_bookings_api import parent as parent

BOOKINGS = "/api/v1/bookings"
REVIEWS = "/api/v1/reviews"
ADMIN = "/api/v1/admin/reviews"


def name(engine: Engine, email: str, display: str) -> None:
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE users SET display_name = :n WHERE email = :e"), {"n": display, "e": email}
        )


def completed_visit(
    api: TestClient,
    parent: dict[str, str],
    operator: dict[str, str],
    clinic: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
    *,
    hour: int = 10,
) -> dict[str, Any]:
    b: dict[str, Any] = book(api, parent, clinic, add_pet(api, parent), slot_at(2, hour)).json()
    at(monkeypatch, parse(b["start_at"]) - timedelta(minutes=30))
    api.post(f"{BOOKINGS}/{b['id']}/check-in", headers=operator)
    done: dict[str, Any] = api.post(f"{BOOKINGS}/{b['id']}/complete", headers=operator).json()
    return done


def public(api: TestClient, headers: dict[str, str], clinic_id: str) -> dict[str, Any]:
    body: dict[str, Any] = api.get(
        f"/api/v1/discover/clinics/{clinic_id}/reviews", headers=headers
    ).json()
    return body


def test_review_a_completed_visit(
    api: TestClient,
    operator: dict[str, str],
    parent: dict[str, str],
    clinic: dict[str, Any],
    db_engine: Engine,
    otp_sender: RecordingOtpSender,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    name(db_engine, "parent@example.com", "Arun Kumar")
    b = completed_visit(api, parent, operator, clinic, monkeypatch)
    assert "review" in api.get(f"{BOOKINGS}/{b['id']}", headers=parent).json()["allowed_actions"]
    assert (
        "review" not in api.get(f"{BOOKINGS}/{b['id']}", headers=operator).json()["allowed_actions"]
    )

    created = api.post(
        f"{BOOKINGS}/{b['id']}/review",
        json={"rating": 5, "text": "  Gentle and thorough with Bruno. "},
        headers=parent,
    )
    assert created.status_code == 201, created.text
    mine = created.json()
    assert mine["status"] == "published"
    assert mine["text"] == "Gentle and thorough with Bruno."
    assert mine["can_edit"] is True
    assert parse(mine["edit_until"]) == parse(b["end_at"]) + timedelta(days=30)

    again = api.get(f"{BOOKINGS}/{b['id']}", headers=parent).json()
    assert again["review"]["id"] == mine["id"]
    assert "review" not in again["allowed_actions"]
    listed = api.get(BOOKINGS, params={"scope": "past"}, headers=parent).json()["items"]
    assert listed[0]["review"]["rating"] == 5

    # Public view: a short name, the species, never the account.
    stranger = user(api, otp_sender, "someone@example.com")
    page = public(api, stranger, clinic["id"])
    assert page["summary"] == {"rating": 5.0, "review_count": 1}
    item = page["items"][0]
    assert item["author_name"] == "Arun K."
    assert item["pets"] == "Dog"
    assert item["service_title"] == "Consultation"
    assert item["is_mine"] is False
    assert public(api, parent, clinic["id"])["items"][0]["is_mine"] is True
    assert "parent@example.com" not in json.dumps(page)

    detail = api.get(f"/api/v1/discover/clinics/{clinic['id']}", headers=stranger).json()
    assert (detail["rating"], detail["review_count"]) == (5.0, 1)
    assert [r["id"] for r in detail["recent_reviews"]] == [mine["id"]]
    search = api.get("/api/v1/discover/search", params={"area": "chennai"}, headers=stranger).json()
    assert (search["items"][0]["rating"], search["items"][0]["review_count"]) == (5.0, 1)

    # The clinic hears about it.
    notes = api.get("/api/v1/notifications", headers=operator).json()["items"]
    review_note = next(n for n in notes if n["kind"] == "review_new")
    assert review_note["title"].startswith("New 5-star review")
    assert review_note["data"]["route"] == f"/provider/manage/clinic/{clinic['id']}/reviews"

    # Edits within the window.
    edited = api.patch(f"{REVIEWS}/{mine['id']}", json={"rating": 4}, headers=parent).json()
    assert (edited["rating"], edited["edited"], edited["text"]) == (
        4,
        True,
        "Gentle and thorough with Bruno.",
    )
    assert public(api, stranger, clinic["id"])["summary"]["rating"] == 4.0


def test_who_can_review_and_when(
    api: TestClient,
    operator: dict[str, str],
    parent: dict[str, str],
    clinic: dict[str, Any],
    otp_sender: RecordingOtpSender,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    upcoming = book(api, parent, clinic, add_pet(api, parent), slot_at(3, 9)).json()
    early = api.post(f"{BOOKINGS}/{upcoming['id']}/review", json={"rating": 5}, headers=parent)
    assert early.json()["error"]["code"] == "not_reviewable"

    b = completed_visit(api, parent, operator, clinic, monkeypatch)
    other = user(api, otp_sender, "other@example.com")
    url = f"{BOOKINGS}/{b['id']}/review"
    assert api.post(url, json={"rating": 5}, headers=other).status_code == 404
    assert api.post(url, json={"rating": 0}, headers=parent).status_code == 422
    assert api.get(url, headers=parent).status_code == 404  # none yet

    at(monkeypatch, parse(b["end_at"]) + timedelta(days=31))
    closed = api.post(url, json={"rating": 5}, headers=parent)
    assert closed.json()["error"]["code"] == "review_window_closed"
    detail = api.get(f"{BOOKINGS}/{b['id']}", headers=parent).json()
    assert "review" not in detail["allowed_actions"]

    at(monkeypatch, parse(b["end_at"]) + timedelta(days=1))
    mine = api.post(url, json={"rating": 3}, headers=parent).json()
    assert mine["text"] is None  # rating-only is fine
    assert api.post(url, json={"rating": 5}, headers=parent).json()["error"]["code"] == (
        "already_reviewed"
    )
    assert api.get(url, headers=parent).json()["id"] == mine["id"]
    at(monkeypatch, parse(b["end_at"]) + timedelta(days=31))
    late_edit = api.patch(f"{REVIEWS}/{mine['id']}", json={"rating": 1}, headers=parent)
    assert late_edit.json()["error"]["code"] == "review_window_closed"
    assert api.patch(f"{REVIEWS}/{mine['id']}", json={"rating": 1}, headers=other).status_code == (
        404
    )


def test_screening_holds_and_edits_release(
    api: TestClient,
    operator: dict[str, str],
    parent: dict[str, str],
    clinic: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    b = completed_visit(api, parent, operator, clinic, monkeypatch)
    held = api.post(
        f"{BOOKINGS}/{b['id']}/review",
        json={"rating": 2, "text": "Call me on 98765 43210 for details"},
        headers=parent,
    ).json()
    assert held["status"] == "pending"
    assert "phone numbers" in held["status_note"]
    assert public(api, parent, clinic["id"])["items"] == []
    provider_view = api.get(
        f"/api/v1/manage/clinic/{clinic['id']}/reviews", headers=operator
    ).json()
    assert [(r["status"], r["can_reply"]) for r in provider_view["items"]] == [("pending", False)]
    assert provider_view["summary"]["review_count"] == 0
    # Not announced while held.
    kinds = [n["kind"] for n in api.get("/api/v1/notifications", headers=operator).json()["items"]]
    assert "review_new" not in kinds

    fixed = api.patch(
        f"{REVIEWS}/{held['id']}", json={"text": "Waited a long time, but fine."}, headers=parent
    ).json()
    assert (fixed["status"], fixed["status_note"]) == ("published", None)
    assert len(public(api, parent, clinic["id"])["items"]) == 1
    kinds = [n["kind"] for n in api.get("/api/v1/notifications", headers=operator).json()["items"]]
    assert "review_new" in kinds


def test_reports_and_moderation(
    api: TestClient,
    operator: dict[str, str],
    parent: dict[str, str],
    clinic: dict[str, Any],
    otp_sender: RecordingOtpSender,
    db_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    b = completed_visit(api, parent, operator, clinic, monkeypatch)
    review = api.post(
        f"{BOOKINGS}/{b['id']}/review", json={"rating": 1, "text": "Rude staff."}, headers=parent
    ).json()
    report_url = f"{REVIEWS}/{review['id']}/report"
    own = api.post(report_url, json={"reason": "fake"}, headers=parent)
    assert own.json()["error"]["code"] == "own_review"
    assert api.post(report_url, json={"reason": "bad"}, headers=operator).status_code == 422
    assert (
        api.post(
            report_url, json={"reason": "fake", "note": "Never visited"}, headers=operator
        ).status_code
        == 204
    )
    assert api.post(report_url, json={"reason": "fake"}, headers=operator).status_code == 204
    assert public(api, parent, clinic["id"])["items"] == []
    mine = api.get(f"{BOOKINGS}/{b['id']}/review", headers=parent).json()
    assert mine["status_note"] == "Hidden while our team looks at a report."
    # Editing doesn't release a reported review.
    api.patch(f"{REVIEWS}/{review['id']}", json={"text": "Staff were rude."}, headers=parent)
    assert api.get(f"{BOOKINGS}/{b['id']}/review", headers=parent).json()["status"] == "pending"

    # Only moderators and admins.
    assert api.get(ADMIN, headers=parent).status_code == 403
    moderator = user(api, otp_sender, "mod@petfinity.in")
    with db_engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO staff_roles (user_id, role) "
                "SELECT id, 'moderator' FROM users WHERE email = 'mod@petfinity.in'"
            )
        )
    queue = api.get(ADMIN, headers=moderator).json()["items"]
    assert [q["id"] for q in queue] == [review["id"]]
    assert queue[0]["flag_reason"] == "reported"
    assert [(r["reason"], r["note"]) for r in queue[0]["reports"]] == [("fake", "Never visited")]
    assert queue[0]["listing_name"] == "Paws & Care Clinic"

    kept = api.post(f"{ADMIN}/{review['id']}/decision", json={"action": "keep"}, headers=moderator)
    assert kept.json()["items"] == []
    assert len(public(api, parent, clinic["id"])["items"]) == 1
    with db_engine.connect() as conn:
        open_reports = conn.execute(
            text("SELECT count(*) FROM review_reports WHERE resolved_at IS NULL")
        ).scalar_one()
    assert open_reports == 0

    admin = user(api, otp_sender, ADMIN_EMAIL)
    removed = api.post(
        f"{ADMIN}/{review['id']}/decision",
        json={"action": "remove", "note": "Personal attack on staff."},
        headers=admin,
    )
    assert removed.status_code == 200
    assert public(api, parent, clinic["id"])["items"] == []
    mine = api.get(f"{BOOKINGS}/{b['id']}/review", headers=parent).json()
    assert (mine["status"], mine["can_edit"], mine["status_note"]) == (
        "removed",
        False,
        "Personal attack on staff.",
    )
    assert (
        api.patch(f"{REVIEWS}/{review['id']}", json={"rating": 5}, headers=parent).status_code
        == 409
    )
    note = api.get("/api/v1/notifications", headers=parent).json()["items"][0]
    assert note["kind"] == "review_removed"
    again = api.post(f"{ADMIN}/{review['id']}/decision", json={"action": "remove"}, headers=admin)
    assert again.json()["error"]["code"] == "already_removed"
    with db_engine.connect() as conn:
        actions = conn.execute(text("SELECT action FROM audit_logs")).scalars().all()
    assert {"review.kept", "review.removed"} <= set(actions)


def test_provider_reply(
    api: TestClient,
    operator: dict[str, str],
    parent: dict[str, str],
    clinic: dict[str, Any],
    otp_sender: RecordingOtpSender,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    b = completed_visit(api, parent, operator, clinic, monkeypatch)
    review = api.post(f"{BOOKINGS}/{b['id']}/review", json={"rating": 4}, headers=parent).json()
    url = f"{REVIEWS}/{review['id']}/reply"
    stranger = user(api, otp_sender, "x@example.com")
    assert api.put(url, json={"text": "Thanks!"}, headers=stranger).status_code == 404
    blocked = api.put(url, json={"text": "Call 044 2345 6789 anytime"}, headers=operator)
    assert blocked.json()["error"]["code"] == "reply_not_allowed"
    replied = api.put(url, json={"text": "Thank you, see Bruno soon!"}, headers=operator).json()
    assert replied["reply"]["text"] == "Thank you, see Bruno soon!"
    api.put(url, json={"text": "Thank you! See Bruno soon."}, headers=operator)
    assert public(api, parent, clinic["id"])["items"][0]["reply"]["text"] == (
        "Thank you! See Bruno soon."
    )
    assert api.get(f"{BOOKINGS}/{b['id']}", headers=parent).json()["review"]["reply"] is not None
    replies = [
        n
        for n in api.get("/api/v1/notifications", headers=parent).json()["items"]
        if n["kind"] == "review_reply"
    ]
    assert len(replies) == 1  # editing the reply doesn't notify again
    assert replies[0]["title"] == "Paws & Care Clinic replied to your review"


def test_sort_by_rating(
    api: TestClient,
    operator: dict[str, str],
    parent: dict[str, str],
    clinic: dict[str, Any],
    db_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from tests.test_bookings_api import make_clinic

    other = make_clinic(api, operator, db_engine)
    with db_engine.begin() as conn:  # the unreviewed clinic is nearer
        conn.execute(
            text("UPDATE clinics SET latitude = 13.08, longitude = 80.27 WHERE id = :id"),
            {"id": other["id"]},
        )
    b = completed_visit(api, parent, operator, clinic, monkeypatch)
    api.post(f"{BOOKINGS}/{b['id']}/review", json={"rating": 5}, headers=parent)
    by_rating = api.get(
        "/api/v1/discover/search", params={"area": "chennai", "sort": "rating"}, headers=parent
    ).json()["items"]
    assert [i["id"] for i in by_rating] == [clinic["id"], other["id"]]
    by_distance = api.get(
        "/api/v1/discover/search", params={"area": "chennai"}, headers=parent
    ).json()["items"]
    assert by_distance[0]["id"] == other["id"]
    assert by_distance[0]["rating"] is None


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("Lovely clinic, very kind vets.", None),
        ("Call 9876543210", "contact_details"),
        ("whatsapp +91 98765 43210", "contact_details"),
        ("landline 044-23456789", "contact_details"),
        ("ring 044 2345 6789", "contact_details"),
        ("order 12345", None),
        ("mail me at a.b@gmail.com", "contact_details"),
        ("see www.example.com", "link"),
        ("https://x.y/z", "link"),
        ("these people are idiots? no, IDIOT", "language"),
        ("Paid ₹500 for 30 minutes on 12/11/2026", None),
        (None, None),
    ],
)
def test_screening(value: str | None, expected: str | None) -> None:
    assert flag_reason(value) == expected
