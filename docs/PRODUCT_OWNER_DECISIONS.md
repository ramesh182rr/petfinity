# Product Owner Decisions — Petfinity

Status: approved defaults applied

- **Brand name:** Petfinity (availability/trademark/domain checks still pending).
- **Tagline direction:** “Every paw. Every need. Every connection.” (working tagline; not final).
- **Launch geography:** Tamil Nadu, Kerala and Bengaluru (Karnataka). Use focused local clusters and service radii; do not imply uniform provider coverage across these regions at launch.
- **Pet profiles:** All species supported in profile data.
- **Marketplace initial focus:** Dogs and cats.
- **Vet services:** Clinic, home visit and teleconsultation service types, enabled only where providers and legal/compliance requirements permit.
- **Caretakers:** Identity verification required; profile/experience verification; references where feasible; meet-and-greet encouraged; completed-booking reviews.
- **Payments:** Mock flow for development; architect for future marketplace payments, commission and provider settlement.
- **Community:** Public-in-app, local and following feeds, with moderation.
- **Messaging:** Booking/provider communication first; general direct messaging deferred.
- **Shopping:** Affiliate/partner links initially; native marketplace later.
- **Brand style:** Premium, warm and playful.
- **Brand palette:** Aligned to the moodboard — deeper plum primary, sage green replaces mint as an accent, coral and warm cream retained. Exact tokens are finalised with contrast checks in Milestone 1.4 ([decision 0002](decisions/0002-brand-palette.md), 2026-11-24).
- **Mobile:** React Native + Expo, Android-first, iOS-compatible.
- **Backend:** Python + FastAPI.
- **Infrastructure:** Neon PostgreSQL, Render, Cloudflare R2; Stripe mocked initially.
- **Repositories:** Single monorepo (`petfinity/`) with independent `mobile/` and `backend/` directories, kept easy to split later ([decision 0001](decisions/0001-monorepo.md), 2026-11-24; supersedes "separate repos").
- **AI coding agent:** Claude; incremental work, no commits or pushes, provide suggested commit messages after features/phases.

These decisions are reflected in the blueprint documents. Remaining legal, provider-verification, payment-provider, map-provider, and operational policy questions are tracked in `docs/20_Open_Decisions.md`.
