# 0010 — Maps: Google Maps, list-first discovery

- **Date:** 2026-11-25
- **Status:** Accepted
- **Owner:** Product owner
- **Resolves:** Open Decision #3

## Decision
- **Map display:** `react-native-maps` with the Google provider on Android (Apple Maps or Google on iOS, decided at iOS QA). Native mobile map display has no per-load charge, but this must be re-checked against Google's pricing at launch.
- **Discovery is list-first:** results are sorted by distance using latitude/longitude stored on clinics and providers. The map view is an alternative presentation of the same API results.
- **Location without paid lookups at launch:**
  - Owners choose a launch city/area from a curated list (Tamil Nadu, Kerala, Bengaluru clusters), or use device location ("near me").
  - Providers set their location with a map pin. Their address is entered as text.
- **Paid Google APIs** (Geocoding, Places autocomplete) are added only behind a server-side adapter, with per-day caps and caching, and only when needed.
- **Keys:**
  - An Android Maps SDK key restricted to the app's package name and signing certificate, injected through `app.config` from an environment variable at build time, never committed.
  - A separate server key (IP-restricted) for any server-side APIs.
- **Privacy:** an owner's exact home location is never shown on maps. Caretaker service areas are shown approximately (decision 0006, doc 13).

## Needed from the product owner (before the map view milestone)
- A Google Cloud project with the Maps SDK for Android enabled, and a restricted API key.
