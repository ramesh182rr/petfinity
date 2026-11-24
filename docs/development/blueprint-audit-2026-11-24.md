# Blueprint audit — 2026-11-24

Findings from the initial project audit. Resolved items link to a decision. Open items should be closed (and removed from here) as the matching phase begins.

## Resolved
| Finding | Resolution |
|---|---|
| Docs specified separate repositories | Monorepo; [decision 0001](../decisions/0001-monorepo.md) |
| Doc 08 palette (violet + mint) vs brief (sage) vs moodboard (plum + sage) | Moodboard-aligned; [decision 0002](../decisions/0002-brand-palette.md). Tokens set in Milestone 1.4 |
| Doc 04 "Foundation" includes auth/pets; brief limits Phase 1 | Phase 1 / 1b split; [decision 0003](../decisions/0003-phase-1-scope.md) |
| Blueprint README referenced a ZIP and old paths | Paths updated in `00_Blueprint_README.md` |
| Booking diagram (instant) vs PRD statuses (`requested`) | Instant or request per service, unified status model; [decision 0004](../decisions/0004-booking-confirmation-model.md) |
| Separate `appointments` and `bookings` tables/APIs | Single `bookings` record; "appointment" is UI wording; [decision 0005](../decisions/0005-unified-bookings.md) |
| PRD roles vs `user_roles(owner/provider/admin)` | Unified account with additive capabilities and audited staff roles; [decision 0006](../decisions/0006-identity-roles-and-permissions.md) |
| `api_collection.json` empty placeholder | Contract is now `backend/openapi.json`, exported from FastAPI and checked by a test |
| `.env.example` mixed backend and client values | Split into `backend/.env.example` and `mobile/.env.example`. The original stays in `docs/templates/` for reference |

## Gaps (to close in the phase that needs them)
- No per-feature acceptance checklists or analytics event definitions (required by the PRD's acceptance principle). Write them at the start of each feature milestone.
- No state-transition tables for caretaker requests and offers. Bookings are covered by decision 0004. *Phase 3.*
- Error-code catalogue: the Phase 1 codes are in doc 12; extend it per feature. No analytics or error-monitoring provider has been chosen. *Phase 1b.*
- `assets/ui_reference/` doesn't exist, and there are no production logo or app-icon files. The moodboard is AI-generated reference art, so the app uses a placeholder icon.

## Risks to track
- **Stripe in India:** onboarding for new Indian businesses has been restricted (invite-only), and marketplace payouts are limited. Re-check before Phase 7. Keep the `PaymentProvider` abstraction; Razorpay Route or Cashfree are candidates.
- **Free-tier cold starts:** Render (sleeps when idle) and Neon (scales to zero). Acceptable for development; budget paid tiers before the pilot.
- **Neon pooling:** use the direct URL for Alembic (`DATABASE_MIGRATION_URL`) and the pooled URL for the app with `DATABASE_PGBOUNCER=true`, which disables psycopg prepared statements.
- **Double booking:** use Postgres exclusion constraints plus idempotency keys, with tests on real Postgres.
- **Brand clearance:** the name, logo and icon are not cleared. Branding is token-driven and replaceable.
