"""Object storage interface (decision 0008).

Uploads and downloads always go through short-lived signed URLs, so clients
never hold storage credentials and the API never proxies large files (except
the local dev backend, which plays the role of the bucket).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Protocol

# Keys are generated server-side only; this guards against path tricks regardless.
SAFE_KEY = re.compile(r"^[a-z0-9][a-z0-9/_.-]{0,250}$")


def validate_key(key: str) -> str:
    if not SAFE_KEY.fullmatch(key) or ".." in key or "//" in key:
        raise ValueError("invalid storage key")
    return key


@dataclass(frozen=True)
class PresignedUpload:
    url: str  # absolute (R2) or API-relative path starting with "/" (local dev)
    method: str = "PUT"
    headers: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class ObjectInfo:
    size: int
    content_type: str | None


class ObjectStorage(Protocol):
    def presign_upload(
        self, key: str, *, content_type: str, size_bytes: int, expires_in: int
    ) -> PresignedUpload: ...

    def presign_download(self, key: str, *, expires_in: int) -> str: ...

    def head(self, key: str) -> ObjectInfo | None: ...

    def read_prefix(self, key: str, length: int) -> bytes: ...

    def delete(self, key: str) -> None: ...
