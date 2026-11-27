"""Push delivery behind an adapter (decision 0013).

- `LogPushSender` (PUSH_BACKEND=log): MOCK, writes pushes to the log; tests read `.sent`.
- `ExpoPushSender` (PUSH_BACKEND=expo): Expo Push Service, which fronts FCM and APNs.
Swapping to direct FCM/APNs later only means another sender with the same interface.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Protocol

import httpx

from app.core.config import PushBackend, Settings

log = logging.getLogger(__name__)

EXPO_BATCH = 100  # Expo accepts at most 100 messages per request


@dataclass(frozen=True)
class PushMessage:
    token: str
    title: str
    body: str
    data: dict[str, Any]


@dataclass(frozen=True)
class PushResult:
    ok: bool
    device_gone: bool = False  # the token is dead: stop sending to it
    error: str | None = None


class PushSender(Protocol):
    def send(self, messages: list[PushMessage]) -> list[PushResult]: ...


@dataclass
class LogPushSender:
    sent: list[PushMessage] = field(default_factory=list)

    def send(self, messages: list[PushMessage]) -> list[PushResult]:
        for message in messages:
            log.info(
                "MOCK PUSH (not delivered) to %s…: %s · %s",
                message.token[:22],
                message.title,
                message.body,
            )
        self.sent.extend(messages)
        return [PushResult(ok=True) for _ in messages]


class ExpoPushSender:
    def __init__(
        self,
        url: str,
        access_token: str | None,
        *,
        timeout: float = 10.0,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        headers = {"Accept": "application/json", "Accept-Encoding": "gzip, deflate"}
        if access_token:
            headers["Authorization"] = f"Bearer {access_token}"
        self._client = httpx.Client(timeout=timeout, headers=headers, transport=transport)
        self._url = url

    def send(self, messages: list[PushMessage]) -> list[PushResult]:
        results: list[PushResult] = []
        for start in range(0, len(messages), EXPO_BATCH):
            results += self._send_batch(messages[start : start + EXPO_BATCH])
        return results

    def _send_batch(self, batch: list[PushMessage]) -> list[PushResult]:
        payload = [
            {
                "to": m.token,
                "title": m.title,
                "body": m.body,
                "data": m.data,
                "sound": "default",
                "channelId": "bookings",
                "priority": "high",
            }
            for m in batch
        ]
        try:
            response = self._client.post(self._url, json=payload)
            response.raise_for_status()
            tickets = response.json().get("data", [])
        except (httpx.HTTPError, ValueError) as exc:
            log.warning("Expo push request failed: %s", exc)
            return [PushResult(ok=False, error="request_failed") for _ in batch]
        results: list[PushResult] = []
        for index in range(len(batch)):
            ticket = tickets[index] if index < len(tickets) else {}
            if ticket.get("status") == "ok":
                results.append(PushResult(ok=True))
                continue
            error = (ticket.get("details") or {}).get("error") or ticket.get("message")
            results.append(
                PushResult(ok=False, device_gone=error == "DeviceNotRegistered", error=str(error))
            )
        return results


def create_push_sender(settings: Settings) -> PushSender:
    if settings.push_backend is PushBackend.EXPO:
        token = settings.expo_access_token
        return ExpoPushSender(settings.expo_push_url, token.get_secret_value() if token else None)
    return LogPushSender()
