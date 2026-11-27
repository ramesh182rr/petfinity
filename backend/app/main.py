"""FastAPI application factory.

Run locally:  uv run fastapi dev app/main.py   (or: uv run uvicorn app.main:app --reload)
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import Settings, get_settings
from app.core.errors import ErrorResponse, register_error_handlers
from app.core.logging import configure_logging
from app.core.request_id import REQUEST_ID_HEADER, RequestIdMiddleware
from app.db.session import create_db_engine, create_session_factory
from app.modules.auth.otp_delivery import OtpSender, create_otp_sender
from app.modules.notifications.push import PushSender, create_push_sender
from app.modules.storage.base import ObjectStorage
from app.modules.storage.dev_router import router as dev_storage_router
from app.modules.storage.factory import create_storage
from app.modules.storage.local import LocalStorage


def create_app(
    settings: Settings | None = None,
    *,
    otp_sender: OtpSender | None = None,
    storage: ObjectStorage | None = None,
    push_sender: PushSender | None = None,
) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings)

    engine = create_db_engine(settings)  # lazy: no connection until first use

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        yield
        engine.dispose()

    docs_enabled = settings.enable_api_docs
    app = FastAPI(
        title="Petfinity API",
        version=settings.app_version,
        summary="Every paw. Every need. Every connection.",
        lifespan=lifespan,
        docs_url="/docs" if docs_enabled else None,
        redoc_url=None,
        openapi_url=f"{settings.api_v1_prefix}/openapi.json" if docs_enabled else None,
        responses={422: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    )
    app.state.settings = settings
    app.state.engine = engine
    app.state.session_factory = create_session_factory(engine)
    app.state.otp_sender = otp_sender or create_otp_sender(settings)
    app.state.storage = storage or create_storage(settings)
    app.state.push_sender = push_sender or create_push_sender(settings)

    register_error_handlers(app)

    if settings.cors_allow_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_allow_origins,
            allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            allow_credentials=settings.cors_allow_credentials,
            allow_headers=[
                "Authorization",
                "Content-Type",
                "Idempotency-Key",
                "X-Requested-With",
                REQUEST_ID_HEADER,
            ],
            expose_headers=[REQUEST_ID_HEADER],
        )
    # Added last so it is the outermost user middleware.
    app.add_middleware(RequestIdMiddleware)

    app.include_router(api_router, prefix=settings.api_v1_prefix)
    if isinstance(app.state.storage, LocalStorage):
        # Dev-only bucket emulation; settings forbid local storage in staging/production.
        app.include_router(dev_storage_router, prefix=settings.api_v1_prefix)
    return app


def __getattr__(name: str) -> FastAPI:
    # Lazy module attribute so `uvicorn app.main:app` works while importing this
    # module (e.g. in tests) does not require environment configuration.
    if name == "app":
        return create_app()
    raise AttributeError(name)
