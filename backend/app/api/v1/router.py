"""Aggregates module routers under `/api/v1`.

Each feature module (auth, pets, providers, bookings, ...) owns its router and is
registered here; modules never import each other's internals.
"""

from fastapi import APIRouter

from app.modules.auth.router import router as auth_router
from app.modules.health.router import router as health_router
from app.modules.staff.router import router as staff_router
from app.modules.users.router import router as users_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(staff_router)
