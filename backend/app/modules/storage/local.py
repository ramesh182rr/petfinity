"""Local-disk storage for development (STORAGE_BACKEND=local).

Behaves like a bucket with presigned URLs: the API exposes `/dev-storage/<key>`
for PUT/GET, authorised by an HMAC signature with expiry, content type and size
limit baked in. Refused in staging/production by settings validation.
"""

from __future__ import annotations

import hmac
import json
import time
from pathlib import Path
from urllib.parse import urlencode

from app.modules.auth.tokens import keyed_hash
from app.modules.storage.base import ObjectInfo, PresignedUpload, validate_key

URL_PREFIX = "/api/v1/dev-storage/"


class LocalStorage:
    def __init__(self, root: str | Path, signing_secret: str) -> None:
        self.root = Path(root).resolve()
        self._secret = signing_secret

    # --- signing -------------------------------------------------------------------

    def _signature(self, op: str, key: str, exp: int, content_type: str, max_bytes: int) -> str:
        return keyed_hash(self._secret, f"{op}\n{key}\n{exp}\n{content_type}\n{max_bytes}")

    def _signed_url(
        self, op: str, key: str, expires_in: int, content_type: str = "", max_bytes: int = 0
    ) -> str:
        exp = int(time.time()) + expires_in
        params = {
            "op": op,
            "exp": exp,
            "sig": self._signature(op, key, exp, content_type, max_bytes),
        }
        if content_type:
            params["ct"] = content_type
        if max_bytes:
            params["max"] = max_bytes
        return f"{URL_PREFIX}{key}?{urlencode(params)}"

    def verify(
        self, *, op: str, key: str, exp: int, sig: str, content_type: str = "", max_bytes: int = 0
    ) -> bool:
        if exp < int(time.time()):
            return False
        expected = self._signature(op, key, exp, content_type, max_bytes)
        return hmac.compare_digest(expected, sig)

    # --- paths ---------------------------------------------------------------------

    def path_for(self, key: str) -> Path:
        path = (self.root / validate_key(key)).resolve()
        if self.root not in path.parents:
            raise ValueError("invalid storage key")
        return path

    @staticmethod
    def _meta_path(path: Path) -> Path:
        return path.with_name(path.name + ".meta.json")

    # --- ObjectStorage ---------------------------------------------------------------

    def presign_upload(
        self, key: str, *, content_type: str, size_bytes: int, expires_in: int
    ) -> PresignedUpload:
        validate_key(key)
        url = self._signed_url("put", key, expires_in, content_type, size_bytes)
        return PresignedUpload(url=url, method="PUT", headers={"Content-Type": content_type})

    def presign_download(self, key: str, *, expires_in: int) -> str:
        validate_key(key)
        return self._signed_url("get", key, expires_in)

    def head(self, key: str) -> ObjectInfo | None:
        path = self.path_for(key)
        if not path.is_file():
            return None
        meta_path = self._meta_path(path)
        content_type = None
        if meta_path.is_file():
            content_type = json.loads(meta_path.read_text()).get("content_type")
        return ObjectInfo(size=path.stat().st_size, content_type=content_type)

    def read_prefix(self, key: str, length: int) -> bytes:
        with self.path_for(key).open("rb") as handle:
            return handle.read(length)

    def delete(self, key: str) -> None:
        path = self.path_for(key)
        path.unlink(missing_ok=True)
        self._meta_path(path).unlink(missing_ok=True)

    # --- used by the dev router --------------------------------------------------------

    def write(self, key: str, data: bytes, content_type: str) -> None:
        path = self.path_for(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_name(path.name + ".part")
        tmp.write_bytes(data)
        tmp.replace(path)
        self._meta_path(path).write_text(json.dumps({"content_type": content_type}))
