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

## Foundation — Phase 1b (needs approval)
- [ ] Auth and role model ([decision 0006](decisions/0006-identity-roles-and-permissions.md): accounts, provider profiles, clinic members, staff roles)
- [ ] Environments and secrets (dev/staging/prod)
- [ ] Pet profiles and image upload
- [ ] Analytics and error logging

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
