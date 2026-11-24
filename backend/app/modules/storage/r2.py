"""Cloudflare R2 storage (STORAGE_BACKEND=r2), via the S3-compatible API.

The bucket must be PRIVATE: every read and write uses a short-lived presigned URL.
Upload URLs sign the exact Content-Type and Content-Length, so a client cannot
upload a different type or a larger file than the API approved.
"""

from __future__ import annotations

from typing import Any

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.modules.storage.base import ObjectInfo, PresignedUpload, validate_key


class R2Storage:
    def __init__(
        self,
        *,
        account_id: str,
        bucket: str,
        access_key_id: str,
        secret_access_key: str,
        endpoint_url: str | None = None,
        client: Any | None = None,
    ) -> None:
        self.bucket = bucket
        self._client = client or boto3.client(
            "s3",
            endpoint_url=endpoint_url or f"https://{account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            region_name="auto",
            config=Config(
                signature_version="s3v4", retries={"max_attempts": 3, "mode": "standard"}
            ),
        )

    def presign_upload(
        self, key: str, *, content_type: str, size_bytes: int, expires_in: int
    ) -> PresignedUpload:
        url: str = self._client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": self.bucket,
                "Key": validate_key(key),
                "ContentType": content_type,
                "ContentLength": size_bytes,
            },
            ExpiresIn=expires_in,
            HttpMethod="PUT",
        )
        return PresignedUpload(url=url, method="PUT", headers={"Content-Type": content_type})

    def presign_download(self, key: str, *, expires_in: int) -> str:
        url: str = self._client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": validate_key(key)},
            ExpiresIn=expires_in,
        )
        return url

    def head(self, key: str) -> ObjectInfo | None:
        try:
            response = self._client.head_object(Bucket=self.bucket, Key=validate_key(key))
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") in {"404", "NoSuchKey", "NotFound"}:
                return None
            raise
        return ObjectInfo(
            size=int(response["ContentLength"]), content_type=response.get("ContentType")
        )

    def read_prefix(self, key: str, length: int) -> bytes:
        response = self._client.get_object(
            Bucket=self.bucket, Key=validate_key(key), Range=f"bytes=0-{length - 1}"
        )
        data: bytes = response["Body"].read()
        return data

    def delete(self, key: str) -> None:
        self._client.delete_object(Bucket=self.bucket, Key=validate_key(key))
