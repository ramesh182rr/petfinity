"""Normalisation and validation of sign-in identifiers (email / phone)."""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import StrEnum

from email_validator import EmailNotValidError, validate_email

from app.core.errors import AppError


class Channel(StrEnum):
    EMAIL = "email"
    PHONE = "phone"


_E164 = re.compile(r"^\+[1-9]\d{7,14}$")
_INDIA_MOBILE = re.compile(r"^\+91[6-9]\d{9}$")
_PHONE_SEPARATORS = re.compile(r"[\s\-().]")


@dataclass(frozen=True)
class Identifier:
    channel: Channel
    value: str  # normalised: lowercase email / E.164 phone

    def masked(self) -> str:
        """For display back to the user (e.g. 'Code sent to r***@gmail.com')."""
        if self.channel is Channel.EMAIL:
            local, _, domain = self.value.partition("@")
            return f"{local[:1]}***@{domain}"
        return f"{self.value[:3]}******{self.value[-4:]}"


def _invalid(channel: Channel) -> AppError:
    label = "email address" if channel is Channel.EMAIL else "mobile number"
    return AppError(
        "invalid_identifier",
        f"Please enter a valid {label}.",
        status_code=422,
        details={"field": "destination"},
    )


def normalize_email(raw: str) -> str:
    try:
        # No DNS lookups: keeps requests fast and avoids leaking timing information.
        result = validate_email(raw.strip(), check_deliverability=False)
    except EmailNotValidError as exc:
        raise _invalid(Channel.EMAIL) from exc
    return result.normalized.lower()


def normalize_phone(raw: str) -> str:
    value = _PHONE_SEPARATORS.sub("", raw.strip())
    if value.startswith("00"):
        value = "+" + value[2:]
    if not value.startswith("+") and len(value) == 10 and value[0] in "6789":
        value = "+91" + value  # launch market default: bare 10-digit Indian mobile
    if not _E164.fullmatch(value):
        raise _invalid(Channel.PHONE)
    if value.startswith("+91") and not _INDIA_MOBILE.fullmatch(value):
        raise _invalid(Channel.PHONE)
    return value


def parse_identifier(channel: Channel, raw: str) -> Identifier:
    if len(raw) > 320:
        raise _invalid(channel)
    value = normalize_email(raw) if channel is Channel.EMAIL else normalize_phone(raw)
    return Identifier(channel=channel, value=value)
