"""Application settings, loaded from environment variables (and `.env` locally).

Settings are validated at startup so a misconfigured deployment fails fast
instead of failing on the first request.
"""

from __future__ import annotations

from enum import StrEnum
from functools import lru_cache
from typing import Annotated

from pydantic import Field, PostgresDsn, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

from app import __version__


class Environment(StrEnum):
    LOCAL = "local"
    TEST = "test"
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


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

    @field_validator("cors_allow_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
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
        if self.app_env is Environment.PRODUCTION:
            if "*" in self.cors_allow_origins:
                raise ValueError("wildcard CORS origins are not allowed in production")
            if not self.log_json:
                raise ValueError("LOG_JSON must be true in production")
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
