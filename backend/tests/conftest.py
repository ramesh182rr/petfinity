"""Shared fixtures.

Tests run against a real PostgreSQL database (never SQLite): booking safety will
rely on Postgres-only constraints. The test database is created if missing and
migrated to head once per session.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, make_url, text
from sqlalchemy.orm import Session

from app.core.config import Environment, Settings
from app.db.session import create_db_engine
from app.main import create_app
from app.modules.auth.otp_delivery import RecordingOtpSender
from app.modules.storage.local import LocalStorage

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://localhost:5432/petfinity_test"
)


def make_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "app_env": Environment.TEST,
        "database_url": TEST_DATABASE_URL,
        "log_level": "WARNING",
        "jwt_secret": "test-jwt-secret-" + "x" * 32,
        "otp_pepper": "test-otp-pepper-" + "y" * 32,
        "otp_resend_cooldown_seconds": 0,
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)  # type: ignore[arg-type]


def _ensure_database_exists(url: str) -> None:
    target = make_url(url)
    if not target.database or not target.database.endswith("_test"):
        raise RuntimeError("TEST_DATABASE_URL must point to a database whose name ends in _test")
    admin = create_engine(target.set(database="postgres"), isolation_level="AUTOCOMMIT")
    try:
        with admin.connect() as conn:
            exists = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": target.database}
            ).scalar()
            if not exists:
                conn.execute(text(f'CREATE DATABASE "{target.database}"'))
    finally:
        admin.dispose()


def alembic_config(url: str = TEST_DATABASE_URL) -> Config:
    config = Config(os.path.join(BACKEND_DIR, "alembic.ini"))
    config.attributes["database_url"] = url
    return config


@pytest.fixture(scope="session")
def migrated_database() -> str:
    _ensure_database_exists(TEST_DATABASE_URL)
    command.upgrade(alembic_config(), "head")
    return TEST_DATABASE_URL


@pytest.fixture
def settings() -> Settings:
    return make_settings()


@pytest.fixture
def app(settings: Settings) -> FastAPI:
    return create_app(settings)


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="session")
def db_engine(migrated_database: str) -> Iterator[Engine]:
    engine = create_db_engine(make_settings(database_url=migrated_database))
    yield engine
    engine.dispose()


@pytest.fixture
def db_session(db_engine: Engine) -> Iterator[Session]:
    """A session whose work is always rolled back, even if the code under test commits."""
    connection = db_engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


# --- identity / API fixtures ------------------------------------------------------

IDENTITY_TABLES = (
    "audit_logs, auth_sessions, otp_challenges, staff_roles, pets, verification_documents, "
    "verification_submissions, clinic_members, clinics, provider_profiles, media_assets, users"
)


@pytest.fixture
def clean_tables(db_engine: Engine) -> Iterator[None]:
    """API tests commit real rows; wipe identity tables after each test."""
    yield
    with db_engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {IDENTITY_TABLES} RESTART IDENTITY CASCADE"))


@pytest.fixture
def otp_sender() -> RecordingOtpSender:
    return RecordingOtpSender()


@pytest.fixture
def api_settings_overrides() -> dict[str, object]:
    """Override in a test module (or via parametrisation) to tweak settings."""
    return {}


@pytest.fixture
def local_storage(tmp_path: Path) -> LocalStorage:
    return LocalStorage(tmp_path / "storage", "test-storage-signing-secret")


@pytest.fixture
def api(
    migrated_database: str,
    clean_tables: None,
    otp_sender: RecordingOtpSender,
    local_storage: LocalStorage,
    api_settings_overrides: dict[str, object],
) -> Iterator[TestClient]:
    settings = make_settings(database_url=migrated_database, **api_settings_overrides)
    app = create_app(settings, otp_sender=otp_sender, storage=local_storage)
    with TestClient(app) as client:
        yield client


def sign_in(
    client: TestClient,
    sender: RecordingOtpSender,
    destination: str,
    *,
    channel: str = "email",
) -> dict[str, object]:
    """Request + verify an OTP and return the sign-in response body."""
    requested = client.post(
        "/api/v1/auth/otp/request", json={"channel": channel, "destination": destination}
    )
    assert requested.status_code == 202, requested.text
    code = list(sender.sent.values())[-1]
    verified = client.post(
        "/api/v1/auth/otp/verify",
        json={"channel": channel, "destination": destination, "code": code},
    )
    assert verified.status_code == 200, verified.text
    body: dict[str, object] = verified.json()
    return body


def bearer(token: object) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}
