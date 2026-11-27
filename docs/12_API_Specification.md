# API Specification — Initial Contract Outline

Base: `/api/v1`. FastAPI OpenAPI is the source of truth; the exported contract is `backend/openapi.json`. JSON, consistent error codes, pagination and request IDs.

## Implemented (Phase 1)
- `GET /health`: liveness. Does not touch the database.
- `GET /health/ready`: readiness. Checks database connectivity and returns 503 with the error envelope if it is down.
- Every response carries an `X-Request-ID` header. A client-supplied `X-Request-ID` (≤ 64 chars of `[A-Za-z0-9._-]`) is reused; otherwise one is generated.
- Error envelope, used by every non-2xx response:
  ```json
  {"error": {"code": "validation_error", "message": "Request validation failed.", "details": [...], "request_id": "…"}}
  ```
  Phase 1 codes: `bad_request`, `unauthorized`, `forbidden`, `not_found`, `method_not_allowed`, `conflict`, `validation_error`, `rate_limited`, `not_ready`, `internal_error`.
- Timestamps in responses are always UTC (ISO-8601).

## Implemented (Phase 1b.1 — [decision 0007](decisions/0007-authentication.md))
| Endpoint | Auth | Notes |
|---|---|---|
| `POST /auth/otp/request` `{channel: email\|phone, destination}` | — | 202 `{destination_masked, expires_in_seconds, resend_after_seconds}`. Same response whether or not the account exists. 429 `rate_limited` with `details.retry_after_seconds`; 422 `invalid_identifier` |
| `POST /auth/otp/verify` `{channel, destination, code}` | — | Signs in, creating the account on first use. Returns `{access_token, refresh_token, token_type, expires_in, refresh_expires_at, user, is_new_user}`. 400 `invalid_code`, 429 `too_many_attempts`, 403 `account_suspended` |
| `POST /auth/refresh` `{refresh_token}` | — | Rotates the refresh token. A reused (already rotated) token revokes the session. 401 `invalid_refresh_token` |
| `POST /auth/logout` | Bearer | 204. Revokes the current session only |
| `GET /me`, `PATCH /me` `{display_name}` | Bearer | Profile and derived `capabilities` |
| `GET/POST /admin/staff-roles`, `DELETE /admin/staff-roles/{id}` | Admin | Grants need a verified staff-domain email (409 `staff_email_required`). 409 `last_admin`, 409 `role_already_granted`. Audited |

Phase 1b.1 error codes: `invalid_identifier`, `invalid_code`, `too_many_attempts`, `account_suspended`, `invalid_refresh_token`, `staff_email_required`, `role_already_granted`, `last_admin`, `user_not_active`.

## Auth & profile
- Sign-in: see "Implemented (Phase 1b.1)" above. Registration is part of `POST /auth/otp/verify`.
- Planned: `POST /me/identifiers` (add a second, OTP-verified email or phone); account deletion/export.
- `GET /me` includes derived capabilities (`pet_parent`, `veterinarian`, `caretaker`, `clinic_operator`, `moderator`, `admin`) and provider verification statuses ([decision 0006](decisions/0006-identity-roles-and-permissions.md))
- `POST /me/provider-profiles` (become a veterinarian or caretaker)
- `POST /clinics` (the creator becomes a clinic operator), `POST /clinics/{id}/members`

## Pets (implemented 1b.3–1b.4)
Owner only. Another user's pet returns **404**, so a pet's existence is never revealed.
- `GET /pets`, `POST /pets` (201), `GET /pets/{pet_id}`
- `PATCH /pets/{pet_id}`: partial update. Omitted fields are unchanged; `null` clears optional fields. `name` and `species` can't be cleared.
- `DELETE /pets/{pet_id}` (204): soft delete; the photo is removed from storage.
- Fields: `name` (required, ≤ 50), `species` (dog, cat, bird, rabbit, guinea_pig, hamster, fish, turtle, reptile, horse, cow, goat, other), `species_other` (required for other), `breed`, `sex` (male/female/unknown), `date_of_birth` (+ `date_of_birth_is_estimate`), `weight_kg` (0–2000, 2 decimals), `neutered`, `temperament`, `dietary_notes`, `allergies`, `known_conditions`, `medications`, `emergency_contact_name`, `emergency_contact_phone` (E.164), `photo_url` (signed, short-lived).
- Errors: 409 `pet_limit_reached` (default 30 per owner), 422 `validation_error`.

### Pet photos ([decision 0008](decisions/0008-media-storage.md))
1. `POST /pets/{pet_id}/photo/upload-url` `{content_type, size_bytes}` → 201 `{media_id, upload: {url, method, headers}, expires_at}`. Errors: 415 `unsupported_media_type`, 413 `file_too_large`, 429 `rate_limited`.
2. The client sends `upload.method` (PUT) to `upload.url` with `upload.headers` and the raw bytes. The URL is absolute for R2, or API-relative in local dev.
3. `PUT /pets/{pet_id}/photo` `{media_id}` → the pet. The API verifies existence, size and real file type. Errors: 409 `upload_not_found` / `upload_already_used`, 422 `invalid_file`.
- `DELETE /pets/{pet_id}/photo` → the pet, with the photo removed.

## Discovery (implemented 2.5, [decision 0011](decisions/0011-launch-areas-and-locations.md))
Signed-in users only.

What is listed:
- Only **verified, active** clinics and veterinarians with at least one active service. Vets appear only for their home-visit services.
- Anything else returns 404, the same as a missing ID.

Origin: either `area` (a launch-area key) or `lat` + `lng` (device location, never stored). With neither, the API returns 422 `location_required`.

| Method and path | Purpose |
|---|---|
| `GET /discover/areas` | The 10 launch areas with centre points, the default/max radius (10/25 km) and vet travel radius choices |
| `GET /discover/search` | Search. Parameters: origin; `radius_km` (1–25, default 10); `kind` (all/clinic/vet); `category`; `mode` (in_clinic/home_visit); `species`; `price_max_minor`; `open_now`; `emergency`; `q` (name, locality or qualifications); `sort` (distance/price); `limit` (≤50); `offset`. Returns `{items, total, origin, radius_km}` |
| `GET /discover/clinics/{id}` | Public clinic page (optional origin for distance) |
| `GET /discover/vets/{id}` | Public home-visit vet page (optional origin for `visits_you`) |
| `GET /discover/clinics/{id}/slots?service_id&date` | Open slots for one service on one date |
| `GET /discover/vets/{id}/slots?service_id&date` | Same, for a vet's home-visit service |

How results are worked out:
- **Clinics** match when within `radius_km` of the origin. **Vets** match when the origin is inside the vet's own travel radius (`service_radius_km`, default 10).
- Each listing summarises its matching services: modes, categories, from-price, count.
- `open_now` uses today's hours and exceptions in the listing's timezone.
- `next_slot_at` is the earliest slot within 7 days for the shortest matching service. It is computed for the returned page only.
- A listing without an exact pin uses its area's centre, with `distance_is_approximate: true`.

Privacy (doc 13):
- Public shapes never include phone or email, registration numbers, verification documents, slot capacity or internal day-off notes.
- A vet's base coordinates are never returned, and neither is a distance to the vet. Only `area_name` and `service_radius_km` are shown.
- `badge.checks` says in plain words what was verified.

Provider-side location fields:
- `ClinicCreate`/`ClinicUpdate` and `ProviderProfileCreate`/`ProviderProfileUpdate` accept `area_key`.
- Profiles also accept `latitude`, `longitude` and `service_radius_km` (5, 10, 15 or 25).
- A pin must lie within 50 km of the chosen area (422 `location_outside_area`).
- Without an area, it is inferred from the pin or the city.

## Provider onboarding and verification (implemented 2.1)
Authorisation: provider profiles are owner-only; clinic edits are for operators only; non-members get 404.
- `GET/POST /me/provider-profiles`, `GET/PATCH /me/provider-profiles/{id}`
  - `provider_type`: veterinarian or caretaker, one each per person; profiles start as `draft`.
  - Fields: display_name, bio, years_experience, languages, city, plus registration_number, registration_council and qualifications for vets.
  - Changing credentials on a verified profile resets it to `draft`. They can't be changed while the profile is `submitted` (409 `under_review`).
- `POST /clinics`: the creator becomes the **operator**. `practises_here: true` also lists them as the clinic's vet, which needs a veterinarian profile (409 `veterinarian_profile_required`). `GET /me/clinics`, `GET /clinics/{id}` (members), `PATCH /clinics/{id}` (operators).
  - Contact phone numbers accept Indian landlines and mobiles and are stored as E.164.
  - PIN codes must be 6 digits.
  - Latitude and longitude are optional, but must be given together.
- **Verification** at `/verification/{subject_type}/{subject_id}`, where `subject_type` is `provider_profile` or `clinic`:
  - `GET`: status, required and missing documents, missing fields, document metadata and the latest submission. **Document contents and URLs are never returned to applicants.**
  - `POST …/documents/upload-url` `{doc_type, content_type, size_bytes}`: PDF/JPEG/PNG/WebP up to 10 MB, stored under the private `verification/…` prefix. Then `POST …/documents` `{media_id, doc_type}`.
  - `DELETE …/documents/{id}`: only while editable, and only documents not yet submitted.
  - `POST …/submit` `{note}` → `submitted`. Errors: 422 `verification_incomplete` (with the missing items), 409 `already_submitted` / `already_verified` / `verification_locked`.
  - Required: vet = identity + vet_registration (and registration number and council); caretaker = identity; clinic = clinic_registration.
- `/me` `capabilities` now include `veterinarian`, `caretaker` (active profiles) and `clinic_operator`.

## Admin verification (implemented 2.2, admin only)
- `GET /admin/verification/submissions?status=pending|needs_info|approved|rejected&subject_type=&limit=&before=`: pending is oldest first, the others newest first. Entries include label, kind, city and submitter contact.
- `GET /admin/verification/submissions/{id}`: subject details, applicant, note, previous submissions, and documents with **5-minute signed URLs**. Each view writes `verification.submission_viewed` to the audit log.
- `POST /admin/verification/submissions/{id}/decision` `{decision: approve|needs_info|reject, reason}`.
  - A reason is required for needs_info and reject, and the applicant sees it.
  - Approving sets the subject to `verified` with `verified_at`.
  - Errors: 403 `self_review`, 409 `already_decided`, 422 `reason_required`.
- `POST /admin/verification/{subject_type}/{subject_id}/status` `{status: active|suspended, reason}`: suspend or reactivate. Audited.

## Browser sessions (implemented 2.2, [decision 0009](decisions/0009-admin-web-app.md))
- `POST /auth/web/otp/verify`, `POST /auth/web/refresh`, `POST /auth/web/logout`.
- These are the same as the mobile endpoints, except the refresh token is set as an httpOnly, Secure, SameSite=Strict cookie (`pf_web_refresh`, path `/api/v1/auth/web`) and never appears in the response body.
- They require the header `X-Requested-With: petfinity-web` (CSRF protection). Without it the API returns 403.

## Services and availability (implemented 2.4)
All routes are under `/api/v1/manage/{owner_type}/{owner_id}`, where `owner_type` is `clinic` or `provider_profile`.

Access:
- clinic: active clinic operators only.
- provider_profile: the profile's owner only, and only for veterinarians. Caretakers get 422 `services_not_supported`, because caretaking runs on requests and offers.
- Non-members and non-owners get 404 (no existence leak). Clinic members who are not operators get 403 `forbidden`. Every change is written to the audit log.

| Method and path | Purpose |
|---|---|
| `GET /services` | List services (archived ones excluded) |
| `POST /services` | Create. Defaults: confirmation `instant` for in_clinic, `request` for home_visit; species `["cat","dog"]`. Max 50 per owner |
| `PATCH /services/{id}` | Partial update, including `active` (bookable on/off) |
| `DELETE /services/{id}` | Archive (204) |
| `GET /availability` | Weekly hours plus the owner's timezone |
| `PUT /availability` | Replace the whole week: `{"rules":[{weekday,start_time,end_time,capacity}]}` |
| `GET /exceptions` | Upcoming days off and special hours |
| `POST /exceptions` | Add `{on_date, kind: closed\|custom_hours, start_time?, end_time?, capacity?, note?}` |
| `DELETE /exceptions/{id}` | Remove (204) |
| `GET /slots?service_id&date` | Owner-side preview of generated slots for one date (UTC start/end plus local labels) |

Error codes (422): `mode_unavailable` (teleconsult), `clinic_required` (in-clinic service on a vet profile), `service_limit_reached`, `overlapping_hours`, `too_many_ranges`, `already_closed`, `has_special_hours`, `invalid_date` (past or beyond 60 days), `services_not_supported`.

Public read endpoints for discovery arrive in 2.5.

## Provider bookings (planned, 2.8)
- `GET /provider/bookings`

## Bookings (implemented 2.6: decisions [0004](decisions/0004-booking-confirmation-model.md), [0005](decisions/0005-unified-bookings.md), [0012](decisions/0012-booking-policy-payments-capacity.md))
One resource for parents, providers and admins. Every response includes:
- `viewer_role`: owner, provider or admin
- `allowed_actions`: what the caller may do next (cancel, reschedule, pay, pay_at_visit, confirm, decline, check_in, complete, no_show)
- `policy.free_cancellation_until`
- `payment_status` and `payment_is_mock: true`

Bookings are visible only to the parent, the listing's operators or vet, and admins. Anyone else gets 404.

| Method and path | Who | Purpose |
|---|---|---|
| `POST /bookings` | parent | Book a vet appointment (see below) |
| `GET /bookings?scope=upcoming\|past` | parent | My bookings |
| `GET /bookings/{id}` | any viewer | Detail, with the `events` timeline and mock `payments` |
| `POST /bookings/{id}/confirm` | provider | Accept a request before its `response_deadline` |
| `POST /bookings/{id}/decline` | provider | Decline a request (optional `reason`) |
| `POST /bookings/{id}/cancel` | parent, provider, admin | Cancel. `reason` is required for provider and admin |
| `POST /bookings/{id}/reschedule` | parent | Move to another open slot (`start_at`), up to 2 h before the start |
| `POST /bookings/{id}/check-in` | provider | From 60 min before the start → `in_progress` |
| `POST /bookings/{id}/complete` | provider | `in_progress` → `completed` |
| `POST /bookings/{id}/no-show` | provider | From 15 min after the start |
| `POST /bookings/{id}/payment` | parent | **Mock.** `{"method": "pay_now" \| "pay_at_visit"}`. Confirmed bookings only; nothing is charged |
| `GET /manage/{owner_type}/{owner_id}/bookings?scope=requests\|upcoming\|past` | provider | Provider inbox for one listing. `requests` = pending (by deadline); `upcoming` = confirmed and checked in (requests excluded); `past` = everything finished |

`POST /bookings` in detail:
- **Body:** `{listing_kind: clinic|vet, listing_id, service_id, start_at, pet_ids: [one pet], owner_notes?, visit_address?}`
- **Idempotency-Key header (8–64 characters) is required.**
  - Same key and same body → `200` with `Idempotent-Replayed: true`.
  - Same key, different body → `422 idempotency_key_reused`.
- **Result:**
  - Instant service → `201 confirmed`, `payment_status: unpaid`.
  - Request service → `201 pending_provider`, with `response_deadline = min(now + 2 h, start − 30 min)` and `payment_status: not_due`.

Cancellation outcomes:

| Situation | `cancellation_outcome` | `payment_status` |
|---|---|---|
| Pending request | `not_charged` | unchanged |
| Parent, free window, paid | `full_refund` | `refunded` (mock refund row) |
| Parent, free window, not paid | `not_charged` | unchanged |
| Parent, inside the last 2 h | `late_no_refund` | `not_refunded` if paid |
| Provider or admin | `full_refund` if paid, else `not_charged` | `refunded` if paid |

Errors:

| Code | Meaning |
|---|---|
| `400 idempotency_key_required` | |
| `404` | Unlisted listing, missing booking, or not yours |
| `409 slot_unavailable` | Not an open slot, or capacity is full |
| `409 action_not_allowed` | |
| `409 invalid_transition` | |
| `409 request_expired` | |
| `409 reschedule_too_late` | |
| `409 service_unavailable` | Reschedule only |
| `422 pet_not_found` | |
| `422 species_not_offered` | |
| `422 address_required` | Home visits |
| `422 own_listing` | |
| `422 service_unavailable` | |
| `422 invalid_date` | Beyond 60 days |
| `422 too_many_bookings` | More than 20 active |
| `422 reason_required` | |

Capacity: each booking takes a numbered capacity unit of its listing, and an exclusion constraint forbids overlapping holds on one unit. Public open times, the workspace preview and the next free slot in search all subtract booked capacity.

Care bookings (`POST /offers/{id}/accept`) arrive in Phase 3.

## Caretaker requests/offers
- `POST /caretaker-requests`
- `GET /caretaker-requests/{id}`
- `GET /caretaker-requests/{id}/offers`
- `POST /caretaker-requests/{id}/offers`
- `POST /offers/{id}/accept` (creates a `confirmed` care booking; declines competing offers)
- `POST /offers/{id}/decline`
- `GET /provider/requests` (matching requests)

## Payment mock (implemented 2.6)
- `POST /bookings/{id}/payment` (above) replaces the planned payment-intent and confirmation pair while payments are mocked.
- State is entirely server-side: payment rows have `provider = 'mock'` and a `mock_…` reference.
- A real gateway will sit behind the same endpoint, with a payment intent step, once settlement and compliance are decided (doc 07).

## Community
- `GET /feed?scope=local|following`
- `POST /posts`
- `GET /posts/{id}`
- `POST /posts/{id}/reactions`
- `POST /posts/{id}/comments`
- `POST /reports`
- `POST /blocks`

## Notifications & admin
- `GET /notifications`, `PATCH /notifications/{id}/read`
- `GET /admin/provider-verifications`
- `POST /admin/providers/{id}/verification-decision`
- `GET /admin/reports`, `POST /admin/reports/{id}/action`
- `GET /admin/bookings`
- `POST /admin/staff-roles`, `DELETE /admin/staff-roles/{id}` (admin only; verified staff-domain emails only; audited)

## API contract requirements
- Authorization/ownership checks on every resource.
- Standard error response: `code`, `message`, `details`, `request_id`.
- Pagination: cursor preferred for feeds; limit/offset acceptable for admin.
- Date/time: ISO-8601 with timezone; store UTC, retain provider timezone.
- Price snapshots in bookings to avoid later service price changes affecting historical booking.
- Idempotency for booking and payment mutations.
- API tests cover permission failures and race conditions.
