# Implementation Checklist

## Discovery and validation
- [x] Define launch service clusters and radius across Tamil Nadu, Kerala and Bengaluru ([0011](decisions/0011-launch-areas-and-locations.md))
- [ ] Interview pet owners, clinics and caretakers
- [ ] Validate commission/booking preference
- [ ] Recruit pilot providers
- [ ] Test prototype and concierge booking

## Foundation — Phase 1 (see [development/phase-1-plan.md](development/phase-1-plan.md))
- [x] 1.0 Monorepo scaffold and docs relocation
- [x] 1.1 Backend skeleton: config, health API, error envelope, tests
- [x] 1.2 Database connectivity and Alembic migrations
- [x] 1.3 Mobile skeleton: Expo Router tab shell, lint/typecheck/tests
- [x] 1.4 Design tokens and UI primitives
- [x] 1.5 Mobile ↔ API wiring and OpenAPI-generated types
- [x] 1.6 CI and developer documentation
- [ ] 1.7 (optional) First cloud deploy: Neon + Render (needs product-owner accounts; `infrastructure/render.yaml` drafted)

## Foundation — Phase 1b (see [development/phase-1b-plan.md](development/phase-1b-plan.md))
- [x] 1b.1 Backend identity: OTP sign-in, sessions, `/me`, staff roles, audit ([0006](decisions/0006-identity-roles-and-permissions.md), [0007](decisions/0007-authentication.md))
- [x] 1b.2 Mobile sign-in and session handling
- [x] 1b.3 Pet profiles (backend)
- [x] 1b.4 Media upload: signed URLs; local storage in dev, R2 adapter ready (keys pending) ([0008](decisions/0008-media-storage.md))
- [x] 1b.5 Pet profiles (mobile): My Pets, add/edit/delete, photo, Home pet switcher
- [ ] 1b.6 Analytics, error monitoring, environments and secrets matrix (deferred by the product owner, 2026-11-25)
- [x] Provider profiles and clinic memberships (decision 0006): built with provider onboarding in Phase 2 (2.1)

## Core owner experience
- [ ] Onboarding and location
- [ ] Multi-pet profile
- [ ] Media upload
- [x] Discover list/search/filter (2.5)
- [x] Provider/clinic detail (2.5)
- [x] Availability/slot selection (2.5, 2.7)
- [x] Appointment booking (2.7)
- [x] Mock payment states (2.6, 2.7)
- [x] Booking management and review (2.7, 2.10)

## Phase 2 — vet discovery and booking (see [development/phase-2-plan.md](development/phase-2-plan.md))
- [x] 2.1 Provider and clinic onboarding API: profiles, clinics, private verification documents, submission
- [x] 2.2 Admin verification: review queue, document viewer, decisions, suspension; admin web app in `admin/` ([0009](decisions/0009-admin-web-app.md))
- [x] 2.3 Provider onboarding (app): hub, profile and clinic forms, document upload, submit, review status and messages
- [x] UI refresh: gradient heroes, floating tab bar, richer components; quality bar recorded in doc 08 and CLAUDE.md
- [x] 2.4 Services and availability: services, weekly hours with capacity, days off and special hours, slot generation in the owner's timezone; provider workspace in the app
- [x] 2.5 Discovery (list-first, [0010](decisions/0010-maps-google.md), [0011](decisions/0011-launch-areas-and-locations.md)): launch areas, near-me search, filters, clinic and home-visit vet pages with live open times; provider area and GPS pin
- [x] 2.6 Booking engine (API): bookings, capacity units with an exclusion constraint, idempotent create, instant/request state machine, expiry, cancellation policy, mock payments ([0012](decisions/0012-booking-policy-payments-capacity.md))
- [x] 2.7 Booking flow (app): review and book, pending/confirmed states, mock pay now or at visit, Bookings tab, detail with timeline, cancel with outcome preview, reschedule
- [x] 2.8 Provider inbox (app): workspace Appointments summary, Requests/Upcoming/Past inbox, confirm/decline with reasons, check-in, complete, no-show, provider cancel
- [x] 2.9 Notifications and reminders: in-app inbox with unread badge, booking notifications for both sides, day-before and 2-hour reminders, push via Expo behind an adapter (mock in dev) ([0013](decisions/0013-notifications-and-push.md))
- [x] 2.10 Reviews: completed visits only, one per booking, publish then moderate (report or auto-flag hides), provider replies, 30-day edits, ratings in search and listing pages, admin moderation ([0014](decisions/0014-reviews-and-moderation.md))

## Provider/admin
- [ ] Provider onboarding
- [ ] Verification queue
- [ ] Clinic profile and services
- [ ] Availability/calendar
- [ ] Provider booking inbox
- [ ] Admin reports/moderation

## Caretaker marketplace
- [ ] Caretaker profiles
- [ ] Verification
- [ ] Owner request
- [ ] Quote/offer flow
- [ ] Accept and booking
- [ ] Cancellation/support

## Community
- [ ] Feed
- [ ] Post/photo
- [ ] Likes/comments
- [ ] Local/following scope
- [ ] Report/block
- [ ] Moderation

## Pilot and release
- [ ] Analytics
- [ ] Security review
- [ ] QA / bug bash
- [ ] Provider and owner pilot
- [ ] App store materials
- [ ] Support process
- [ ] Production readiness and backups

## Phase 3 — caretaker marketplace (see [development/phase-3-plan.md](development/phase-3-plan.md))
- [x] 3.1 Caretaker services and profile: four care types with rates, species and pet limits; home and capacity; service area; days off; identity + address proof; workspace with readiness checklist
- [ ] 3.2 Care requests (API)
- [ ] 3.3 Offers and care bookings (API)
- [ ] 3.4 Parent app: request and compare
- [ ] 3.5 Caretaker app: requests and bookings
- [ ] 3.6 Care updates, notifications, reviews
