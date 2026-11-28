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
- `provider_profiles` (implemented 2.1): user_id, provider_type (veterinarian/caretaker; unique per user + type), display_name, bio, years_experience, languages[], city, registration_number, registration_council, qualifications, area_key, latitude/longitude (private home-visit base), service_radius_km (1–50; the app offers 5/10/15/25), caretaker-only home_type (apartment/independent_house), outdoor_space, pets_at_home, max_concurrent (1–5, care bookings at once; 3.1), verification_status (draft/submitted/needs_info/verified/rejected), verified_at, status (active/suspended). Location fields added in 2.5 (migration 0006, [decision 0011](decisions/0011-launch-areas-and-locations.md)); profile media come later.
- `verification_documents` (implemented 2.1): subject_type + subject_id, doc_type, media_asset_id (private storage), uploaded_by, submission_id, deleted_at.
- `verification_submissions` (implemented 2.1): subject_type + subject_id, submitted_by, applicant_note, status (pending/approved/needs_info/rejected/withdrawn), reviewed_by, reviewed_at, decision_reason (review fields used by 2.2).
- `clinics` (implemented 2.1): name, description, phone, email, address_line1/2, locality, city, state, postal_code, latitude/longitude (optional exact pin), area_key (launch area, 2.5; index with verification_status), timezone (default Asia/Kolkata), emergency_services, created_by, verification_status, verified_at, status. Opening hours live in `availability_rules` (2.4).
- `clinic_members` (implemented 2.1): clinic_id, user_id, member_role (operator/veterinarian), added_by, created_at, removed_at. Unique active (clinic, user, role). A vet who runs their own clinic holds both memberships.
- `services` (implemented 2.4): exactly one owner, `clinic_id` or `provider_profile_id` (check `one_owner`). Fields: category (12 fixed values, e.g. general_consultation, vaccination, dental), title, description, `price_minor` (paise, 0–₹1,00,000), currency (INR only), `duration_minutes` (5–480, multiple of 5), service_mode (in_clinic / home_visit / teleconsult; teleconsult is rejected by the API for now), confirmation_mode (instant / request), species (text array), active, archived_at, timestamps. Services are archived, never deleted, so future bookings can keep pointing at them.
- `availability_rules` (implemented 2.4): one owner (as above), weekday (0 = Monday … 6 = Sunday), start_time < end_time (local time, 5-minute grid), capacity 1–20 (appointments at once), created_at. Breaks are simply gaps between ranges. The timezone comes from the owner: a clinic's `timezone`, or Asia/Kolkata for an individual vet. The API rejects overlapping ranges on the same day and caps ranges at 6 per day.
- `availability_exceptions` (implemented 2.4): one owner, on_date, kind (closed / custom_hours), start/end time and capacity (required for custom_hours, null for closed; check `valid_shape`), note (≤120), created_at. Custom hours replace that day's weekly hours. Index on on_date.
- Slots are not stored. They are computed from rules and exceptions in the owner's timezone, stepping by the service duration, with a minimum lead time (30 minutes for instant services, 60 for request services) and a 60-day horizon (`app/modules/catalog/slots.py`). A slot is open only if a capacity unit is free: `catalog.available_slots` subtracts slot-holding bookings (2.6).
- `caretaker_requests`: owner_id, pet ids, service_type, location, date range, requirements, budget, status.
- `caretaker_offers`: request_id, caretaker_id, price, message, availability, status.
- `bookings` (implemented 2.6, [0005](decisions/0005-unified-bookings.md), [0012](decisions/0012-booking-policy-payments-capacity.md)):
  - booking_type (vet_appointment/care), owner_id
  - exactly one listing: clinic_id or provider_profile_id; service_id (required for vet appointments)
  - snapshots: service_title, service_mode, confirmation_mode, amount_minor, currency, cancellation_policy (JSONB)
  - status (decision 0004 values), start_at/end_at (UTC), timezone, response_deadline (required while pending_provider)
  - resource_id (= the listing) and capacity_unit (1–20)
  - owner_notes, visit_address (home visits; shown to the provider after confirmation)
  - payment_status (not_due/unpaid/pay_at_visit/paid/refunded/not_refunded), cancellation_outcome (not_charged/full_refund/late_no_refund), cancel_reason
  - idempotency_key and request_hash (unique per owner), timestamps
  - **Exclusion constraint** `ex_bookings_no_overlap`: GiST on (resource_id =, capacity_unit =, tstzrange(start_at, end_at) &&) where status is pending_provider, confirmed or in_progress. Needs `btree_gist`.
  - Indexes: (owner_id, start_at), (resource_id, start_at), and a partial index on response_deadline for pending requests.
  - Care columns (caretaker_request_id, offer_id) arrive with Phase 3.
- `booking_pets` (implemented 2.6): booking_id, pet_id (primary key on both). Vet appointments take one pet.
- `booking_events` (implemented 2.6): booking_id, event (created/confirmed/declined/expired/cancelled/rescheduled/checked_in/completed/no_show/paid/pay_at_visit), from_status, to_status, actor_user_id, actor_role (owner/provider/admin/system), reason, details (JSONB), created_at. Append-only.
- `payments` (implemented 2.6, mock ledger): booking_id, provider (`mock` only), kind (charge/refund), amount_minor, currency, status, reference (unique `mock_…`), created_at.
- `care_services` (implemented 3.1, [0015](decisions/0015-caretaker-marketplace.md)): provider_profile_id, care_type (home_visit/day_care/boarding/house_sitting; unique per caretaker), rate_minor (per visit, day or night), species (dog/cat/other), max_pets (1–10 per booking), notes, active, timestamps.
- `care_requests` (implemented 3.2, [0015](decisions/0015-caretaker-marketplace.md)):
  - owner_id, care_type, start_at/end_at (UTC), visits_per_day (home visits only, 1–3)
  - area_key and locality (visible to caretakers); latitude/longitude and address (private until booked)
  - notes, budget_minor
  - status (open/booked/cancelled/expired), offers_close_at (24 h after posting, or 1 h before the start)
  - timestamps
  - Indexes: (status, start_at), (area_key, status).
- `care_request_pets` (implemented 3.2): request_id, pet_id (primary key on both); 1–5 pets.
- `care_offers` (implemented 3.3): request_id, provider_profile_id (unique together), price_minor (total), message, status (pending/accepted/declined/withdrawn), timestamps.
- `bookings` care columns (3.3): care_request_id, care_offer_id (unique), with the check `care_has_offer`. Care bookings set `service_mode` to the care type. `payment_status` gains `partially_refunded`; `cancellation_outcome` gains `late_half_refund`.
- `notifications` (implemented 2.9, [0013](decisions/0013-notifications-and-push.md)): user_id, kind (booking_request, booking_new, booking_confirmed, booking_declined, booking_expired, booking_cancelled, booking_rescheduled, booking_completed, booking_no_show, reminder_24h, reminder_2h), title, body, data (JSONB: in-app `route`, booking_id), dedupe_key (unique per user when set), read_at, push_status (pending/sent/failed/skipped), push_attempts, created_at. Indexes: (user_id, created_at), partial unread, partial pending push.
- `push_devices` (implemented 2.9): user_id, token (Expo push token, unique), platform (android/ios), created_at, last_seen_at, disabled_at (set on DeviceNotRegistered).
- `reviews` (implemented 2.10, [0014](decisions/0014-reviews-and-moderation.md)):
  - booking_id (unique: one review per booking), author_id, clinic_id or provider_profile_id (exactly one)
  - rating (1–5), text (≤1000, optional)
  - status (published/pending/removed), flag_reason, edited_at
  - reply_text (≤600), replied_at, replied_by
  - moderated_by, moderated_at, moderation_note
  - timestamps
  - Indexes: (listing, status, created_at) for each listing column, plus (status, updated_at).
- `review_reports` (implemented 2.10): review_id, reporter_id (unique per review), reason (fake/abusive/private_info/spam/other), note, created_at, resolved_at.
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
- Provider location: area_key index plus a coordinate bounding-box pre-filter, with haversine distance in Python (2.5). Consider PostGIS when listing volume needs it. Launch areas are a code list (`AreaKey`), not a table.
- Availability/provider/time indexes.
- Booking overlap: exclusion constraint on (bookable resource, time range) for slot-holding statuses (`pending_provider`, `confirmed`, `in_progress`), using `btree_gist`. Idempotency key unique per owner.
- Request/provider offer uniqueness where appropriate.
- Status/date indexes for admin queues.
- Foreign keys and cascading behavior explicitly defined.

## Data retention
Define retention for verification documents, health records, chat, reports and payment metadata with legal/privacy review. Account deletion should anonymize/delete where possible while preserving legally required transaction/audit records.
