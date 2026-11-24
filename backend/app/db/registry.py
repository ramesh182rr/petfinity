"""Imports every model module so `Base.metadata` is complete.

Used by Alembic (autogenerate) and the model/migration drift test. Add new model
modules here.
"""

from app.db.base import Base
from app.modules.audit import models as audit_models
from app.modules.auth import models as auth_models
from app.modules.staff import models as staff_models
from app.modules.users import models as users_models

__all__ = ["Base", "audit_models", "auth_models", "staff_models", "users_models"]
