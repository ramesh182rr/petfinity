"""Pet profiles: validation, owner-only access, partial updates, soft delete."""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from app.modules.auth.otp_delivery import RecordingOtpSender
from tests.conftest import bearer, sign_in

PETS = "/api/v1/pets"


@pytest.fixture
def owner(api: TestClient, otp_sender: RecordingOtpSender) -> dict[str, str]:
    return bearer(sign_in(api, otp_sender, "owner@example.com")["access_token"])


@pytest.fixture
def stranger(api: TestClient, otp_sender: RecordingOtpSender) -> dict[str, str]:
    return bearer(sign_in(api, otp_sender, "stranger@example.com")["access_token"])


def create(api: TestClient, headers: dict[str, str], **fields: Any) -> dict[str, Any]:
    response = api.post(PETS, json={"name": "Bruno", "species": "dog", **fields}, headers=headers)
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


def test_requires_sign_in(api: TestClient) -> None:
    assert api.get(PETS).status_code == 401
    assert api.post(PETS, json={"name": "Bruno", "species": "dog"}).status_code == 401


def test_create_minimal_pet_with_defaults(api: TestClient, owner: dict[str, str]) -> None:
    pet = create(api, owner)
    assert pet["name"] == "Bruno"
    assert pet["species"] == "dog"
    assert pet["sex"] == "unknown"
    assert pet["date_of_birth_is_estimate"] is False
    assert pet["photo_url"] is None
    assert pet["created_at"].endswith(("Z", "+00:00"))


def test_create_full_profile_cleans_input(api: TestClient, owner: dict[str, str]) -> None:
    pet = create(
        api,
        owner,
        name="  Kitty ",
        species="cat",
        breed=" Indian Billi ",
        sex="female",
        date_of_birth="2022-03-01",
        date_of_birth_is_estimate=True,
        weight_kg="4.25",
        neutered=True,
        temperament="Shy with strangers",
        allergies="Chicken",
        medications="",
        emergency_contact_name="Arjun",
        emergency_contact_phone="98765 43210",
    )
    assert pet["name"] == "Kitty"
    assert pet["breed"] == "Indian Billi"
    assert pet["weight_kg"] == "4.25"
    assert pet["medications"] is None
    assert pet["emergency_contact_phone"] == "+919876543210"


def test_all_species_supported_including_other(api: TestClient, owner: dict[str, str]) -> None:
    for species in [
        "bird",
        "rabbit",
        "guinea_pig",
        "hamster",
        "fish",
        "turtle",
        "reptile",
        "horse",
        "cow",
        "goat",
    ]:
        create(api, owner, name=species.title(), species=species)
    other = create(api, owner, name="Spike", species="other", species_other="Hedgehog")
    assert other["species_other"] == "Hedgehog"

    ignored = create(api, owner, name="Rex", species="dog", species_other="ignored")
    assert ignored["species_other"] is None


@pytest.mark.parametrize(
    "payload",
    [
        {"name": "Spike", "species": "other"},
        {"name": "", "species": "dog"},
        {"name": "   ", "species": "dog"},
        {"name": "x" * 51, "species": "dog"},
        {"name": "Bruno", "species": "dragon"},
        {"name": "Bruno", "species": "dog", "date_of_birth": "2999-01-01"},
        {"name": "Bruno", "species": "dog", "weight_kg": 0},
        {"name": "Bruno", "species": "dog", "weight_kg": 2500},
        {"name": "Bruno", "species": "dog", "emergency_contact_phone": "123"},
        {"name": "Bruno", "species": "dog", "owner_id": "00000000-0000-0000-0000-000000000000"},
    ],
)
def test_invalid_pets_rejected(
    api: TestClient, owner: dict[str, str], payload: dict[str, Any]
) -> None:
    response = api.post(PETS, json=payload, headers=owner)
    assert response.status_code == 422, payload
    assert response.json()["error"]["code"] == "validation_error"


def test_owners_only_see_their_own_pets(
    api: TestClient, owner: dict[str, str], stranger: dict[str, str]
) -> None:
    pet = create(api, owner, allergies="Peanuts")
    create(api, stranger, name="Other")

    mine = api.get(PETS, headers=owner).json()
    assert [p["id"] for p in mine] == [pet["id"]]

    url = f"{PETS}/{pet['id']}"
    for response in [
        api.get(url, headers=stranger),
        api.patch(url, json={"name": "Stolen"}, headers=stranger),
        api.delete(url, headers=stranger),
        api.post(
            f"{url}/photo/upload-url",
            json={"content_type": "image/jpeg", "size_bytes": 10},
            headers=stranger,
        ),
    ]:
        assert response.status_code == 404  # never reveal that the pet exists
        assert "Peanuts" not in response.text

    assert api.get(url, headers=owner).json()["name"] == "Bruno"


def test_partial_update(api: TestClient, owner: dict[str, str]) -> None:
    pet = create(api, owner, breed="Indie", weight_kg="20")
    url = f"{PETS}/{pet['id']}"

    updated = api.patch(url, json={"weight_kg": "21.5", "breed": None}, headers=owner)
    assert updated.status_code == 200
    body = updated.json()
    assert body["weight_kg"] == "21.50"
    assert body["breed"] is None
    assert body["name"] == "Bruno"

    assert api.patch(url, json={"name": None}, headers=owner).status_code == 422
    assert api.patch(url, json={"species": None}, headers=owner).status_code == 422
    assert api.patch(url, json={"species": "other"}, headers=owner).status_code == 422

    other = api.patch(url, json={"species": "other", "species_other": "Wolfdog"}, headers=owner)
    assert other.json()["species_other"] == "Wolfdog"
    back = api.patch(url, json={"species": "dog"}, headers=owner)
    assert back.json()["species_other"] is None


def test_delete_is_soft_and_audited(
    api: TestClient, owner: dict[str, str], db_engine: Engine
) -> None:
    pet = create(api, owner)
    url = f"{PETS}/{pet['id']}"

    assert api.delete(url, headers=owner).status_code == 204
    assert api.get(url, headers=owner).status_code == 404
    assert api.get(PETS, headers=owner).json() == []
    assert api.delete(url, headers=owner).status_code == 404

    with db_engine.connect() as conn:
        assert conn.execute(text("SELECT deleted_at IS NOT NULL FROM pets")).scalar() is True
        actions = set(conn.execute(text("SELECT action FROM audit_logs")).scalars())
    assert {"pet.created", "pet.deleted"} <= actions


class TestPetLimit:
    @pytest.fixture
    def api_settings_overrides(self) -> dict[str, object]:
        return {"max_pets_per_owner": 2}

    def test_limit_enforced_and_freed_by_delete(
        self, api: TestClient, owner: dict[str, str]
    ) -> None:
        first = create(api, owner)
        create(api, owner, name="Two")
        third = api.post(PETS, json={"name": "Three", "species": "cat"}, headers=owner)
        assert third.status_code == 409
        assert third.json()["error"]["code"] == "pet_limit_reached"

        api.delete(f"{PETS}/{first['id']}", headers=owner)
        create(api, owner, name="Three")
