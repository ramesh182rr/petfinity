"""Database engine and session management (SQLAlchemy 2.x, psycopg 3, sync).

Endpoints that use the database are plain `def` functions; FastAPI runs them in
its threadpool, which keeps the data layer simple and easy to test.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

from fastapi import Request
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings


def create_db_engine(settings: Settings, *, url: str | None = None) -> Engine:
    connect_args: dict[str, Any] = {
        "connect_timeout": settings.database_connect_timeout_seconds,
        "application_name": settings.app_name,
    }
    if settings.database_pgbouncer:
        # PgBouncer in transaction mode cannot track server-side prepared statements.
        connect_args["prepare_threshold"] = None

    return create_engine(
        url or str(settings.database_url),
        pool_size=settings.database_pool_size,
        max_overflow=settings.database_max_overflow,
        pool_timeout=settings.database_pool_timeout_seconds,
        pool_pre_ping=True,  # survive Neon scale-to-zero / idle disconnects
        pool_recycle=300,
        connect_args=connect_args,
    )


def create_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db(request: Request) -> Iterator[Session]:
    """FastAPI dependency: one session per request, always closed.

    Services decide when to commit; anything uncommitted is rolled back on close.
    """
    session_factory: sessionmaker[Session] = request.app.state.session_factory
    session = session_factory()
    try:
        yield session
    finally:
        session.close()
