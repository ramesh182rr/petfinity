"""Pet photo upload through signed URLs, with the local dev storage backend."""

from __future__ import annotations

from typing import Any
from urllib.parse import parse_qs, urlencode, urlsplit

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from app.main import create_app
from app.modules.auth.otp_delivery import RecordingOtpSender
from app.modules.storage.base import ObjectInfo, PresignedUpload
from app.modules.storage.local import LocalStorage
from tests.conftest import bearer, make_settings, sign_in

PETS = "/api/v1/pets"
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 60
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 40


@pytest.fixture
def owner(api: TestClient, otp_sender: RecordingOtpSender) -> dict[str, str]:
    return bearer(sign_in(api, otp_sender, "photo@example.com")["access_token"])


@pytest.fixture
def pet(api: TestClient, owner: dict[str, str]) -> dict[str, Any]:
    body: dict[str, Any] = api.post(
        PETS, json={"name": "Bruno", "species": "dog"}, headers=owner
    ).json()
    return body


def request_upload(
    api: TestClient, headers: dict[str, str], pet_id: str, data: bytes, content_type: str
) -> dict[str, Any]:
    response = api.post(
        f"{PETS}/{pet_id}/photo/upload-url",
        json={"content_type": content_type, "size_bytes": len(data)},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


def upload(api: TestClient, ticket: dict[str, Any], data: bytes) -> int:
    url: str = ticket["upload"]["url"]
    headers: dict[str, str] = ticket["upload"]["headers"]
    status: int = api.put(url, content=data, headers=headers).status_code
    return status


def test_full_photo_flow(
    api: TestClient, owner: dict[str, str], pet: dict[str, Any], local_storage: LocalStorage
) -> None:
    ticket = request_upload(api, owner, pet["id"], JPEG, "image/jpeg")
    assert ticket["upload"]["method"] == "PUT"
    assert ticket["upload"]["url"].startswith("/api/v1/dev-storage/pets/")
    assert upload(api, ticket, JPEG) == 204

    confirmed = api.put(
        f"{PETS}/{pet['id']}/photo", json={"media_id": ticket["media_id"]}, headers=owner
    )
    assert confirmed.status_code == 200
    photo_url = confirmed.json()["photo_url"]
    assert photo_url.startswith("/api/v1/dev-storage/")

    # Signed download works without auth headers (like a presigned R2 URL) ...
    downloaded = api.get(photo_url)
    assert downloaded.status_code == 200
    assert downloaded.content == JPEG
    assert downloaded.headers["content-type"] == "image/jpeg"
    # ... and the plain object path without a signature does not.
    assert api.get(urlsplit(photo_url).path).status_code == 422
    assert api.get(f"{PETS}/{pet['id']}", headers=owner).json()["photo_url"]


def test_replacing_and_removing_photo_deletes_old_files(
    api: TestClient, owner: dict[str, str], pet: dict[str, Any], local_storage: LocalStorage
) -> None:
    first = request_upload(api, owner, pet["id"], JPEG, "image/jpeg")
    upload(api, first, JPEG)
    api.put(f"{PETS}/{pet['id']}/photo", json={"media_id": first["media_id"]}, headers=owner)
    first_files = list(local_storage.root.rglob("*.jpg"))
    assert len(first_files) == 1

    second = request_upload(api, owner, pet["id"], PNG, "image/png")
    upload(api, second, PNG)
    api.put(f"{PETS}/{pet['id']}/photo", json={"media_id": second["media_id"]}, headers=owner)
    assert not first_files[0].exists()
    assert len(list(local_storage.root.rglob("*.png"))) == 1

    removed = api.delete(f"{PETS}/{pet['id']}/photo", headers=owner)
    assert removed.json()["photo_url"] is None
    assert list(local_storage.root.rglob("*.png")) == []


def test_deleting_pet_deletes_photo(
    api: TestClient, owner: dict[str, str], pet: dict[str, Any], local_storage: LocalStorage
) -> None:
    ticket = request_upload(api, owner, pet["id"], JPEG, "image/jpeg")
    upload(api, ticket, JPEG)
    api.put(f"{PETS}/{pet['id']}/photo", json={"media_id": ticket["media_id"]}, headers=owner)

    api.delete(f"{PETS}/{pet['id']}", headers=owner)
    assert list(local_storage.root.rglob("*.jpg")) == []


def test_rejects_unsupported_types_and_oversize(
    api: TestClient, owner: dict[str, str], pet: dict[str, Any]
) -> None:
    url = f"{PETS}/{pet['id']}/photo/upload-url"
    gif = api.post(url, json={"content_type": "image/gif", "size_bytes": 100}, headers=owner)
    assert gif.status_code == 415
    svg = api.post(url, json={"content_type": "image/svg+xml", "size_bytes": 100}, headers=owner)
    assert svg.status_code == 415
    huge = api.post(
        url, json={"content_type": "image/jpeg", "size_bytes": 50_000_000}, headers=owner
    )
    assert huge.status_code == 413
    assert huge.json()["error"]["details"]["max_bytes"] == 8_000_000


def test_non_image_content_is_rejected_and_removed(
    api: TestClient,
    owner: dict[str, str],
    pet: dict[str, Any],
    local_storage: LocalStorage,
    db_engine: Engine,
) -> None:
    fake = b"<html>not an image</html>"
    ticket = request_upload(api, owner, pet["id"], fake, "image/jpeg")
    assert upload(api, ticket, fake) == 204

    response = api.put(
        f"{PETS}/{pet['id']}/photo", json={"media_id": ticket["media_id"]}, headers=owner
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_file"
    assert list(local_storage.root.rglob("*.jpg")) == []
    with db_engine.connect() as conn:
        assert conn.execute(text("SELECT status FROM media_assets")).scalar() == "deleted"


def test_confirm_rules(
    api: TestClient,
    owner: dict[str, str],
    pet: dict[str, Any],
    otp_sender: RecordingOtpSender,
) -> None:
    ticket = request_upload(api, owner, pet["id"], JPEG, "image/jpeg")
    confirm_url = f"{PETS}/{pet['id']}/photo"
    body = {"media_id": ticket["media_id"]}

    not_uploaded = api.put(confirm_url, json=body, headers=owner)
    assert not_uploaded.status_code == 409
    assert not_uploaded.json()["error"]["code"] == "upload_not_found"

    upload(api, ticket, JPEG)
    other = bearer(sign_in(api, otp_sender, "other@example.com")["access_token"])
    other_pet = api.post(PETS, json={"name": "Mine", "species": "cat"}, headers=other).json()
    stolen = api.put(f"{PETS}/{other_pet['id']}/photo", json=body, headers=other)
    assert stolen.status_code == 404

    # Media for one pet can't be attached to another pet of the same owner either.
    sibling = api.post(PETS, json={"name": "Sib", "species": "cat"}, headers=owner).json()
    assert api.put(f"{PETS}/{sibling['id']}/photo", json=body, headers=owner).status_code == 404

    assert api.put(confirm_url, json=body, headers=owner).status_code == 200
    again = api.put(confirm_url, json=body, headers=owner)
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "upload_already_used"


def test_signed_upload_url_is_tamper_proof(
    api: TestClient, owner: dict[str, str], pet: dict[str, Any]
) -> None:
    ticket = request_upload(api, owner, pet["id"], JPEG, "image/jpeg")
    url = ticket["upload"]["url"]
    parts = urlsplit(url)
    query = {k: v[0] for k, v in parse_qs(parts.query).items()}

    wrong_type = api.put(url, content=JPEG, headers={"Content-Type": "image/png"})
    assert wrong_type.status_code == 400

    too_big = api.put(url, content=JPEG + b"\x00" * 10, headers=ticket["upload"]["headers"])
    assert too_big.status_code == 413

    for tampered in (
        {**query, "max": str(10_000_000)},
        {**query, "ct": "text/html"},
        {**query, "sig": "0" * 64},
        {**query, "op": "get"},
    ):
        bad = api.put(
            f"{parts.path}?{urlencode(tampered)}",
            content=JPEG,
            headers={"Content-Type": tampered.get("ct", "image/jpeg")},
        )
        assert bad.status_code == 403, tampered

    other_key = parts.path.replace(pet["id"], "00000000-0000-0000-0000-000000000000")
    assert (
        api.put(
            f"{other_key}?{parts.query}", content=JPEG, headers=ticket["upload"]["headers"]
        ).status_code
        == 403
    )


def test_expired_and_traversal_urls_rejected(local_storage: LocalStorage) -> None:
    assert local_storage.verify(op="get", key="pets/a.jpg", exp=1, sig="x") is False
    with pytest.raises(ValueError, match="invalid storage key"):
        local_storage.path_for("../../etc/passwd")
    with pytest.raises(ValueError, match="invalid storage key"):
        local_storage.presign_download("pets/../../secret", expires_in=60)


def test_dev_storage_routes_absent_when_using_r2(migrated_database: str) -> None:
    class FakeR2:
        def presign_upload(
            self, key: str, *, content_type: str, size_bytes: int, expires_in: int
        ) -> PresignedUpload:
            return PresignedUpload(url="https://r2.example/x")

        def presign_download(self, key: str, *, expires_in: int) -> str:
            return "https://r2.example/x"

        def head(self, key: str) -> ObjectInfo | None:
            return None

        def read_prefix(self, key: str, length: int) -> bytes:
            return b""

        def delete(self, key: str) -> None: ...

    app = create_app(make_settings(database_url=migrated_database), storage=FakeR2())
    with TestClient(app) as client:
        assert client.put("/api/v1/dev-storage/pets/x.jpg?op=put").status_code == 404
