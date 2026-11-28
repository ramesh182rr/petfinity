"""Aggregates module routers under `/api/v1`.

Each feature module (auth, pets, providers, bookings, ...) owns its router and is
registered here; modules never import each other's internals.
"""

from fastapi import APIRouter

from app.modules.auth.router import router as auth_router
from app.modules.auth.web_router import router as auth_web_router
from app.modules.bookings.router import manage_router as bookings_manage_router
from app.modules.bookings.router import router as bookings_router
from app.modules.care.router import router as care_router
from app.modules.catalog.router import router as catalog_router
from app.modules.clinics.router import router as clinics_router
from app.modules.discovery.router import router as discovery_router
from app.modules.health.router import router as health_router
from app.modules.notifications.router import router as notifications_router
from app.modules.pets.router import router as pets_router
from app.modules.providers.router import router as providers_router
from app.modules.reviews.router import admin_router as reviews_admin_router
from app.modules.reviews.router import router as reviews_router
from app.modules.staff.router import router as staff_router
from app.modules.users.router import router as users_router
from app.modules.verification.admin_router import router as verification_admin_router
from app.modules.verification.router import router as verification_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(auth_web_router)
api_router.include_router(users_router)
api_router.include_router(staff_router)
api_router.include_router(pets_router)
api_router.include_router(providers_router)
api_router.include_router(clinics_router)
api_router.include_router(catalog_router)
api_router.include_router(care_router)
api_router.include_router(discovery_router)
api_router.include_router(bookings_router)
api_router.include_router(bookings_manage_router)
api_router.include_router(notifications_router)
api_router.include_router(reviews_router)
api_router.include_router(reviews_admin_router)
api_router.include_router(verification_router)
api_router.include_router(verification_admin_router)
