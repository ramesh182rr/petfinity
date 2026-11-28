# Phase 3 — Caretaker marketplace

**Started:** 2026-11-27 (approved by the product owner)
**Status:** 3.1–3.3 complete (2026-11-28). 3.4 (parent app: request and compare) is next.
**Goal:** a pet parent can post a care request, compare offers from verified caretakers nearby, accept one and get the care. The caretaker can manage the booking from check-in to completion, and the parent can review it afterwards.
**Decisions it builds on:** 0004, 0005, 0006, 0011, 0012, 0013, 0014, and **0015** (care types, open requests, 48-hour cancellation).

| # | Milestone | Scope | Depends on |
|---|---|---|---|
| 3.1 | Caretaker services and profile | Care services (4 types: rate, species, pets per booking), home and capacity details, service area, days off, identity plus address-proof verification. API and app (caretaker workspace) | — |
| 3.2 | Care requests (API) | Parent request: pets, care type, dates and times, area or pin (address private), needs and budget. Matching to eligible caretakers; 24-hour or 5-offer close; parent cancels | 3.1 |
| 3.3 | Offers and care bookings (API) | Caretaker offers (price, message), edit and withdraw. Accept creates a confirmed care booking (capacity units, mock payment, 48-hour/50% policy) and declines the rest. Address revealed after acceptance | 3.2 |
| 3.4 | Parent app: request and compare | "Find a caretaker" request flow, My requests, offer comparison (verification, rating, price, experience), accept and pay (mock), care booking detail | 3.3 |
| 3.5 | Caretaker app: requests and bookings | Nearby request feed, offer composer, my offers, care booking inbox with check-in, check-out and decline | 3.3 |
| 3.6 | Care updates, notifications, reviews | Check-in and check-out with short updates, notifications for every request, offer and booking event, reviews of caretakers (0014), admin support view of care bookings | 3.4, 3.5 |

**Safety rules for this phase (doc 13, 0015):**
- Only verified, active caretakers see requests or send offers.
- Exact addresses and names are shared only after acceptance.
- Caretaker cancellations always refund in full and are tracked.
