import pytest
from pydantic import ValidationError

from app.core.config import Environment
from tests.conftest import make_settings


def test_requires_psycopg_driver() -> None:
    with pytest.raises(ValidationError, match="postgresql\\+psycopg"):
        make_settings(database_url="postgresql://localhost/petfinity_test")


def test_cors_origins_parsed_from_comma_separated_string() -> None:
    settings = make_settings(cors_allow_origins="http://localhost:8081, https://admin.example.com")
    assert settings.cors_allow_origins == ["http://localhost:8081", "https://admin.example.com"]


def test_invalid_log_level_rejected() -> None:
    with pytest.raises(ValidationError):
        make_settings(log_level="LOUD")


def test_production_rejects_wildcard_cors() -> None:
    with pytest.raises(ValidationError, match="wildcard"):
        make_settings(app_env=Environment.PRODUCTION, log_json=True, cors_allow_origins="*")


def test_production_requires_json_logs() -> None:
    with pytest.raises(ValidationError, match="LOG_JSON"):
        make_settings(app_env=Environment.PRODUCTION, log_json=False)


def test_migration_url_falls_back_to_database_url() -> None:
    settings = make_settings()
    assert settings.migration_database_url == str(settings.database_url)

    direct = "postgresql+psycopg://direct@localhost:5432/petfinity_test"
    assert make_settings(database_migration_url=direct).migration_database_url == direct


def test_api_docs_can_be_disabled() -> None:
    from fastapi.testclient import TestClient

    from app.main import create_app

    with TestClient(create_app(make_settings(enable_api_docs=False))) as client:
        assert client.get("/docs").status_code == 404
        assert client.get("/api/v1/openapi.json").status_code == 404


def test_mock_otp_sender_refused_in_hosted_environments() -> None:
    for env in (Environment.STAGING, Environment.PRODUCTION):
        with pytest.raises(ValidationError, match="mock console OTP sender"):
            make_settings(app_env=env, log_json=True)


def test_auth_secrets_must_be_long() -> None:
    with pytest.raises(ValidationError):
        make_settings(jwt_secret="short")
    with pytest.raises(ValidationError):
        make_settings(otp_pepper="short")


def test_staff_lists_are_normalised() -> None:
    settings = make_settings(
        bootstrap_admin_emails=" Founder@Gmail.com ,", staff_email_domains="@Petfinity.in, x.org"
    )
    assert settings.bootstrap_admin_emails == ["founder@gmail.com"]
    assert settings.staff_email_domains == ["petfinity.in", "x.org"]
