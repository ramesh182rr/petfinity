# Product Owner Decisions — Petfinity

Status: approved defaults applied

- **Brand name:** Petfinity (availability/trademark/domain checks still pending).
- **Tagline direction:** “Every paw. Every need. Every connection.” (working tagline; not final).
- **Launch geography:** Tamil Nadu, Kerala and Bengaluru (Karnataka). Use focused local clusters and service radii; do not imply uniform provider coverage across these regions at launch. Launch areas (2026-11-26, [0011](decisions/0011-launch-areas-and-locations.md)): Chennai, Coimbatore, Madurai, Tiruchirappalli, Salem, Kochi, Thiruvananthapuram, Kozhikode, Thrissur and Bengaluru.
- **Pet profiles:** All species supported in profile data.
- **Marketplace initial focus:** Dogs and cats.
- **Vet services:** Clinic, home visit and teleconsultation service types, enabled only where providers and legal/compliance requirements permit.
- **Caretakers:** Identity verification required; profile/experience verification; references where feasible; meet-and-greet encouraged; completed-booking reviews.
- **Payments:** Mock flow for development; architect for future marketplace payments, commission and provider settlement. Vet bookings (2026-11-26, [0012](decisions/0012-booking-policy-payments-capacity.md)): after confirmation the parent picks "Pay now (mock)" or "Pay at the visit"; nothing is charged.
- **Caretaker marketplace ([0015](decisions/0015-caretaker-marketplace.md), 2026-11-27):** all four care types at launch (home visits, day care, boarding, house sitting); requests are open to nearby verified caretakers and close at 5 offers or 24 hours; care cancellations are free until 48 hours before the start, then 50% refund, and none once care has started.
- **Reviews ([0014](decisions/0014-reviews-and-moderation.md), 2026-11-27):** reviews publish immediately; any report or the automatic check hides one until a moderator decides. Providers get one public reply. Parents can review and edit for 30 days after the visit.
- **Cancellation policy (vet bookings, [0012](decisions/0012-booking-policy-payments-capacity.md)):** free until 2 hours before the start; later parent cancellations are allowed but not refunded; provider/admin cancellations always refund in full.
- **Community:** Public-in-app, local and following feeds, with moderation.
- **Booking confirmation:** instant or request per service. In-clinic is instant by default, home visits are request. Accepting a caretaker offer confirms the booking ([0004](decisions/0004-booking-confirmation-model.md)).
- **Bookings:** one booking record for vet and caretaker services. "Appointment" is UI wording for vet bookings ([0005](decisions/0005-unified-bookings.md)).
- **Roles:** one account and sign-in per person. Capabilities are additive (pet parent, veterinarian, caretaker, clinic operator). Moderator and admin are audited grants limited to verified staff-domain emails ([0006](decisions/0006-identity-roles-and-permissions.md)).
- **Sign-in:** passwordless one-time codes by email or mobile number. Sign-up and sign-in are the same flow ([0007](decisions/0007-authentication.md)).
- **Admin tools:** a separate admin web app (React + Vite) in the monorepo ([0009](decisions/0009-admin-web-app.md)).
- **Maps:** Google Maps, with discovery built list-first ([0010](decisions/0010-maps-google.md)).
- **Messaging:** Booking/provider communication first; general direct messaging deferred.
- **Shopping:** Affiliate/partner links initially; native marketplace later.
- **Brand style:** Premium, warm and playful.
- **Brand palette:** Aligned to the moodboard — deeper plum primary, sage green replaces mint as an accent, coral and warm cream retained. Exact tokens are finalised with contrast checks in Milestone 1.4 ([decision 0002](decisions/0002-brand-palette.md), 2026-11-24).
- **Mobile:** React Native + Expo, Android-first, iOS-compatible.
- **Backend:** Python + FastAPI.
- **Infrastructure:** Neon PostgreSQL, Render, Cloudflare R2; Stripe mocked initially.
- **Media storage:** local disk for development now. The Cloudflare R2 adapter is built and switched on with `STORAGE_BACKEND=r2` once keys and a bucket are added ([0008](decisions/0008-media-storage.md)).
- **Repositories:** Single monorepo (`petfinity/`) with independent `mobile/` and `backend/` directories, kept easy to split later ([decision 0001](decisions/0001-monorepo.md), 2026-11-24; supersedes "separate repos").
- **AI coding agent:** Claude; incremental work, no commits or pushes, provide suggested commit messages after features/phases.

These decisions are reflected in the blueprint documents. Remaining legal, provider-verification, payment-provider, map-provider, and operational policy questions are tracked in `docs/20_Open_Decisions.md`.
