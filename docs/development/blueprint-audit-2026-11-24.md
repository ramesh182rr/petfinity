# Blueprint audit — 2026-11-24

Findings from the initial project audit. Resolved items link to a decision. Open items should be closed (and removed from here) as the matching phase begins.

## Resolved
| Finding | Resolution |
|---|---|
| Docs specified separate repositories | Monorepo; [decision 0001](../decisions/0001-monorepo.md) |
| Doc 08 palette (violet + mint) vs brief (sage) vs moodboard (plum + sage) | Moodboard-aligned; [decision 0002](../decisions/0002-brand-palette.md) |
| Doc 04 "Foundation" includes auth/pets; brief limits Phase 1 | Phase 1 / 1b split; [decision 0003](../decisions/0003-phase-1-scope.md) |
| Blueprint README referenced a ZIP and old paths | Paths updated in `00_Blueprint_README.md` |

## Open contradictions
1. **Booking confirmation model.** `diagrams/booking_flow.mmd` goes straight to "Booking Confirmed" (instant booking). The PRD's appointment statuses begin at `requested` (provider confirms). Open Decision #5. *Needed before Phase 2.*
2. **Appointments vs bookings.** Doc 11 has both `appointments` and `bookings` (bookings reference an appointment or an offer). Doc 12 books via `/appointments` but attaches payment to `/bookings`. Choose one canonical booking record for payments, reviews and cancellations. *Needed before Phase 2.*
3. **Role model.** The PRD lists veterinarian, clinic operator, caretaker, admin and moderator. Doc 11's `user_roles` has only owner/provider/admin. Likely shape: `role` plus `provider_type`, with `moderator` added. *Needed in Phase 1b.*

## Gaps
- No per-feature acceptance checklists or analytics event definitions (required by the PRD's acceptance principle).
- No documented state-transition tables for appointments, caretaker offers or bookings.
- No error-code catalogue; no analytics or error-monitoring provider chosen.
- `docs/templates/.env.example` mixes backend secrets with values that will be client-side (`MAPS_API_KEY`). It will be split into `backend/.env.example` and `mobile/.env.example`.
- `docs/templates/api_collection.json` is an empty placeholder. FastAPI OpenAPI will replace it.
- `assets/ui_reference/` is referenced but doesn't exist. There are no production logo or app-icon files (the moodboard is AI-generated reference art).

## Risks to track
- **Stripe in India:** onboarding for new Indian businesses has been restricted (invite-only), and marketplace payouts are limited. Re-check before Phase 7. Keep the `PaymentProvider` abstraction; Razorpay Route or Cashfree are candidates.
- **Free-tier cold starts:** Render (sleeps when idle) and Neon (scales to zero). Acceptable for development; budget paid tiers before the pilot.
- **Neon pooling:** use the direct URL for Alembic and the pooled URL for the app, with psycopg prepared statements disabled on the pooled connection.
- **Double booking:** use Postgres exclusion constraints plus idempotency keys, with tests on real Postgres.
- **Brand clearance:** the name, logo and icon are not cleared. Keep branding token-driven and replaceable.
