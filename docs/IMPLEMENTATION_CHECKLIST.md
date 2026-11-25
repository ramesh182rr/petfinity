# Implementation Checklist

## Discovery and validation
- [ ] Define launch service clusters and radius across Tamil Nadu, Kerala and Bengaluru
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
- [ ] Provider profiles and clinic memberships (decision 0006): built with provider onboarding in Phase 2

## Core owner experience
- [ ] Onboarding and location
- [ ] Multi-pet profile
- [ ] Media upload
- [ ] Discover list/search/filter
- [ ] Provider/clinic detail
- [ ] Availability/slot selection
- [ ] Appointment booking
- [ ] Mock payment states
- [ ] Booking management and review

## Phase 2 — vet discovery and booking (see [development/phase-2-plan.md](development/phase-2-plan.md))
- [x] 2.1 Provider and clinic onboarding API: profiles, clinics, private verification documents, submission
- [x] 2.2 Admin verification: review queue, document viewer, decisions, suspension; admin web app in `admin/` ([0009](decisions/0009-admin-web-app.md))
- [x] 2.3 Provider onboarding (app): hub, profile and clinic forms, document upload, submit, review status and messages
- [x] UI refresh: gradient heroes, floating tab bar, richer components; quality bar recorded in doc 08 and CLAUDE.md
- [ ] 2.4 Services and availability
- [ ] 2.5 Discovery (list-first, [0010](decisions/0010-maps-google.md))
- [ ] 2.6 Booking engine
- [ ] 2.7 Booking flow (app)
- [ ] 2.8 Provider inbox (app)
- [ ] 2.9 Notifications and reminders
- [ ] 2.10 Reviews

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
