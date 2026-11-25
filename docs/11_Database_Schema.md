# Database Schema (Conceptual)

Use UUID primary keys, timestamps (`created_at`, `updated_at`), soft-delete where needed, constraints and indexes. Exact schema evolves through reviewed migrations.

## Core tables
- `users` (implemented 1b.1): email (citext, unique), email_verified_at, phone (E.164, unique), phone_verified_at, display_name, status (active/suspended). Check: at least one identifier. Avatar and preferences come later.
- `otp_challenges` (implemented 1b.1): channel, destination_hash, code_hash, ip_hash (all keyed HMAC, no clear text), attempts, expires_at, consumed_at.
- `auth_sessions` (implemented 1b.1): user_id, refresh_token_hash (unique), previous_refresh_token_hash (reuse detection), user_agent, last_used_at, expires_at (sliding), absolute_expires_at, revoked_at, revoke_reason.
- `staff_roles` (implemented 1b.1): user_id, role (moderator/admin), granted_by_user_id, granted_at, revoked_at, revoked_by_user_id. Partial unique index: one active grant per (user, role). Pet parent is implicit for every account. Provider and clinic capabilities live in the tables below ([decision 0006](decisions/0006-identity-roles-and-permissions.md)).
- `pets` (implemented 1b.3): owner_id, name, species (+ species_other), breed, sex, date_of_birth (+ is_estimate), weight_kg, neutered, temperament, dietary_notes, allergies, known_conditions, medications, emergency contact name/phone, photo_media_id, deleted_at (soft delete). Checks on species, sex and weight.
- `media_assets` (implemented 1b.4, [decision 0008](decisions/0008-media-storage.md)): owner_id, purpose (pet_photo), storage_key (unique, server-generated), content_type, declared_size_bytes, size_bytes, status (pending/ready/deleted), uploaded_at, deleted_at.
- `pet_access`: pet_id, user_id, permission set, invited_by, expiry (shared access later).
- `provider_profiles` (implemented 2.1): user_id, provider_type (veterinarian/caretaker; unique per user + type), display_name, bio, years_experience, languages[], city, registration_number, registration_council, qualifications, verification_status (draft/submitted/needs_info/verified/rejected), verified_at, status (active/suspended). Service area and profile media come with Phase 3 and discovery.
- `verification_documents` (implemented 2.1): subject_type + subject_id, doc_type, media_asset_id (private storage), uploaded_by, submission_id, deleted_at.
- `verification_submissions` (implemented 2.1): subject_type + subject_id, submitted_by, applicant_note, status (pending/approved/needs_info/rejected/withdrawn), reviewed_by, reviewed_at, decision_reason (review fields used by 2.2).
- `clinics` (implemented 2.1): name, description, phone, email, address_line1/2, locality, city, state, postal_code, latitude/longitude, timezone (default Asia/Kolkata), emergency_services, created_by, verification_status, verified_at, status. Opening hours live in `availability_rules` (2.4).
- `clinic_members` (implemented 2.1): clinic_id, user_id, member_role (operator/veterinarian), added_by, created_at, removed_at. Unique active (clinic, user, role). A vet who runs their own clinic holds both memberships.
- `services` (implemented 2.4): exactly one owner, `clinic_id` or `provider_profile_id` (check `one_owner`). Fields: category (12 fixed values, e.g. general_consultation, vaccination, dental), title, description, `price_minor` (paise, 0–₹1,00,000), currency (INR only), `duration_minutes` (5–480, multiple of 5), service_mode (in_clinic / home_visit / teleconsult; teleconsult is rejected by the API for now), confirmation_mode (instant / request), species (text array), active, archived_at, timestamps. Services are archived, never deleted, so future bookings can keep pointing at them.
- `availability_rules` (implemented 2.4): one owner (as above), weekday (0 = Monday … 6 = Sunday), start_time < end_time (local time, 5-minute grid), capacity 1–20 (appointments at once), created_at. Breaks are simply gaps between ranges. The timezone comes from the owner: a clinic's `timezone`, or Asia/Kolkata for an individual vet. The API rejects overlapping ranges on the same day and caps ranges at 6 per day.
- `availability_exceptions` (implemented 2.4): one owner, on_date, kind (closed / custom_hours), start/end time and capacity (required for custom_hours, null for closed; check `valid_shape`), note (≤120), created_at. Custom hours replace that day's weekly hours. Index on on_date.
- Slots are not stored. They are computed from rules and exceptions in the owner's timezone, stepping by the service duration, with a 30-minute minimum lead time and a 60-day horizon (`app/modules/catalog/slots.py`). Booking holds (2.6) will subtract from capacity.
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
- `audit_logs` (implemented 1b.1): actor_user_id, action, target_type, target_id, details (JSONB, no personal data), created_at.

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
