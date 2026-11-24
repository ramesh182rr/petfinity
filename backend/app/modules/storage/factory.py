from __future__ import annotations

from app.core.config import Settings, StorageBackend
from app.modules.auth.tokens import keyed_hash
from app.modules.storage.base import ObjectStorage
from app.modules.storage.local import LocalStorage
from app.modules.storage.r2 import R2Storage


def create_storage(settings: Settings) -> ObjectStorage:
    if settings.storage_backend is StorageBackend.R2:
        if not (
            settings.r2_account_id
            and settings.r2_bucket
            and settings.r2_access_key_id
            and settings.r2_secret_access_key
        ):  # pragma: no cover - settings validation already guarantees these
            raise RuntimeError("R2 storage is not fully configured")
        return R2Storage(
            account_id=settings.r2_account_id,
            bucket=settings.r2_bucket,
            access_key_id=settings.r2_access_key_id,
            secret_access_key=settings.r2_secret_access_key.get_secret_value(),
            endpoint_url=settings.r2_endpoint_url,
        )
    # Dev signing key derived from JWT_SECRET (separate purpose label).
    secret = keyed_hash(settings.jwt_secret.get_secret_value(), "local-storage-signing")
    return LocalStorage(settings.storage_local_dir, secret)
