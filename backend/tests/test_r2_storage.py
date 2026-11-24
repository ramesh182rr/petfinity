"""Cloudflare R2 adapter against a stubbed S3 client (no network)."""

from __future__ import annotations

from urllib.parse import parse_qs, urlsplit

import boto3
import pytest
from botocore.config import Config
from botocore.response import StreamingBody
from botocore.stub import Stubber

from app.modules.storage.factory import create_storage
from app.modules.storage.local import LocalStorage
from app.modules.storage.r2 import R2Storage
from tests.conftest import make_settings
from tests.test_config import R2_SETTINGS


@pytest.fixture
def client():  # type: ignore[no-untyped-def]
    return boto3.client(
        "s3",
        endpoint_url="https://acct.r2.cloudflarestorage.com",
        aws_access_key_id="key",
        aws_secret_access_key="secret",
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )


@pytest.fixture
def storage(client) -> R2Storage:  # type: ignore[no-untyped-def]
    return R2Storage(
        account_id="acct",
        bucket="petfinity-dev",
        access_key_id="key",
        secret_access_key="secret",
        client=client,
    )


def test_presigned_upload_signs_type_and_length(storage: R2Storage) -> None:
    upload = storage.presign_upload(
        "pets/u/p/a.jpg", content_type="image/jpeg", size_bytes=1234, expires_in=600
    )
    parts = urlsplit(upload.url)
    query = parse_qs(parts.query)

    assert parts.netloc == "acct.r2.cloudflarestorage.com"
    assert parts.path == "/petfinity-dev/pets/u/p/a.jpg"
    assert query["X-Amz-Expires"] == ["600"]
    signed = query["X-Amz-SignedHeaders"][0].split(";")
    assert {"content-type", "content-length", "host"} <= set(signed)
    assert upload.method == "PUT"
    assert upload.headers == {"Content-Type": "image/jpeg"}


def test_presigned_download(storage: R2Storage) -> None:
    url = storage.presign_download("pets/u/p/a.jpg", expires_in=3600)
    assert "X-Amz-Signature=" in url
    assert parse_qs(urlsplit(url).query)["X-Amz-Expires"] == ["3600"]


def test_head_read_and_delete(storage: R2Storage, client) -> None:  # type: ignore[no-untyped-def]
    import io

    with Stubber(client) as stub:
        stub.add_response(
            "head_object",
            {"ContentLength": 64, "ContentType": "image/jpeg"},
            {"Bucket": "petfinity-dev", "Key": "pets/a.jpg"},
        )
        stub.add_client_error("head_object", service_error_code="404", http_status_code=404)
        stub.add_response(
            "get_object",
            {"Body": StreamingBody(io.BytesIO(b"\xff\xd8\xff"), 3)},
            {"Bucket": "petfinity-dev", "Key": "pets/a.jpg", "Range": "bytes=0-15"},
        )
        stub.add_response("delete_object", {}, {"Bucket": "petfinity-dev", "Key": "pets/a.jpg"})

        info = storage.head("pets/a.jpg")
        assert info is not None
        assert info.size == 64
        assert info.content_type == "image/jpeg"
        assert storage.head("pets/missing.jpg") is None
        assert storage.read_prefix("pets/a.jpg", 16) == b"\xff\xd8\xff"
        storage.delete("pets/a.jpg")
        stub.assert_no_pending_responses()


def test_rejects_unsafe_keys(storage: R2Storage) -> None:
    with pytest.raises(ValueError, match="invalid storage key"):
        storage.presign_download("../other-bucket/x", expires_in=60)


def test_factory_selects_backend_from_settings() -> None:
    assert isinstance(create_storage(make_settings()), LocalStorage)
    r2 = create_storage(make_settings(**R2_SETTINGS))
    assert isinstance(r2, R2Storage)
    assert r2.bucket == "petfinity-test"
