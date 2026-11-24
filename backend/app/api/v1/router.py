"""Aggregates module routers under `/api/v1`.

Each feature module (auth, pets, providers, bookings, ...) owns its router and is
registered here; modules never import each other's internals.
"""

from fastapi import APIRouter

from app.modules.health.router import router as health_router

api_router = APIRouter()
api_router.include_router(health_router)
