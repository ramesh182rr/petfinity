"""Shared input cleaning for free-text fields."""

from __future__ import annotations


def clean_text(value: str | None) -> str | None:
    """Trim; blank becomes None; reject control characters other than newline/tab."""
    if value is None:
        return None
    cleaned = value.strip()
    if any(ord(ch) < 32 and ch not in "\n\t" for ch in cleaned):
        raise ValueError("contains invalid characters")
    return cleaned or None


def clean_required(value: str) -> str:
    cleaned = clean_text(" ".join(value.split()))
    if not cleaned:
        raise ValueError("is required")
    return cleaned
