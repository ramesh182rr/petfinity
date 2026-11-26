"""Launch areas and distance helpers (decision 0011).

The list lives in code, not the database: it changes rarely, needs review when it
does, and the app gets it from `GET /discover/areas`. Adding a city means adding a
member to `AreaKey` and an entry to `LAUNCH_AREAS`, with no migration.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from decimal import Decimal
from enum import StrEnum

from app.core.errors import AppError


class AreaKey(StrEnum):
    CHENNAI = "chennai"
    COIMBATORE = "coimbatore"
    MADURAI = "madurai"
    TIRUCHIRAPPALLI = "tiruchirappalli"
    SALEM = "salem"
    KOCHI = "kochi"
    THIRUVANANTHAPURAM = "thiruvananthapuram"
    KOZHIKODE = "kozhikode"
    THRISSUR = "thrissur"
    BENGALURU = "bengaluru"


@dataclass(frozen=True)
class LaunchArea:
    key: AreaKey
    name: str
    state: str
    latitude: float
    longitude: float
    aliases: tuple[str, ...] = ()


LAUNCH_AREAS: tuple[LaunchArea, ...] = (
    LaunchArea(AreaKey.CHENNAI, "Chennai", "Tamil Nadu", 13.0827, 80.2707, ("madras",)),
    LaunchArea(AreaKey.COIMBATORE, "Coimbatore", "Tamil Nadu", 11.0168, 76.9558, ("kovai",)),
    LaunchArea(AreaKey.MADURAI, "Madurai", "Tamil Nadu", 9.9252, 78.1198),
    LaunchArea(
        AreaKey.TIRUCHIRAPPALLI,
        "Tiruchirappalli",
        "Tamil Nadu",
        10.7905,
        78.7047,
        ("trichy", "tiruchirapalli", "tiruchy"),
    ),
    LaunchArea(AreaKey.SALEM, "Salem", "Tamil Nadu", 11.6643, 78.1460),
    LaunchArea(AreaKey.KOCHI, "Kochi", "Kerala", 9.9312, 76.2673, ("cochin", "ernakulam")),
    LaunchArea(
        AreaKey.THIRUVANANTHAPURAM,
        "Thiruvananthapuram",
        "Kerala",
        8.5241,
        76.9366,
        ("trivandrum",),
    ),
    LaunchArea(AreaKey.KOZHIKODE, "Kozhikode", "Kerala", 11.2588, 75.7804, ("calicut",)),
    LaunchArea(AreaKey.THRISSUR, "Thrissur", "Kerala", 10.5276, 76.2144, ("trichur",)),
    LaunchArea(AreaKey.BENGALURU, "Bengaluru", "Karnataka", 12.9716, 77.5946, ("bangalore",)),
)

AREAS: dict[AreaKey, LaunchArea] = {area.key: area for area in LAUNCH_AREAS}

DEFAULT_RADIUS_KM = 10
MAX_RADIUS_KM = 25
SERVICE_RADIUS_CHOICES = (5, 10, 15, 25)
DEFAULT_SERVICE_RADIUS_KM = 10
# Exact coordinates must fall within this distance of the chosen area's centre.
AREA_SPREAD_KM = 50.0

_EARTH_RADIUS_KM = 6371.0088


def distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle (haversine) distance in kilometres."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * _EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def area_for_city(city: str | None) -> AreaKey | None:
    """Match a free-text city (including old names) to a launch area."""
    if not city:
        return None
    needle = city.strip().lower()
    for area in LAUNCH_AREAS:
        if needle == area.name.lower() or needle in area.aliases:
            return area.key
    return None


def nearest_area(latitude: float, longitude: float) -> AreaKey | None:
    """The launch area whose centre is closest, if within `AREA_SPREAD_KM`."""
    best = min(
        LAUNCH_AREAS, key=lambda a: distance_km(latitude, longitude, a.latitude, a.longitude)
    )
    if distance_km(latitude, longitude, best.latitude, best.longitude) <= AREA_SPREAD_KM:
        return best.key
    return None


def resolve_area(
    area_key: str | None,
    latitude: Decimal | float | None,
    longitude: Decimal | float | None,
    city: str | None = None,
) -> str | None:
    """Validate a location and return the launch area to store.

    - Coordinates with an area must lie within `AREA_SPREAD_KM` of its centre
      (422 `location_outside_area`).
    - Coordinates without an area: the nearest launch area is inferred, if any.
    - Neither: the area is matched from the free-text city, if possible.
    """
    if latitude is None or longitude is None:
        if area_key is None:
            matched = area_for_city(city)
            return matched.value if matched else None
        return area_key
    lat, lng = float(latitude), float(longitude)
    if area_key is None:
        inferred = nearest_area(lat, lng)
        return inferred.value if inferred else None
    area = AREAS[AreaKey(area_key)]
    if distance_km(lat, lng, area.latitude, area.longitude) > AREA_SPREAD_KM:
        raise AppError(
            "location_outside_area",
            f"That location is more than {AREA_SPREAD_KM:.0f} km from {area.name}. "
            "Check the area or use your current location at the practice.",
            status_code=422,
        )
    return area_key
