# Product Requirements Document (PRD)

## Product scope
A multi-role pet-care platform with consumer mobile app, provider experience and admin operations. First release focuses on discovery and bookings in a launch geography.

## Personas and roles
- **Pet parent:** creates pet profiles, searches, books, pays/records payment, reviews and participates in community.
- **Veterinarian:** professional profile, clinic affiliation, offered services and availability; manages appointments.
- **Clinic operator:** business listing, locations, staff, services, pricing, operating hours, appointment capacity and booking operations.
- **Caretaker:** provider profile, verification, care types, availability, rates, quote responses and bookings.
- **Admin/moderator:** verification, disputes, reports, listings, user/provider status, bookings and operational analytics.

Roles are additive. A person may be a pet parent and a provider; do not force mutually exclusive account types.

## MVP features (P0)
### Identity and onboarding
- Email/password and/or phone OTP (implementation choice must be evaluated for cost and abuse); Google sign-in optional in initial release.
- Basic user profile, city/area and location permission with clear explanation.
- Role-specific provider onboarding from a dedicated “Become a provider” entry, not buried as a login toggle.
- Consent, privacy, terms and notification preferences.

### Pet profiles
- Multiple pets per owner.
- Name, species, breed (free text + searchable options), DOB/estimated age, sex, weight, photo, temperament, dietary notes, allergies, known conditions, medication and emergency contact.
- Sensitive health information access is owner-controlled.

### Vet/clinic discovery and booking
- Search/list and map views.
- Filters: service, distance, rating, price range, open/available, verified, home visit/clinic/online.
- Clinic profile: address, map pin, contact, operating hours, doctors, service list, price, duration, facility details and photos.
- Service categories: general consultation, vaccination, deworming, skin/ear, dental, surgery, diagnostics, blood test, imaging, sterilisation, emergency, preventive check; providers select offered services.
- Booking flow: select pet → provider → service → slot → notes → confirmation → payment state (mock) → reminder → booking detail → completion → review.
- Provider calendar: configurable hours, breaks, capacity, service duration, blackout dates and slot generation.
- Appointment statuses: requested, confirmed, rescheduled, cancelled_by_owner, cancelled_by_provider, checked_in, completed, no_show, disputed.
- Avoid duplicate/overlapping bookings; booking confirmation should be transactional.

### Caretaker marketplace
- Care types: home visit, pet-at-caretaker day care, overnight boarding, house sitting. Initial service enablement may be limited by pilot geography.
- Provider profile: bio, experience, pet types, care environment, capacity, service area, rates, availability, photos, verification status and reviews.
- Owner request: pet(s), location, date range, care type, requirements, budget (optional), instructions and photos.
- Caretaker offer: price, availability confirmation, response, details and optional add-ons.
- Owner compares offers and selects one.
- Booking, status, cancellation, reviews and support workflow.
- Offer/booking states documented and testable.

### Community (light MVP)
- Feed: local and following; public-in-app scope controlled by privacy settings.
- Posts: text, photos; pet association optional.
- Likes, comments, report, block, hide.
- Basic moderation queue and community guidelines.
- Do not build private DMs in MVP.

### Nearby discovery
- Map + list, category toggles for clinics and caretakers.
- Search radius, filters and location permission handling.
- Location is never required for manual city/area search.
- Map provider choice and cost limits are a pre-launch decision.

### Admin and support
- Provider identity/document verification queue.
- Clinic/vet/caretaker approval and suspension.
- User/provider report queue.
- Booking lookup, cancellation/dispute notes and mock refund states.
- Content moderation and audit logs.

### Notifications
- Booking request/confirmation/cancellation/reminder, caretaker quote, selected offer, provider availability and safety alerts.
- Push first; in-app notification list. Email/SMS strategy TBD based on cost.

## P1 / Phase 2
- Health timeline and document/photo uploads
- Vaccination, medication, grooming and vet reminders
- Shared pet profile access with permissions
- Booking-related chat
- Caretaker check-in/check-out and photo updates
- Meet-and-greet
- Lost/found pets and local alerts
- Grooming, walking, training providers
- Local events and groups

## P2 / later
- Affiliate product shop
- Native ecommerce checkout/fulfilment
- Teleconsultation (provider-led; legal and clinical process review)
- Subscription plans
- Premium provider tools/listings
- Insurance/NGO partnerships
- Advanced recommendation/AI features

## Product quality requirements
- Accessible, readable, low-friction UX; support slower networks and graceful loading/empty/error states.
- Secure authentication, authorization and rate limits.
- Never expose verification docs publicly.
- Owner can export/delete account data subject to legal/transaction retention requirements.
- Clear service terms, cancellation rules, provider disclaimers and report/safety flow.
- No diagnosis or emergency triage automation in MVP.

## Acceptance principle
Each feature must have a written acceptance checklist, API contract, data model, tests, loading/error states and analytics event before implementation is marked complete.
