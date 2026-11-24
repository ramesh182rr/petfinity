"""Application settings, loaded from environment variables (and `.env` locally).

Settings are validated at startup so a misconfigured deployment fails fast
instead of failing on the first request.
"""

from __future__ import annotations

from enum import StrEnum
from functools import lru_cache
from typing import Annotated

from pydantic import Field, PostgresDsn, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

from app import __version__


class Environment(StrEnum):
    LOCAL = "local"
    TEST = "test"
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


class OtpDelivery(StrEnum):
    # MOCK: writes codes to the server log. Refused in staging/production.
    CONSOLE = "console"


class StorageBackend(StrEnum):
    # Files on the API server's disk, served through signed /dev-storage URLs.
    # Development only; refused in staging/production.
    LOCAL = "local"
    # Cloudflare R2 (S3-compatible) with presigned URLs.
    R2 = "r2"


HOSTED_ENVIRONMENTS = {Environment.STAGING, Environment.PRODUCTION}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_env: Environment = Environment.LOCAL
    app_name: str = "petfinity-api"
    app_version: str = __version__
    api_v1_prefix: str = "/api/v1"

    # Logging
    log_level: str = "INFO"
    log_json: bool = False

    # Database — the app uses DATABASE_URL (pooled endpoint in hosted envs).
    # Alembic prefers DATABASE_MIGRATION_URL (direct endpoint) when set.
    database_url: PostgresDsn
    database_migration_url: PostgresDsn | None = None
    database_pool_size: int = Field(default=5, ge=1, le=50)
    database_max_overflow: int = Field(default=5, ge=0, le=50)
    database_pool_timeout_seconds: float = Field(default=10.0, gt=0)
    database_connect_timeout_seconds: int = Field(default=5, ge=1, le=60)
    # True when connecting through PgBouncer in transaction mode (e.g. Neon pooled
    # endpoint): disables server-side prepared statements.
    database_pgbouncer: bool = False

    # HTTP
    cors_allow_origins: Annotated[list[str], NoDecode] = Field(default_factory=list)
    enable_api_docs: bool = True

    # Authentication (decision 0007)
    jwt_secret: SecretStr = Field(min_length=32)
    jwt_issuer: str = "petfinity-api"
    jwt_audience: str = "petfinity-app"
    access_token_ttl_seconds: int = Field(default=900, ge=60, le=3600)
    refresh_token_ttl_days: int = Field(default=30, ge=1, le=90)
    refresh_token_absolute_ttl_days: int = Field(default=90, ge=1, le=365)
    otp_pepper: SecretStr = Field(min_length=32)
    otp_delivery: OtpDelivery = OtpDelivery.CONSOLE
    otp_ttl_seconds: int = Field(default=600, ge=60, le=1800)
    otp_max_attempts: int = Field(default=5, ge=1, le=10)
    otp_resend_cooldown_seconds: int = Field(default=60, ge=0, le=600)
    otp_max_per_destination_per_hour: int = Field(default=5, ge=1, le=50)
    otp_max_per_ip_per_hour: int = Field(default=20, ge=1, le=500)

    # Media storage (decision 0008)
    storage_backend: StorageBackend = StorageBackend.LOCAL
    storage_local_dir: str = ".local-storage"
    r2_account_id: str | None = None
    r2_bucket: str | None = None
    r2_access_key_id: str | None = None
    r2_secret_access_key: SecretStr | None = None
    r2_endpoint_url: str | None = (
        None  # override; default https://<account>.r2.cloudflarestorage.com
    )
    media_max_image_bytes: int = Field(default=8_000_000, ge=100_000, le=25_000_000)
    media_upload_url_ttl_seconds: int = Field(default=600, ge=60, le=3600)
    media_download_url_ttl_seconds: int = Field(default=3600, ge=60, le=86_400)

    # Pets
    max_pets_per_owner: int = Field(default=30, ge=1, le=200)

    # Staff roles (decision 0006)
    bootstrap_admin_emails: Annotated[list[str], NoDecode] = Field(default_factory=list)
    staff_email_domains: Annotated[list[str], NoDecode] = Field(default_factory=list)

    @field_validator("cors_allow_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator(
        "r2_account_id",
        "r2_bucket",
        "r2_access_key_id",
        "r2_secret_access_key",
        "r2_endpoint_url",
        mode="before",
    )
    @classmethod
    def _blank_r2_is_unset(cls, value: object) -> object:
        return None if isinstance(value, str) and not value.strip() else value

    @field_validator("bootstrap_admin_emails", "staff_email_domains", mode="before")
    @classmethod
    def _split_lowercase(cls, value: object) -> object:
        if isinstance(value, str):
            value = value.split(",")
        if isinstance(value, list):
            return [str(item).strip().lower().lstrip("@") for item in value if str(item).strip()]
        return value

    @field_validator("log_level")
    @classmethod
    def _valid_log_level(cls, value: str) -> str:
        level = value.upper()
        if level not in {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}:
            raise ValueError(f"invalid log level: {value}")
        return level

    @field_validator("database_migration_url", mode="before")
    @classmethod
    def _blank_is_unset(cls, value: object) -> object:
        return None if isinstance(value, str) and not value.strip() else value

    @field_validator("database_url", "database_migration_url")
    @classmethod
    def _psycopg_driver(cls, value: PostgresDsn | None) -> PostgresDsn | None:
        if value is not None and value.scheme != "postgresql+psycopg":
            raise ValueError("database URLs must use the 'postgresql+psycopg://' scheme")
        return value

    @model_validator(mode="after")
    def _production_guards(self) -> Settings:
        if self.refresh_token_absolute_ttl_days < self.refresh_token_ttl_days:
            raise ValueError("REFRESH_TOKEN_ABSOLUTE_TTL_DAYS must be >= REFRESH_TOKEN_TTL_DAYS")
        if self.storage_backend is StorageBackend.R2:
            missing = [
                name
                for name in (
                    "r2_account_id",
                    "r2_bucket",
                    "r2_access_key_id",
                    "r2_secret_access_key",
                )
                if getattr(self, name) is None
            ]
            if missing:
                names = ", ".join(name.upper() for name in missing)
                raise ValueError(f"STORAGE_BACKEND=r2 requires {names}")
        if self.app_env is Environment.PRODUCTION:
            if "*" in self.cors_allow_origins:
                raise ValueError("wildcard CORS origins are not allowed in production")
            if not self.log_json:
                raise ValueError("LOG_JSON must be true in production")
        if self.app_env in HOSTED_ENVIRONMENTS and self.storage_backend is StorageBackend.LOCAL:
            raise ValueError("local file storage is not allowed in staging/production; use r2")
        if self.app_env in HOSTED_ENVIRONMENTS and self.otp_delivery is OtpDelivery.CONSOLE:
            raise ValueError("the mock console OTP sender is not allowed in staging/production")
        return self

    @property
    def is_production(self) -> bool:
        return self.app_env is Environment.PRODUCTION

    @property
    def migration_database_url(self) -> str:
        return str(self.database_migration_url or self.database_url)


@lru_cache
def get_settings() -> Settings:
    return Settings()  # values come from the environment
