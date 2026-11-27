"""A light automatic check on review and reply text (decision 0014).

It never rejects a review: a match only holds it for a moderator. It catches the
common problems (contact details, links, obvious abuse) without pretending to be
a full content filter.
"""

from __future__ import annotations

import re

_PHONE = re.compile(r"(?<![\d/])(?:\+?\d[\s-]?){9,12}\d(?![\d/])")  # 10-13 digits, spaced or not
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")
_LINK = re.compile(r"(?:https?://|www\.)\S+|\b\S+\.(?:com|in|net|org|co|io|me)\b", re.IGNORECASE)
# Short, deliberately conservative list; moderators handle the nuance.
_ABUSE = re.compile(
    r"\b(?:fuck\w*|shit\w*|bastard|bitch\w*|idiot|scam+er|chutiya|madarchod|bhenchod|"
    r"saala|kutta|harami)\b",
    re.IGNORECASE,
)


def flag_reason(text: str | None) -> str | None:
    """Why this text should wait for a moderator, or None if it's fine to publish."""
    if not text:
        return None
    if _PHONE.search(text) or _EMAIL.search(text):
        return "contact_details"
    if _LINK.search(text):
        return "link"
    if _ABUSE.search(text):
        return "language"
    return None
