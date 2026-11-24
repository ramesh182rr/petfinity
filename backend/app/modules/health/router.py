"""Health checks.

- `/health`: liveness. Cheap, never touches dependencies (used by Render's health check).
- `/health/ready`: readiness. Verifies the database is reachable.
"""

from __future__ import annotations

import logging
from typing import Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel
from sqlalchemy import Engine, text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import Settings
from app.core.errors import AppError, ErrorResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/health", tags=["health"])


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    version: str


class ReadinessResponse(BaseModel):
    status: Literal["ready"]
    checks: dict[str, Literal["ok"]]


@router.get("", response_model=HealthResponse, summary="Liveness check")
def health(request: Request) -> HealthResponse:
    settings: Settings = request.app.state.settings
    return HealthResponse(status="ok", service=settings.app_name, version=settings.app_version)


@router.get(
    "/ready",
    response_model=ReadinessResponse,
    summary="Readiness check (database)",
    responses={503: {"model": ErrorResponse, "description": "A dependency is unavailable"}},
)
def readiness(request: Request) -> ReadinessResponse:
    engine: Engine = request.app.state.engine
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        # Log the exception type only; connection errors can include host details.
        logger.warning("readiness_database_failed", extra={"error_type": type(exc).__name__})
        raise AppError(
            "not_ready",
            "Service dependencies are unavailable.",
            status_code=503,
            details={"database": "unavailable"},
        ) from exc
    return ReadinessResponse(status="ready", checks={"database": "ok"})
