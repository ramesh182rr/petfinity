"""Signed-URL upload lifecycle: issue URL -> client uploads -> confirm and verify."""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.core.config import Settings
from app.core.errors import AppError
from app.modules.media.models import MediaAsset, MediaPurpose, MediaStatus
from app.modules.storage.base import ObjectStorage, PresignedUpload
from app.modules.storage.sniff import (
    ALLOWED_IMAGE_TYPES,
    EXTENSIONS,
    SNIFF_BYTES,
    sniff_content_type,
)

logger = logging.getLogger(__name__)

MAX_PENDING_PER_HOUR = 30


@dataclass(frozen=True)
class UploadPolicy:
    allowed_types: tuple[str, ...]
    max_bytes: int
    unsupported_message: str


def policy_for(settings: Settings, purpose: MediaPurpose) -> UploadPolicy:
    if purpose is MediaPurpose.VERIFICATION_DOCUMENT:
        return UploadPolicy(
            allowed_types=(*ALLOWED_IMAGE_TYPES, "application/pdf"),
            max_bytes=settings.media_max_document_bytes,
            unsupported_message="Please upload a PDF, JPEG, PNG or WebP file.",
        )
    return UploadPolicy(
        allowed_types=ALLOWED_IMAGE_TYPES,
        max_bytes=settings.media_max_image_bytes,
        unsupported_message="Please choose a JPEG, PNG or WebP image.",
    )


@dataclass(frozen=True)
class UploadTicket:
    asset: MediaAsset
    upload: PresignedUpload
    expires_at: datetime


def create_upload(
    db: Session,
    settings: Settings,
    storage: ObjectStorage,
    *,
    owner_id: uuid.UUID,
    purpose: MediaPurpose,
    key_prefix: str,
    content_type: str,
    size_bytes: int,
) -> UploadTicket:
    policy = policy_for(settings, purpose)
    if content_type not in policy.allowed_types:
        raise AppError(
            "unsupported_media_type",
            policy.unsupported_message,
            status_code=415,
            details={"allowed": list(policy.allowed_types)},
        )
    if size_bytes <= 0 or size_bytes > policy.max_bytes:
        raise AppError(
            "file_too_large",
            "That file is too large.",
            status_code=413,
            details={"max_bytes": policy.max_bytes},
        )
    now = utcnow()
    recent = db.scalar(
        select(func.count())
        .select_from(MediaAsset)
        .where(MediaAsset.owner_id == owner_id, MediaAsset.created_at > now - timedelta(hours=1))
    )
    if (recent or 0) >= MAX_PENDING_PER_HOUR:
        raise AppError(
            "rate_limited",
            "Too many uploads. Please try again later.",
            status_code=429,
            details={"retry_after_seconds": 3600},
        )

    asset_id = uuid.uuid4()
    key = f"{key_prefix}/{asset_id}.{EXTENSIONS[content_type]}"
    asset = MediaAsset(
        id=asset_id,
        owner_id=owner_id,
        purpose=purpose.value,
        storage_key=key,
        content_type=content_type,
        declared_size_bytes=size_bytes,
        status=MediaStatus.PENDING,
        created_at=now,
    )
    db.add(asset)
    db.flush()
    ttl = settings.media_upload_url_ttl_seconds
    upload = storage.presign_upload(
        key, content_type=content_type, size_bytes=size_bytes, expires_in=ttl
    )
    return UploadTicket(asset=asset, upload=upload, expires_at=now + timedelta(seconds=ttl))


def confirm_upload(
    db: Session,
    settings: Settings,
    storage: ObjectStorage,
    *,
    owner_id: uuid.UUID,
    media_id: uuid.UUID,
    purpose: MediaPurpose,
    key_prefix: str,
) -> MediaAsset:
    asset = db.scalars(
        select(MediaAsset).where(MediaAsset.id == media_id).with_for_update()
    ).first()
    if (
        asset is None
        or asset.owner_id != owner_id
        or asset.purpose != purpose.value
        or not asset.storage_key.startswith(f"{key_prefix}/")
    ):
        raise AppError("not_found", "Upload not found.", status_code=404)
    if asset.status != MediaStatus.PENDING:
        raise AppError("upload_already_used", "This upload has already been used.", status_code=409)

    info = storage.head(asset.storage_key)
    if info is None:
        raise AppError(
            "upload_not_found",
            "We couldn't find the uploaded file. Please try again.",
            status_code=409,
        )

    detected = sniff_content_type(storage.read_prefix(asset.storage_key, SNIFF_BYTES))
    if (
        info.size > policy_for(settings, purpose).max_bytes
        or info.size != asset.declared_size_bytes
        or detected != asset.content_type
    ):
        discard(db, storage, asset)
        db.commit()  # persist the rejection even though the request fails
        raise AppError(
            "invalid_file",
            "That file isn't valid or doesn't match its type. Please choose another.",
            status_code=422,
        )

    asset.status = MediaStatus.READY
    asset.size_bytes = info.size
    asset.uploaded_at = utcnow()
    return asset


def download_url(
    settings: Settings, storage: ObjectStorage, asset: MediaAsset | None
) -> str | None:
    if asset is None or asset.status != MediaStatus.READY:
        return None
    return storage.presign_download(
        asset.storage_key, expires_in=settings.media_download_url_ttl_seconds
    )


def discard(db: Session, storage: ObjectStorage, asset: MediaAsset) -> None:
    asset.status = MediaStatus.DELETED
    asset.deleted_at = utcnow()
    try:
        storage.delete(asset.storage_key)
    except Exception:  # storage outage must not block the user action
        logger.exception("media_delete_failed", extra={"media_id": str(asset.id)})


def get_asset(db: Session, media_id: uuid.UUID | None) -> MediaAsset | None:
    return db.get(MediaAsset, media_id) if media_id else None
