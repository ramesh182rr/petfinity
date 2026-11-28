"""Demo discovery data for local development (milestone 2.5).

    uv run python -m app.dev.seed_demo

Creates a few verified clinics and home-visit vets in Chennai, Kochi and
Bengaluru so Discover has something to show. Every demo account uses a
`demo-…@petfinity.dev` email; running it again changes nothing. Refuses to run
outside APP_ENV=local/development.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass, field
from datetime import time
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

import app.db.registry  # noqa: F401 - registers every model's mapper
from app.core.clock import utcnow
from app.core.config import Environment, get_settings
from app.db.session import create_db_engine, create_session_factory
from app.modules.care.models import CareService
from app.modules.catalog.models import AvailabilityRule, Service
from app.modules.clinics.models import Clinic, ClinicMember, MemberRole
from app.modules.providers.models import ProviderProfile, ProviderType
from app.modules.users.models import User

WEEKDAY_HOURS = [(time(9), time(13)), (time(16), time(20))]
SUNDAY_HOURS = [(time(10), time(13))]
ALL_DAY = [(time(0), time(23, 55))]


@dataclass
class DemoService:
    category: str
    title: str
    rupees: int
    minutes: int
    mode: str = "in_clinic"


@dataclass
class DemoClinic:
    slug: str
    name: str
    locality: str
    city: str
    state: str
    pin: str
    area: str
    lat: str | None
    lng: str | None
    emergency: bool = False
    all_day: bool = False
    description: str | None = None
    services: list[DemoService] = field(default_factory=list)


@dataclass
class DemoVet:
    slug: str
    name: str
    area: str
    city: str
    lat: str
    lng: str
    radius: int
    years: int
    languages: list[str]
    council: str
    services: list[DemoService] = field(default_factory=list)


CONSULT = DemoService("general_consultation", "Consultation", 500, 30)
VACCINE = DemoService("vaccination", "Vaccination", 700, 20)

CLINICS = [
    DemoClinic(
        "adyar",
        "Lotus Pet Clinic",
        "Adyar",
        "Chennai",
        "Tamil Nadu",
        "600020",
        "chennai",
        "13.006700",
        "80.257500",
        description="Friendly neighbourhood clinic for dogs and cats, with an in-house lab.",
        services=[
            CONSULT,
            VACCINE,
            DemoService("dental", "Dental cleaning", 2500, 60),
            DemoService("blood_test", "Blood test", 900, 15),
        ],
    ),
    DemoClinic(
        "annanagar",
        "Marigold Veterinary Hospital",
        "Anna Nagar",
        "Chennai",
        "Tamil Nadu",
        "600040",
        "chennai",
        "13.085000",
        "80.210100",
        emergency=True,
        all_day=True,
        description="24-hour hospital with surgery, imaging and emergency care.",
        services=[
            DemoService("emergency", "Emergency visit", 1500, 30),
            DemoService("surgery", "Surgery consult", 1200, 30),
            DemoService("imaging", "X-ray", 1800, 30),
            CONSULT,
        ],
    ),
    DemoClinic(
        "tnagar",
        "Paw Corner Clinic",
        "T. Nagar",
        "Chennai",
        "Tamil Nadu",
        "600017",
        "chennai",
        None,
        None,
        services=[
            DemoService("general_consultation", "Consultation", 400, 20),
            DemoService("deworming", "Deworming", 300, 15),
        ],
    ),
    DemoClinic(
        "kochi",
        "Backwater Pets",
        "Kadavanthra",
        "Kochi",
        "Kerala",
        "682020",
        "kochi",
        "9.966000",
        "76.298000",
        services=[CONSULT, VACCINE],
    ),
    DemoClinic(
        "indiranagar",
        "Jacaranda Animal Clinic",
        "Indiranagar",
        "Bengaluru",
        "Karnataka",
        "560038",
        "bengaluru",
        "12.971900",
        "77.641200",
        services=[
            CONSULT,
            DemoService("sterilisation", "Sterilisation", 6000, 120),
            DemoService("skin_ear", "Skin & ear check", 650, 30),
        ],
    ),
]

VETS = [
    DemoVet(
        "ananya",
        "Dr. Ananya Rao",
        "chennai",
        "Chennai",
        "13.040000",
        "80.233000",
        10,
        9,
        ["Tamil", "English"],
        "Tamil Nadu State Veterinary Council",
        services=[
            DemoService("general_consultation", "Home check-up", 900, 45, "home_visit"),
            DemoService("vaccination", "Home vaccination", 1100, 30, "home_visit"),
        ],
    ),
    DemoVet(
        "arjun",
        "Dr. Arjun Menon",
        "bengaluru",
        "Bengaluru",
        "12.935000",
        "77.624000",
        15,
        6,
        ["English", "Kannada", "Malayalam"],
        "Karnataka Veterinary Council",
        services=[DemoService("general_consultation", "Home check-up", 1000, 45, "home_visit")],
    ),
]


@dataclass
class DemoCaretaker:
    slug: str
    name: str
    lat: str
    lng: str
    years: int
    bio: str
    home_type: str
    services: list[tuple[str, int, list[str]]]  # care type, rupees, species


CARETAKERS = [
    DemoCaretaker(
        "meena",
        "Meena Subramanian",
        "13.000600",
        "80.266200",
        6,
        "Grew up with dogs; now host up to two guests in a quiet home with a garden.",
        "independent_house",
        [
            ("home_visit", 350, ["dog", "cat"]),
            ("day_care", 700, ["dog"]),
            ("boarding", 1000, ["dog", "cat"]),
        ],
    ),
    DemoCaretaker(
        "karthik",
        "Karthik Raman",
        "13.033900",
        "80.269600",
        3,
        "Cat person and night owl. Happy to house-sit and stick to your routine.",
        "apartment",
        [("home_visit", 300, ["cat", "dog"]), ("house_sitting", 1400, ["cat", "dog"])],
    ),
]


def _user(db: Session, slug: str, name: str) -> User:
    email = f"demo-{slug}@petfinity.dev"
    user = db.scalars(select(User).where(User.email == email)).first()
    if user is None:
        user = User(email=email, email_verified_at=utcnow(), display_name=name)
        db.add(user)
        db.flush()
    return user


def _hours(fk: dict[str, object], all_day: bool) -> list[AvailabilityRule]:
    rules = []
    for weekday in range(7):
        ranges = ALL_DAY if all_day else (SUNDAY_HOURS if weekday == 6 else WEEKDAY_HOURS)
        rules += [
            AvailabilityRule(weekday=weekday, start_time=s, end_time=e, capacity=2, **fk)
            for s, e in ranges
        ]
    return rules


def _services(fk: dict[str, object], items: list[DemoService]) -> list[Service]:
    return [
        Service(
            category=s.category,
            title=s.title,
            price_minor=s.rupees * 100,
            duration_minutes=s.minutes,
            service_mode=s.mode,
            confirmation_mode="instant" if s.mode == "in_clinic" else "request",
            species=["cat", "dog"],
            **fk,
        )
        for s in items
    ]


def seed(db: Session) -> int:
    created = 0
    for c in CLINICS:
        owner = _user(db, c.slug, f"{c.name} desk")
        if db.scalars(select(Clinic).where(Clinic.created_by_user_id == owner.id)).first():
            continue
        clinic = Clinic(
            name=c.name,
            description=c.description,
            phone="+914400000000",
            address_line1="1, Demo Street",
            locality=c.locality,
            city=c.city,
            state=c.state,
            postal_code=c.pin,
            area_key=c.area,
            latitude=Decimal(c.lat) if c.lat else None,
            longitude=Decimal(c.lng) if c.lng else None,
            emergency_services=c.emergency,
            created_by_user_id=owner.id,
            verification_status="verified",
            verified_at=utcnow(),
            status="active",
        )
        db.add(clinic)
        db.flush()
        db.add(
            ClinicMember(
                clinic_id=clinic.id,
                user_id=owner.id,
                member_role=MemberRole.OPERATOR,
                added_by_user_id=owner.id,
            )
        )
        fk: dict[str, object] = {"clinic_id": clinic.id}
        db.add_all(_services(fk, c.services))
        db.add_all(_hours(fk, c.all_day))
        created += 1
    for v in VETS:
        user = _user(db, v.slug, v.name)
        if db.scalars(select(ProviderProfile).where(ProviderProfile.user_id == user.id)).first():
            continue
        profile = ProviderProfile(
            user_id=user.id,
            provider_type=ProviderType.VETERINARIAN,
            display_name=v.name,
            bio="Gentle home visits for anxious pets and seniors.",
            years_experience=v.years,
            languages=v.languages,
            city=v.city,
            area_key=v.area,
            latitude=Decimal(v.lat),
            longitude=Decimal(v.lng),
            service_radius_km=v.radius,
            registration_number="DEMO/0001",
            registration_council=v.council,
            qualifications="B.V.Sc. & A.H.",
            verification_status="verified",
            verified_at=utcnow(),
            status="active",
        )
        db.add(profile)
        db.flush()
        fk = {"provider_profile_id": profile.id}
        db.add_all(_services(fk, v.services))
        db.add_all(_hours(fk, all_day=False))
        created += 1
    for ct in CARETAKERS:
        user = _user(db, ct.slug, ct.name)
        if db.scalars(select(ProviderProfile).where(ProviderProfile.user_id == user.id)).first():
            continue
        profile = ProviderProfile(
            user_id=user.id,
            provider_type=ProviderType.CARETAKER,
            display_name=ct.name,
            bio=ct.bio,
            years_experience=ct.years,
            languages=["Tamil", "English"],
            city="Chennai",
            area_key="chennai",
            latitude=Decimal(ct.lat),
            longitude=Decimal(ct.lng),
            service_radius_km=10,
            home_type=ct.home_type,
            outdoor_space=ct.home_type != "apartment",
            max_concurrent=2,
            verification_status="verified",
            verified_at=utcnow(),
            status="active",
        )
        db.add(profile)
        db.flush()
        db.add_all(
            CareService(
                provider_profile_id=profile.id,
                care_type=t,
                rate_minor=r * 100,
                species=sp,
                max_pets=2,
            )
            for t, r, sp in ct.services
        )
        created += 1
    return created


def main() -> int:
    settings = get_settings()
    if settings.app_env not in (Environment.LOCAL, Environment.DEVELOPMENT):
        print(f"Refusing to seed demo data in APP_ENV={settings.app_env}.", file=sys.stderr)
        return 1
    factory = create_session_factory(create_db_engine(settings))
    with factory() as db, db.begin():
        created = seed(db)
    print(f"Demo discovery data: {created} listing(s) created.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
