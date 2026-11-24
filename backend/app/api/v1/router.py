"""Aggregates module routers under `/api/v1`.

Each feature module (auth, pets, providers, bookings, ...) owns its router and is
registered here; modules never import each other's internals.
"""

from fastapi import APIRouter

from app.modules.auth.router import router as auth_router
from app.modules.clinics.router import router as clinics_router
from app.modules.health.router import router as health_router
from app.modules.pets.router import router as pets_router
from app.modules.providers.router import router as providers_router
from app.modules.staff.router import router as staff_router
from app.modules.users.router import router as users_router
from app.modules.verification.router import router as verification_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(staff_router)
api_router.include_router(pets_router)
api_router.include_router(providers_router)
api_router.include_router(clinics_router)
api_router.include_router(verification_router)
