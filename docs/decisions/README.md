# Decision log

Each significant product or technical decision gets one numbered file. A decision is never edited to reverse it: a new record supersedes the old one, and the old one is marked as superseded.

| # | Decision | Date | Status |
|---|---|---|---|
| [0001](0001-monorepo.md) | Single monorepo with independent `mobile/` and `backend/` | 2026-11-24 | Accepted |
| [0002](0002-brand-palette.md) | Moodboard-aligned brand palette (plum primary, sage replaces mint) | 2026-11-24 | Accepted |
| [0003](0003-phase-1-scope.md) | Phase 1 is the technical foundation only; auth/pets move to Phase 1b | 2026-11-24 | Accepted |
| [0004](0004-booking-confirmation-model.md) | Booking confirmation: instant or request per service; unified status model | 2026-11-24 | Accepted |
| [0005](0005-unified-bookings.md) | One `bookings` record for vet and caretaker; "appointment" is UI wording | 2026-11-24 | Accepted |
| [0006](0006-identity-roles-and-permissions.md) | Unified account, additive capabilities, audited staff roles | 2026-11-24 | Accepted |
| [0007](0007-authentication.md) | Passwordless OTP sign-in via email or phone; rotating refresh tokens | 2026-11-24 | Accepted |
| [0008](0008-media-storage.md) | Media via signed URLs; `STORAGE_BACKEND` switch: local (dev) / Cloudflare R2 | 2026-11-24 | Accepted |
| [0009](0009-admin-web-app.md) | Admin web app (React + Vite) in `admin/` | 2026-11-25 | Accepted |
| [0010](0010-maps-google.md) | Google Maps; list-first discovery; capped paid APIs | 2026-11-25 | Accepted |
| [0011](0011-launch-areas-and-locations.md) | 10 launch areas; GPS pins; home-visit vets by travel radius | 2026-11-26 | Accepted |
| [0012](0012-booking-policy-payments-capacity.md) | Free cancellation until 2 h before; mock pay now or at visit; capacity units | 2026-11-26 | Accepted |

## Template

```markdown
# NNNN — Title
- **Date:**
- **Status:** Proposed | Accepted | Superseded by NNNN
- **Owner:**

## Context
## Decision
## Alternatives considered
## Consequences
```
