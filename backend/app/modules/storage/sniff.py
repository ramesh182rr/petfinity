"""Detect file type from content (never trust client-declared types)."""

from __future__ import annotations

ALLOWED_IMAGE_TYPES = ("image/jpeg", "image/png", "image/webp")
EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
}
SNIFF_BYTES = 16


def sniff_content_type(head: bytes) -> str | None:
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if len(head) >= 12 and head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"
    if head.startswith(b"%PDF-"):
        return "application/pdf"
    return None


# Backwards-compatible name used by image-only callers.
sniff_image_type = sniff_content_type
