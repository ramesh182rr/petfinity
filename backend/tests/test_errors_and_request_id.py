from collections.abc import Iterator

import pytest
from fastapi import APIRouter, FastAPI
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.errors import AppError
from app.main import create_app


@pytest.fixture
def error_client(settings: Settings) -> Iterator[TestClient]:
    """App with extra test-only routes that exercise each error path."""
    app: FastAPI = create_app(settings)
    router = APIRouter()

    @router.get("/_test/app-error")
    def raise_app_error() -> None:
        raise AppError("slot_unavailable", "That slot was just taken.", status_code=409)

    @router.get("/_test/crash")
    def crash() -> None:
        raise RuntimeError("secret internal detail: db password=hunter2")

    @router.get("/_test/typed")
    def typed(limit: int) -> dict[str, int]:
        return {"limit": limit}

    app.include_router(router, prefix="/api/v1")
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client


def test_request_id_generated_when_absent(client: TestClient) -> None:
    response = client.get("/api/v1/health")
    request_id = response.headers["X-Request-ID"]
    assert len(request_id) == 32


def test_valid_incoming_request_id_is_echoed(client: TestClient) -> None:
    response = client.get("/api/v1/health", headers={"X-Request-ID": "mobile-abc.123_x"})
    assert response.headers["X-Request-ID"] == "mobile-abc.123_x"


@pytest.mark.parametrize("bad", [b"has space", b"x" * 65, "injecté".encode(), b"a;b"])
def test_invalid_incoming_request_id_is_replaced(client: TestClient, bad: bytes) -> None:
    response = client.get("/api/v1/health", headers={"X-Request-ID": bad})
    assert response.headers["X-Request-ID"].encode() != bad
    assert len(response.headers["X-Request-ID"]) == 32


def test_unknown_route_uses_envelope(client: TestClient) -> None:
    response = client.get("/api/v1/does-not-exist")

    assert response.status_code == 404
    error = response.json()["error"]
    assert error["code"] == "not_found"
    assert error["request_id"] == response.headers["X-Request-ID"]


def test_method_not_allowed_uses_envelope(client: TestClient) -> None:
    response = client.post("/api/v1/health")
    assert response.status_code == 405
    assert response.json()["error"]["code"] == "method_not_allowed"


def test_app_error(error_client: TestClient) -> None:
    response = error_client.get("/api/v1/_test/app-error")

    assert response.status_code == 409
    assert response.json() == {
        "error": {
            "code": "slot_unavailable",
            "message": "That slot was just taken.",
            "details": None,
            "request_id": response.headers["X-Request-ID"],
        }
    }


def test_validation_error_lists_fields_without_echoing_input(error_client: TestClient) -> None:
    response = error_client.get("/api/v1/_test/typed", params={"limit": "not-a-number"})

    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["details"][0]["loc"] == ["query", "limit"]
    assert "input" not in error["details"][0]
    assert "not-a-number" not in response.text


def test_unhandled_error_is_generic_500(error_client: TestClient) -> None:
    response = error_client.get("/api/v1/_test/crash", headers={"X-Request-ID": "trace-500"})

    assert response.status_code == 500
    error = response.json()["error"]
    assert error["code"] == "internal_error"
    assert error["request_id"] == "trace-500"
    assert response.headers["X-Request-ID"] == "trace-500"
    assert "hunter2" not in response.text
