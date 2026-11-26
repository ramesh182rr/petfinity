# 0011 — Launch areas, provider locations and discovery radius

- **Date:** 2026-11-26
- **Status:** Accepted
- **Owner:** Product owner
- **Resolves:** Open Decision #1 (launch areas and initial service radii)

## Context
Discovery (milestone 2.5) needs to know where pet parents search from and where providers are. Decision 0010 chose a list-first discovery and a Google map pin, but there is no Maps key yet and paid geocoding is deferred.

## Decision
- **Launch areas (10 cities):**
  - Tamil Nadu: Chennai, Coimbatore, Madurai, Tiruchirappalli, Salem
  - Kerala: Kochi, Thiruvananthapuram, Kozhikode, Thrissur
  - Karnataka: Bengaluru

  Each area has a centre point. The list lives in code (`backend/app/modules/discovery/areas.py`) and is served by `GET /discover/areas`. Adding a city is a code change, not a migration.
- **Search radius:** default 10 km, with 5, 10, 15 or 25 km offered (25 km is the API maximum). Parents search from a chosen area's centre or from their device ("near me"). Device coordinates are only sent as query parameters and never stored.
- **Provider location without a Maps key:** clinics and vets pick a launch area, and can tap "Use my current location" (device GPS, free) to pin the exact point.
  - Without a pin, distance is measured from the area's centre and shown as approximate (`~`).
  - Pins must be within 50 km of the chosen area's centre.
  - If no area is given, it is inferred from the pin or the city name.
  - A map pin can replace or refine this once the Maps key exists (0010).
- **Home-visit vets (no clinic needed):**
  - A vet sets a base location and a travel radius: 5, 10, 15 or 25 km (default 10).
  - They appear to parents inside that radius.
  - The base coordinates are private: the public API returns only the area name and the radius, never a distance or coordinates.

## Alternatives considered
- **6 core cities, or 3 metros only.** Rejected by the product owner in favour of the wider list.
- **Area centre only.** Distances would always be approximate.
- **An admin sets coordinates during review.** This adds work for every review.
- **Clinics only in 2.5.** Rejected: home-visit vets are part of the launch offer.

## Consequences
- Migration 0006 adds:
  - `clinics.area_key`
  - `provider_profiles.area_key`, `latitude`, `longitude` and `service_radius_km`
  - a backfill that maps existing city names to areas
- Distance uses haversine in Python after a bounding-box or area pre-filter in SQL. PostGIS can come later if listing volume needs it.
- The app requests foreground location only ("while using the app"), with no background tracking.
