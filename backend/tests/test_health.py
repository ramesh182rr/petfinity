from fastapi.testclient import TestClient

from app import __version__
from app.main import create_app
from tests.conftest import make_settings


def test_liveness_returns_ok(client: TestClient) -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "petfinity-api", "version": __version__}


def test_liveness_does_not_need_database() -> None:
    unreachable = make_settings(
        database_url="postgresql+psycopg://nobody@127.0.0.1:1/petfinity_test",
        database_connect_timeout_seconds=1,
    )
    with TestClient(create_app(unreachable)) as client:
        assert client.get("/api/v1/health").status_code == 200


def test_readiness_ok_when_database_reachable(migrated_database: str) -> None:
    with TestClient(create_app(make_settings(database_url=migrated_database))) as client:
        response = client.get("/api/v1/health/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready", "checks": {"database": "ok"}}


def test_readiness_503_with_error_envelope_when_database_down() -> None:
    unreachable = make_settings(
        database_url="postgresql+psycopg://nobody@127.0.0.1:1/petfinity_test",
        database_connect_timeout_seconds=1,
    )
    with TestClient(create_app(unreachable)) as client:
        response = client.get("/api/v1/health/ready")

    assert response.status_code == 503
    body = response.json()["error"]
    assert body["code"] == "not_ready"
    assert body["details"] == {"database": "unavailable"}
    # Connection details (host/port/user) must not leak to clients.
    assert "127.0.0.1" not in response.text
    assert body["request_id"] == response.headers["X-Request-ID"]
