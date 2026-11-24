"""Provider profiles, clinics and derived capabilities (milestone 2.1, decision 0006)."""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from app.modules.auth.otp_delivery import RecordingOtpSender
from tests.conftest import bearer, sign_in

PROFILES = "/api/v1/me/provider-profiles"
CLINICS = "/api/v1/clinics"
ME = "/api/v1/me"

VET = {
    "provider_type": "veterinarian",
    "display_name": "Dr. Priya Nair",
    "bio": "Small-animal vet, 8 years.",
    "years_experience": 8,
    "languages": ["tamil", "English", "Tamil"],
    "city": "Chennai",
    "registration_number": "TNSVC/1234",
    "registration_council": "Tamil Nadu State Veterinary Council",
    "qualifications": "B.V.Sc. & A.H.",
}
CLINIC = {
    "name": "Paws & Care Clinic",
    "phone": "044 2345 6789",
    "address_line1": "12, Lake View Road",
    "locality": "Adyar",
    "city": "Chennai",
    "state": "Tamil Nadu",
    "postal_code": "600020",
    "latitude": "13.006700",
    "longitude": "80.257500",
}


@pytest.fixture
def user(api: TestClient, otp_sender: RecordingOtpSender) -> dict[str, str]:
    return bearer(sign_in(api, otp_sender, "vet@example.com")["access_token"])


@pytest.fixture
def other(api: TestClient, otp_sender: RecordingOtpSender) -> dict[str, str]:
    return bearer(sign_in(api, otp_sender, "other@example.com")["access_token"])


def post(
    api: TestClient, url: str, body: dict[str, Any], headers: dict[str, str]
) -> dict[str, Any]:
    response = api.post(url, json=body, headers=headers)
    assert response.status_code == 201, response.text
    data: dict[str, Any] = response.json()
    return data


def test_become_a_vet(api: TestClient, user: dict[str, str]) -> None:
    profile = post(api, PROFILES, VET, user)
    assert profile["verification_status"] == "draft"
    assert profile["status"] == "active"
    assert profile["languages"] == ["Tamil", "English"]

    duplicate = api.post(PROFILES, json=VET, headers=user)
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "provider_profile_exists"

    caretaker = post(api, PROFILES, {"provider_type": "caretaker", "display_name": "Priya"}, user)
    assert caretaker["provider_type"] == "caretaker"

    me = api.get(ME, headers=user).json()
    assert me["capabilities"] == ["pet_parent", "caretaker", "veterinarian"]


@pytest.mark.parametrize(
    "override",
    [
        {"display_name": " "},
        {"provider_type": "groomer"},
        {"years_experience": 99},
        {"languages": ["x"]},
        {"verification_status": "verified"},  # can't self-verify
        {"status": "active"},
    ],
)
def test_profile_validation(
    api: TestClient, user: dict[str, str], override: dict[str, Any]
) -> None:
    assert api.post(PROFILES, json={**VET, **override}, headers=user).status_code == 422


def test_profiles_are_private_to_their_owner(
    api: TestClient, user: dict[str, str], other: dict[str, str]
) -> None:
    profile = post(api, PROFILES, VET, user)
    url = f"{PROFILES}/{profile['id']}"
    assert api.get(url, headers=other).status_code == 404
    assert api.patch(url, json={"bio": "hijack"}, headers=other).status_code == 404
    assert api.get(PROFILES, headers=other).json() == []


def test_changing_credentials_resets_verification(
    api: TestClient, user: dict[str, str], db_engine: Engine
) -> None:
    profile = post(api, PROFILES, VET, user)
    url = f"{PROFILES}/{profile['id']}"
    with db_engine.begin() as conn:
        conn.execute(
            text(
                "UPDATE provider_profiles SET verification_status = 'verified', verified_at = now()"
            )
        )

    bio = api.patch(url, json={"bio": "Now also treating birds."}, headers=user).json()
    assert bio["verification_status"] == "verified"  # non-credential edit keeps the badge

    changed = api.patch(url, json={"registration_number": "TNSVC/9999"}, headers=user).json()
    assert changed["verification_status"] == "draft"
    assert changed["verified_at"] is None

    with db_engine.begin() as conn:
        conn.execute(text("UPDATE provider_profiles SET verification_status = 'submitted'"))
    locked = api.patch(url, json={"qualifications": "M.V.Sc."}, headers=user)
    assert locked.status_code == 409
    assert locked.json()["error"]["code"] == "under_review"


def test_create_clinic_makes_you_operator(api: TestClient, user: dict[str, str]) -> None:
    clinic = post(api, CLINICS, CLINIC, user)
    assert clinic["phone"] == "+914423456789"
    assert clinic["my_roles"] == ["operator"]
    assert clinic["verification_status"] == "draft"
    assert clinic["timezone"] == "Asia/Kolkata"

    me = api.get(ME, headers=user).json()
    assert "clinic_operator" in me["capabilities"]
    assert [c["id"] for c in api.get("/api/v1/me/clinics", headers=user).json()] == [clinic["id"]]


def test_practising_at_your_clinic_needs_a_vet_profile(
    api: TestClient, user: dict[str, str]
) -> None:
    refused = api.post(CLINICS, json={**CLINIC, "practises_here": True}, headers=user)
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "veterinarian_profile_required"

    post(api, PROFILES, VET, user)
    clinic = post(api, CLINICS, {**CLINIC, "practises_here": True}, user)
    assert clinic["my_roles"] == ["operator", "veterinarian"]


@pytest.mark.parametrize(
    "override",
    [
        {"postal_code": "012345"},
        {"postal_code": "60002"},
        {"phone": "123"},
        {"email": "not-an-email"},
        {"latitude": "13.0", "longitude": None},
        {"latitude": "95.0", "longitude": "80.0"},
        {"name": ""},
    ],
)
def test_clinic_validation(api: TestClient, user: dict[str, str], override: dict[str, Any]) -> None:
    assert api.post(CLINICS, json={**CLINIC, **override}, headers=user).status_code == 422


def test_only_members_see_and_only_operators_edit(
    api: TestClient, user: dict[str, str], other: dict[str, str], db_engine: Engine
) -> None:
    clinic = post(api, CLINICS, CLINIC, user)
    url = f"{CLINICS}/{clinic['id']}"
    assert api.get(url, headers=other).status_code == 404
    assert api.patch(url, json={"name": "Mine now"}, headers=other).status_code == 404

    # A vet member (not operator) can view but not edit.
    other_id = api.get(ME, headers=other).json()["id"]
    with db_engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO clinic_members (clinic_id, user_id, member_role) "
                "VALUES (:c, :u, 'veterinarian')"
            ),
            {"c": clinic["id"], "u": other_id},
        )
    assert api.get(url, headers=other).json()["my_roles"] == ["veterinarian"]
    forbidden = api.patch(url, json={"name": "Mine now"}, headers=other)
    assert forbidden.status_code == 403

    updated = api.patch(url, json={"locality": "Besant Nagar", "email": "Hi@Paws.in"}, headers=user)
    assert updated.status_code == 200
    assert updated.json()["locality"] == "Besant Nagar"
    assert updated.json()["email"] == "hi@paws.in"
    assert api.patch(url, json={"city": None}, headers=user).status_code == 422


def test_renaming_a_verified_clinic_resets_verification(
    api: TestClient, user: dict[str, str], db_engine: Engine
) -> None:
    clinic = post(api, CLINICS, CLINIC, user)
    with db_engine.begin() as conn:
        conn.execute(
            text("UPDATE clinics SET verification_status = 'verified', verified_at = now()")
        )
    url = f"{CLINICS}/{clinic['id']}"
    assert (
        api.patch(url, json={"phone": "9876543210"}, headers=user).json()["verification_status"]
        == "verified"
    )
    renamed = api.patch(url, json={"name": "New Name Clinic"}, headers=user).json()
    assert renamed["verification_status"] == "draft"


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("044 2345 6789", "+914423456789"),
        ("080-41234567", "+918041234567"),
        ("9876543210", "+919876543210"),
        ("+91 98765 43210", "+919876543210"),
        ("+1 415 555 0100", "+14155550100"),
    ],
)
def test_contact_phone_accepts_landlines_and_mobiles(raw: str, expected: str) -> None:
    from app.modules.auth.identifiers import normalize_contact_phone

    assert normalize_contact_phone(raw) == expected


@pytest.mark.parametrize("raw", ["123", "0000000000", "+91 012345678", "04423456"])
def test_contact_phone_rejects_invalid(raw: str) -> None:
    from app.core.errors import AppError
    from app.modules.auth.identifiers import normalize_contact_phone

    with pytest.raises(AppError):
        normalize_contact_phone(raw)
