"""OTP delivery adapters (decision 0007).

Real email/SMS providers will implement `OtpSender` (Open Decision #15).
`ConsoleOtpSender` is a MOCK for local/test use only; settings validation refuses
it in staging and production.
"""

from __future__ import annotations

import logging
from typing import Protocol

from app.core.config import OtpDelivery, Settings
from app.modules.auth.identifiers import Identifier

logger = logging.getLogger("petfinity.otp")


class OtpSender(Protocol):
    def send(self, identifier: Identifier, code: str, ttl_minutes: int) -> None: ...


class ConsoleOtpSender:
    """MOCK sender: logs the code so developers can sign in locally. Never for real users."""

    def send(self, identifier: Identifier, code: str, ttl_minutes: int) -> None:
        logger.warning(
            "MOCK OTP (not delivered) to %s: %s (valid %d min)",
            identifier.masked(),
            code,
            ttl_minutes,
        )


class RecordingOtpSender:
    """Test double: keeps the last code per identifier in memory."""

    def __init__(self) -> None:
        self.sent: dict[str, str] = {}

    def send(self, identifier: Identifier, code: str, ttl_minutes: int) -> None:
        self.sent[identifier.value] = code


def create_otp_sender(settings: Settings) -> OtpSender:
    if settings.otp_delivery is OtpDelivery.CONSOLE:
        return ConsoleOtpSender()
    raise ValueError(f"unsupported OTP delivery: {settings.otp_delivery}")  # pragma: no cover
