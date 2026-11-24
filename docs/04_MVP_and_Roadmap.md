# MVP, Scope and Roadmap

## Product strategy
Launch a **city/region-first service marketplace**, not an India-wide directory. Keep national availability in app distribution but initially only activate providers and bookings in a clearly defined service area.

## MVP sequence
### Milestone 0 — Discovery & validation
- Interview 20 pet parents, 10 clinics/vets and 10 caretakers.
- Identify 1 launch catchment.
- Confirm provider onboarding willingness and commission model.
- Test clickable prototype and booking concierge flow.
- Establish initial provider supply before owner marketing.

### Milestone 1 — Foundation
- Repo setup, CI, app shell, backend skeleton, auth, role/permission model, database migrations, design system, environment config, analytics and error logging.
- Pet profiles and image upload.
- *Delivery note ([decision 0003](decisions/0003-phase-1-scope.md)):* this milestone is delivered in two parts. **Phase 1** covers the technical foundation (repo, backend/mobile skeletons, config, DB and migrations, health checks, design tokens, CI, docs, tests). **Phase 1b** covers auth and roles, pet profiles, image upload, analytics and error logging, and starts only after approval.

### Milestone 2 — Vet discovery and appointment MVP
- Provider/clinic onboarding, admin verification, listings, service/price, availability, search/list/map, booking, mock payment states, reminders and review.

### Milestone 3 — Caretaker marketplace
- Caretaker onboarding, verification, availability and service listings.
- Owner care requests, offers, comparison, selection and booking.
- Cancellation, support, review and basic check-in.

### Milestone 4 — Community MVP
- Local/following feed, post, photo, comment, like, report/block, moderation.

### Milestone 5 — Pilot & hardening
- Pilot with recruited providers and invited pet parents.
- Reliability, security, UX, booking concurrency, cancellation, support and analytics.
- Measure conversion and repeat booking.

### Milestone 6 — Retention expansion
- Health timeline/reminders, shared pets, booking chat, caretaker updates, lost/found, events and grooming/walking.

### Milestone 7 — Commerce & payments
- Affiliate/partner product discovery first.
- Validate payment gateway and marketplace payouts/settlement before real payment activation.
- Native product marketplace only after demand and operational readiness.

## Suggested pilot thresholds (hypotheses; revise after interviews)
- 10–20 verified vet/clinic providers in catchment.
- 20–30 verified caretakers (where caretaker service is piloted).
- 100–300 invited pet-parent accounts.
- Track search-to-booking, completed booking, provider response time, repeat booking, cancellation, review completion and incident rate.

## Release gates
- Provider verification and support workflow tested.
- Booking state machine and duplicate-slot prevention tested.
- Privacy permissions reviewed.
- Abuse/report/block workflow available.
- Clear emergency disclaimer and support contacts.
- No real payment until gateway, settlement, refunds, KYC, tax and legal review complete.

## Scope control
Anything not required for a first successful booking is deferred unless it improves trust, safety or conversion directly. No microservices, advanced social graph, full ecommerce logistics, live streaming or AI diagnosis in MVP.
