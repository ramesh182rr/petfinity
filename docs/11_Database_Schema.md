# Database Schema (Conceptual)

Use UUID primary keys, timestamps (`created_at`, `updated_at`), soft-delete where needed, constraints and indexes. Exact schema evolves through reviewed migrations.

## Core tables
- `users`: id, email/phone, auth_subject, display_name, avatar, status, preferences.
- `staff_roles`: user_id, role (moderator/admin), granted_by, granted_at, revoked_at. Pet parent is implicit for every account. Provider and clinic capabilities live in the tables below ([decision 0006](decisions/0006-identity-roles-and-permissions.md)).
- `pets`: owner_id, name, species, breed, DOB/estimated age, sex, weight, photo, temperament, allergies, conditions, notes.
- `pet_access`: pet_id, user_id, permission set, invited_by, expiry (shared access later).
- `provider_profiles`: user_id, provider_type (veterinarian/caretaker; unique per user + type), bio, credentials/registration fields (vets), verification_status, service_area, profile_media, status.
- `provider_verifications`: subject (provider_profile_id or clinic_id), verification_type, document_object_key, status, reviewer, review_reason; private storage only.
- `clinics`: name, location, address, contact, operating hours, emergency flag, verification_status, status.
- `clinic_members`: clinic_id, user_id, member_role (operator/veterinarian), status. A vet who runs their clinic holds both memberships.
- `services`: provider_profile_id or clinic_id, category, title, description, price, currency, duration, service_mode, confirmation_mode (instant/request), active.
- `availability_rules`: provider_id/service_id, weekday, start/end, timezone, capacity.
- `availability_exceptions`: provider_id, date, unavailable intervals or adjusted hours.
- `caretaker_requests`: owner_id, pet ids, service_type, location, date range, requirements, budget, status.
- `caretaker_offers`: request_id, caretaker_id, price, message, availability, status.
- `bookings` (single record for vet appointments and care, [decision 0005](decisions/0005-unified-bookings.md)): booking_type (vet_appointment/care), owner_id, provider_profile_id, clinic_id, service_id (vet), caretaker_request_id + offer_id (care), service_mode, confirmation_mode, status, start_at/end_at (UTC) + timezone, price snapshot, cancellation policy snapshot, owner_notes, response_deadline, idempotency_key.
- `booking_pets`: booking_id, pet_id.
- `booking_events`: booking_id, from_status, to_status, event (e.g. rescheduled), actor_user_id, reason, created_at (append-only).
- `payments`: booking_id, provider, payment intent/reference, amount, status, idempotency key; mock fields in MVP.
- `refunds`, `payouts`, `commissions`: separate accounting records (later real payments).
- `reviews`: booking_id, author_id, provider_id, rating, text, moderation status.
- `posts`, `post_media`, `comments`, `reactions`.
- `reports`, `blocks`, `moderation_actions`.
- `notifications`, `notification_preferences`.
- `audit_logs`.

## Relationships
- User 1:N Pets.
- User 1:N provider profiles (at most one per provider_type); User N:M Clinics via `clinic_members`.
- Clinic 1:N members and services.
- Provider 1:N Services, Availability, Bookings, Reviews.
- Pet N:1 Owner; bookings reference pets via `booking_pets`.
- Care request 1:N Offers; selected offer creates Booking.
- Booking 1:N Payment/Refund/Payout ledger entries.
- Posts 1:N Comments/Reactions; media stored in R2.

## Indexes and constraints
- Unique normalized email/phone where present.
- Provider location index; consider PostGIS.
- Availability/provider/time indexes.
- Booking overlap: exclusion constraint on (bookable resource, time range) for slot-holding statuses (`pending_provider`, `confirmed`, `in_progress`), using `btree_gist`. Idempotency key unique per owner.
- Request/provider offer uniqueness where appropriate.
- Status/date indexes for admin queues.
- Foreign keys and cascading behavior explicitly defined.

## Data retention
Define retention for verification documents, health records, chat, reports and payment metadata with legal/privacy review. Account deletion should anonymize/delete where possible while preserving legally required transaction/audit records.
