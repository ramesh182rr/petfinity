"""Current user endpoints."""

from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, DbSession
from app.modules.users import service
from app.modules.users.models import User
from app.modules.users.schemas import MeResponse, MeUpdate

router = APIRouter(prefix="/me", tags=["me"])


def to_me_response(db: Session, user: User) -> MeResponse:
    return MeResponse(
        id=user.id,
        display_name=user.display_name,
        email=user.email,
        email_verified=user.email_verified_at is not None,
        phone=user.phone,
        phone_verified=user.phone_verified_at is not None,
        capabilities=service.capabilities(db, user),
        created_at=user.created_at,
    )


@router.get("", response_model=MeResponse, summary="Current user profile and capabilities")
def get_me(db: DbSession, user: CurrentUser) -> MeResponse:
    return to_me_response(db, user)


@router.patch("", response_model=MeResponse, summary="Update current user profile")
def update_me(body: MeUpdate, db: DbSession, user: CurrentUser) -> MeResponse:
    service.update_profile(db, user, display_name=body.display_name)
    db.commit()
    db.refresh(user)
    return to_me_response(db, user)
