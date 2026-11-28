"""Applicant verification flow: private documents, checklist, submission (milestone 2.1)."""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from app.modules.auth.otp_delivery import RecordingOtpSender
from app.modules.storage.local import LocalStorage
from tests.conftest import bearer, sign_in
from tests.test_providers_clinics import CLINIC, CLINICS, PROFILES, VET

PDF = b"%PDF-1.7\n" + b"0" * 200
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 100


@pytest.fixture
def user(api: TestClient, otp_sender: RecordingOtpSender) -> dict[str, str]:
    return bearer(sign_in(api, otp_sender, "applicant@example.com")["access_token"])


@pytest.fixture
def vet(api: TestClient, user: dict[str, str]) -> dict[str, Any]:
    body: dict[str, Any] = api.post(PROFILES, json=VET, headers=user).json()
    return body


def base(subject_type: str, subject_id: str) -> str:
    return f"/api/v1/verification/{subject_type}/{subject_id}"


def add_document(
    api: TestClient, headers: dict[str, str], url: str, doc_type: str, data: bytes, ctype: str
) -> dict[str, Any]:
    ticket = api.post(
        f"{url}/documents/upload-url",
        json={"doc_type": doc_type, "content_type": ctype, "size_bytes": len(data)},
        headers=headers,
    )
    assert ticket.status_code == 201, ticket.text
    t = ticket.json()
    put = api.put(t["upload"]["url"], content=data, headers=t["upload"]["headers"])
    assert put.status_code == 204
    confirmed = api.post(
        f"{url}/documents", json={"media_id": t["media_id"], "doc_type": doc_type}, headers=headers
    )
    assert confirmed.status_code == 201, confirmed.text
    body: dict[str, Any] = confirmed.json()
    return body


def test_vet_verification_end_to_end(
    api: TestClient,
    user: dict[str, str],
    vet: dict[str, Any],
    db_engine: Engine,
    local_storage: LocalStorage,
) -> None:
    url = base("provider_profile", vet["id"])

    start = api.get(url, headers=user).json()
    assert start["verification_status"] == "draft"
    assert start["required_documents"] == ["identity", "vet_registration"]
    assert start["missing_documents"] == ["identity", "vet_registration"]
    assert start["missing_fields"] == []

    incomplete = api.post(f"{url}/submit", json={}, headers=user)
    assert incomplete.status_code == 422
    assert incomplete.json()["error"]["details"]["missing_documents"] == [
        "identity",
        "vet_registration",
    ]

    add_document(api, user, url, "identity", JPEG, "image/jpeg")
    doc = add_document(api, user, url, "vet_registration", PDF, "application/pdf")
    assert doc["content_type"] == "application/pdf"
    assert doc["submitted"] is False
    assert "url" not in str(doc)  # applicants never get document links back

    submitted = api.post(f"{url}/submit", json={"note": "Registered in 2016"}, headers=user)
    assert submitted.status_code == 201
    assert submitted.json()["status"] == "pending"

    after = api.get(url, headers=user).json()
    assert after["verification_status"] == "submitted"
    assert after["can_edit_documents"] is False
    assert all(d["submitted"] for d in after["documents"])
    assert after["latest_submission"]["status"] == "pending"

    # Locked while under review.
    assert api.post(f"{url}/submit", json={}, headers=user).status_code == 409
    locked = api.post(
        f"{url}/documents/upload-url",
        json={"doc_type": "other", "content_type": "application/pdf", "size_bytes": 10},
        headers=user,
    )
    assert locked.json()["error"]["code"] == "verification_locked"

    # Stored privately under a verification/ prefix; audit trail recorded.
    files = [
        p.relative_to(local_storage.root).as_posix()
        for p in local_storage.root.rglob("*")
        if p.is_file() and not p.name.endswith(".json")
    ]
    assert all(f.startswith(f"verification/provider_profile/{vet['id']}/") for f in files)
    with db_engine.connect() as conn:
        actions = set(conn.execute(text("SELECT action FROM audit_logs")).scalars())
    assert {"verification.document_added", "verification.submitted"} <= actions


def test_vet_needs_registration_details(
    api: TestClient, user: dict[str, str], otp_sender: RecordingOtpSender
) -> None:
    profile = api.post(
        PROFILES, json={"provider_type": "veterinarian", "display_name": "Dr. X"}, headers=user
    ).json()
    overview = api.get(base("provider_profile", profile["id"]), headers=user).json()
    assert overview["missing_fields"] == ["registration_number", "registration_council"]


def test_caretaker_and_clinic_requirements(api: TestClient, user: dict[str, str]) -> None:
    caretaker = api.post(
        PROFILES, json={"provider_type": "caretaker", "display_name": "Arun"}, headers=user
    ).json()
    clinic = api.post(CLINICS, json=CLINIC, headers=user).json()
    assert api.get(base("provider_profile", caretaker["id"]), headers=user).json()[
        "required_documents"
    ] == ["identity", "address_proof"]  # decision 0015
    assert api.get(base("clinic", clinic["id"]), headers=user).json()["required_documents"] == [
        "clinic_registration"
    ]


def test_documents_can_be_removed_before_submission(
    api: TestClient, user: dict[str, str], vet: dict[str, Any], local_storage: LocalStorage
) -> None:
    url = base("provider_profile", vet["id"])
    doc = add_document(api, user, url, "identity", JPEG, "image/jpeg")
    assert api.delete(f"{url}/documents/{doc['id']}", headers=user).status_code == 204
    assert api.get(url, headers=user).json()["documents"] == []
    assert [p for p in local_storage.root.rglob("*.jpg")] == []
    assert api.delete(f"{url}/documents/{doc['id']}", headers=user).status_code == 404


def test_rejects_wrong_types_and_fake_pdfs(
    api: TestClient, user: dict[str, str], vet: dict[str, Any]
) -> None:
    url = base("provider_profile", vet["id"])
    docx = api.post(
        f"{url}/documents/upload-url",
        json={"doc_type": "identity", "content_type": "application/msword", "size_bytes": 100},
        headers=user,
    )
    assert docx.status_code == 415
    big = api.post(
        f"{url}/documents/upload-url",
        json={"doc_type": "identity", "content_type": "application/pdf", "size_bytes": 20_000_000},
        headers=user,
    )
    assert big.status_code == 413

    fake = b"MZ\x90\x00 not really a pdf" + b"0" * 20
    ticket = api.post(
        f"{url}/documents/upload-url",
        json={"doc_type": "identity", "content_type": "application/pdf", "size_bytes": len(fake)},
        headers=user,
    ).json()
    api.put(ticket["upload"]["url"], content=fake, headers=ticket["upload"]["headers"])
    rejected = api.post(
        f"{url}/documents",
        json={"media_id": ticket["media_id"], "doc_type": "identity"},
        headers=user,
    )
    assert rejected.status_code == 422
    assert rejected.json()["error"]["code"] == "invalid_file"


def test_others_cannot_touch_your_verification(
    api: TestClient, user: dict[str, str], vet: dict[str, Any], otp_sender: RecordingOtpSender
) -> None:
    intruder = bearer(sign_in(api, otp_sender, "intruder@example.com")["access_token"])
    url = base("provider_profile", vet["id"])
    assert api.get(url, headers=intruder).status_code == 404
    assert api.post(f"{url}/submit", json={}, headers=intruder).status_code == 404
    assert (
        api.post(
            f"{url}/documents/upload-url",
            json={"doc_type": "identity", "content_type": "image/jpeg", "size_bytes": 10},
            headers=intruder,
        ).status_code
        == 404
    )

    # A pet-photo upload can't be passed off as a verification document.
    pet = api.post("/api/v1/pets", json={"name": "Rex", "species": "dog"}, headers=user).json()
    ticket = api.post(
        f"/api/v1/pets/{pet['id']}/photo/upload-url",
        json={"content_type": "image/jpeg", "size_bytes": len(JPEG)},
        headers=user,
    ).json()
    api.put(ticket["upload"]["url"], content=JPEG, headers=ticket["upload"]["headers"])
    misuse = api.post(
        f"{url}/documents",
        json={"media_id": ticket["media_id"], "doc_type": "identity"},
        headers=user,
    )
    assert misuse.status_code == 404


def test_unknown_subject_type_rejected(api: TestClient, user: dict[str, str]) -> None:
    response = api.get(
        "/api/v1/verification/pet/00000000-0000-0000-0000-000000000000", headers=user
    )
    assert response.status_code == 422
