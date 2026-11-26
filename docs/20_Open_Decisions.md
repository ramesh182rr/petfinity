# Open Decisions & Decision Log

## Defaults selected by product owner
- Launch geography: Initial active marketplace: Tamil Nadu, Kerala and Bengaluru (Karnataka); launch operationally in focused clusters within these markets and expand as supply/demand develops.
- Pet types: profile support for all species; marketplace initially optimised for dogs and cats.
- Vet services: model clinic visits, home visits and teleconsultation; enable based on provider availability and compliance review.
- Caretaker verification: identity verification required; profile/experience verification, references where feasible, meet-and-greet encouraged, verified badge and completed-booking reviews.
- Payments: mock initially; eventual platform payment/commission/payout architecture.
- Community: public-in-app, local and following feeds; moderation controls.
- Messaging: booking/provider communication first; general DMs deferred.
- Shopping: affiliate/partner links initially; native checkout later.
- Brand direction: premium but warm/playful.
- Product name: Petfinity selected; trademark/domain/social-handle/app-store clearance remains required.
- Stack: React Native + Expo; Python FastAPI; Neon; Render; Cloudflare R2; Stripe mock.
- Repositories: single monorepo with independent `mobile/` and `backend/`, split-ready (decision 0001, 2026-11-24).
- Brand palette: moodboard-aligned, with plum primary and sage replacing mint (decision 0002, 2026-11-24).
- Booking confirmation: instant or request per service; caretaker offers confirm on acceptance (decision 0004).
- Single `bookings` record for vet and care; "appointment" is UI wording (decision 0005).
- Unified account with additive capabilities; staff roles are audited grants limited to staff-domain emails (decision 0006).
- Solo developer with Claude; Claude does not commit; suggests commit messages.

## Decisions to confirm before coding beyond foundation
1. ~~Launch areas and service radii~~: **decided.** 10 launch cities, a 10 km default search radius (up to 25 km), and home-visit vets by travel radius ([0011](decisions/0011-launch-areas-and-locations.md)).
2. ~~User auth strategy~~: **decided.** Passwordless OTP via email or phone ([0007](decisions/0007-authentication.md)). Delivery providers are still open under #15.
3. ~~Map provider~~: **decided.** Google Maps, list-first discovery ([0010](decisions/0010-maps-google.md)).
4. Provider verification process and evidence sources.
5. ~~Booking policy~~: **decided.** Instant or request per service ([0004](decisions/0004-booking-confirmation-model.md)).
6. Vet booking monetisation: commission, lead fee, subscription, or hybrid.
7. Caretaker cancellation/refund, emergency and incident policies.
8. Marketplace payment/payout gateway and platform capabilities for India.
9. Teleconsultation/legal scope and provider requirements.
10. Community moderation policy and age restrictions.
11. Terms, privacy, consent and data retention.
12. Petfinity trademark, domain and app-store/social-handle clearance.
13. ~~Admin/provider web technology~~: **decided.** React + Vite admin web app in `admin/` ([0009](decisions/0009-admin-web-app.md)).
14. MVP community media scope and upload limits.
15. SMS/email/push notification provider. **Needed before staging:** OTP delivery (SMS needs India DLT registration; start early).

## Decision log
Recorded decisions live in [`docs/decisions/`](decisions/README.md).

## Decision log template
- Date:
- Decision:
- Alternatives:
- Rationale:
- Impact:
- Owner:
