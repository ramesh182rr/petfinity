# 0005 — One `bookings` record for vet and caretaker services

- **Date:** 2026-11-24
- **Status:** Accepted
- **Owner:** Product owner
- **Resolves:** audit contradiction #2 (separate `appointments` and `bookings` tables; payments attached to bookings while vets were booked via `/appointments`)

## Decision
- **`bookings` is the single canonical record** for every booked service: vet appointments and caretaker care. Payments, refunds, cancellations, reviews, notifications, disputes and admin lookups all reference `booking_id`.
- **"Appointment" is user-interface language only.** Vet bookings are shown as "Book an appointment with Dr …" and "Your appointment". Caretaker bookings are shown as "Care booking" or "Stay". There is no `appointments` table or `/appointments` API.
- `booking_type` distinguishes the kinds: `vet_appointment` or `care`. Teleconsultation, grooming and similar later become a service mode or a new type, not a new table.

### Shape (finalised by migration in Phase 2)
- **`bookings`:**
  - id, `booking_type`, `owner_id`, `provider_profile_id`, `clinic_id` (nullable)
  - `service_id` (vet), `caretaker_request_id` and `offer_id` (care, unique)
  - `service_mode` (`in_clinic` | `home_visit` | `teleconsult` | `day_care` | `boarding` | `house_sitting` | `home_care_visit`), `confirmation_mode`, `status`
  - `start_at`, `end_at` (UTC) and `timezone`
  - price snapshot: `amount_minor`, `currency`
  - `cancellation_policy_snapshot` (JSON), `owner_notes`, `response_deadline`, `idempotency_key` (unique per owner)
  - timestamps
  - Check constraints make the type-specific columns required or forbidden depending on `booking_type`.
- **`booking_pets`:** links one or more pets to a booking. Caretaker stays often include several pets.
- **`booking_events`:** an append-only history of status changes and reschedules (actor, from, to, reason, time). It serves as both the audit trail and the user-visible timeline.
- **Double-booking protection:** a Postgres exclusion constraint on (bookable resource, `tstzrange(start_at, end_at)`) for slot-holding statuses, plus idempotency keys. The bookable resource is the vet or capacity unit for clinics and the caretaker for care. The exact capacity design is settled in Phase 2.

### API
- `GET /providers/{id}/slots?service_id=&date=`
- `POST /bookings`: creates a vet appointment. Requires an `Idempotency-Key` header. Returns `confirmed` (instant) or `pending_provider` (request).
- `POST /offers/{id}/accept`: creates a `care` booking as `confirmed` and returns it.
- `GET /bookings`, `GET /bookings/{id}`
- `POST /bookings/{id}/confirm`, `/decline` (provider, request mode)
- `/cancel`, `/reschedule`, `/check-in`, `/complete`, `/no-show`
- Payment-mock endpoints remain under `/bookings/{id}/…`.

## Alternatives considered
- **Separate `appointments` + `bookings` tables (blueprint):** two lifecycles to keep in sync, and ambiguity about which record owns payments and reviews.
- **Separate tables per type with no shared parent:** duplicates the payment, review and cancellation logic per type.

## Consequences
One state machine, one payment path, one review rule ("only after a `completed` booking") and one admin lookup. Docs 03, 06, 11, 12 and 15 and the booking-flow diagram were updated.
