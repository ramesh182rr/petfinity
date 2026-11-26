"""Imports every model module so `Base.metadata` is complete.

Used by Alembic (autogenerate) and the model/migration drift test. Add new model
modules here.
"""

from app.db.base import Base
from app.modules.audit import models as audit_models
from app.modules.auth import models as auth_models
from app.modules.bookings import models as bookings_models
from app.modules.catalog import models as catalog_models
from app.modules.clinics import models as clinics_models
from app.modules.media import models as media_models
from app.modules.pets import models as pets_models
from app.modules.providers import models as providers_models
from app.modules.staff import models as staff_models
from app.modules.users import models as users_models
from app.modules.verification import models as verification_models

__all__ = [
    "Base",
    "audit_models",
    "auth_models",
    "bookings_models",
    "catalog_models",
    "clinics_models",
    "media_models",
    "pets_models",
    "providers_models",
    "staff_models",
    "users_models",
    "verification_models",
]
