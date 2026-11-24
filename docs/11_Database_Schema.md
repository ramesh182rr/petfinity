# Database Schema (Conceptual)

Use UUID primary keys, timestamps (`created_at`, `updated_at`), soft-delete where needed, constraints and indexes. Exact schema evolves through reviewed migrations.

## Core tables
- `users`: id, email/phone, auth_subject, display_name, avatar, status, preferences.
- `user_roles`: user_id, role (owner/provider/admin), status.
- `pets`: owner_id, name, species, breed, DOB/estimated age, sex, weight, photo, temperament, allergies, conditions, notes.
- `pet_access`: pet_id, user_id, permission set, invited_by, expiry (shared access later).
- `providers`: user_id, provider_type, bio, verification_status, service_area, profile_media, status.
- `provider_verifications`: provider_id, verification_type, document_object_key, status, reviewer, review_reason; private storage only.
- `clinics`: provider_id, name, location, address, contact, operating hours, emergency flag.
- `provider_staff`: clinic_id, provider_id, role, credentials/registration fields.
- `services`: provider_id, category, title, description, price, currency, duration, service_mode, active.
- `availability_rules`: provider_id/service_id, weekday, start/end, timezone, capacity.
- `availability_exceptions`: provider_id, date, unavailable intervals or adjusted hours.
- `appointments`: owner_id, pet_id, provider_id, service_id, start/end, status, notes, price snapshot, cancellation metadata.
- `caretaker_requests`: owner_id, pet ids, service_type, location, date range, requirements, budget, status.
- `caretaker_offers`: request_id, caretaker_id, price, message, availability, status.
- `bookings`: owner_id, provider_id, booking_type, related appointment/offer, start/end, status, price snapshot, cancellation policy snapshot.
- `payments`: booking_id, provider, payment intent/reference, amount, status, idempotency key; mock fields in MVP.
- `refunds`, `payouts`, `commissions`: separate accounting records (later real payments).
- `reviews`: booking_id, author_id, provider_id, rating, text, moderation status.
- `posts`, `post_media`, `comments`, `reactions`.
- `reports`, `blocks`, `moderation_actions`.
- `notifications`, `notification_preferences`.
- `audit_logs`.

## Relationships
- User 1:N Pets.
- User 1:N Provider profile (roles additive; initially 1 provider profile per user may be sufficient).
- Clinic 1:N Staff and Services.
- Provider 1:N Services, Availability, Bookings, Reviews.
- Pet N:1 Owner; bookings reference pet(s), potentially via booking-pets join table.
- Care request 1:N Offers; selected offer creates Booking.
- Booking 1:N Payment/Refund/Payout ledger entries.
- Posts 1:N Comments/Reactions; media stored in R2.

## Indexes and constraints
- Unique normalized email/phone where present.
- Provider location index; consider PostGIS.
- Availability/provider/time indexes.
- Booking unique/overlap constraints or transactional locking strategy.
- Request/provider offer uniqueness where appropriate.
- Status/date indexes for admin queues.
- Foreign keys and cascading behavior explicitly defined.

## Data retention
Define retention for verification documents, health records, chat, reports and payment metadata with legal/privacy review. Account deletion should anonymize/delete where possible while preserving legally required transaction/audit records.
