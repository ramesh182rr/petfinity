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

## Discovery
- `GET /providers?category=&lat=&lng=&radius=&service=&price_min=&price_max=&verified=&available=`
- `GET /providers/{provider_id}`
- `GET /clinics/{clinic_id}`
- `GET /services`

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

## Clinic/provider setup (planned)
- `POST /provider/profile`
- `PATCH /provider/profile`
- `POST /provider/verification-submissions`
- `POST /provider/services`
- `PATCH /provider/services/{service_id}`
- `PUT /provider/availability`
- `GET /provider/bookings`

## Bookings (vet appointments and care — one model, [decision 0005](decisions/0005-unified-bookings.md))
- `GET /providers/{provider_id}/slots?service_id=&date=`
- `POST /bookings`: vet appointment. Requires the `Idempotency-Key` header; transactional. Returns `confirmed` (instant service) or `pending_provider` (request service) — [decision 0004](decisions/0004-booking-confirmation-model.md)
- `GET /bookings`, `GET /bookings/{id}`
- `POST /bookings/{id}/confirm`, `POST /bookings/{id}/decline` (provider; request mode)
- `POST /bookings/{id}/cancel`, `POST /bookings/{id}/reschedule`
- `POST /bookings/{id}/check-in`, `POST /bookings/{id}/complete`, `POST /bookings/{id}/no-show` (provider/admin)

## Caretaker requests/offers
- `POST /caretaker-requests`
- `GET /caretaker-requests/{id}`
- `GET /caretaker-requests/{id}/offers`
- `POST /caretaker-requests/{id}/offers`
- `POST /offers/{id}/accept` (creates a `confirmed` care booking; declines competing offers)
- `POST /offers/{id}/decline`
- `GET /provider/requests` (matching requests)

## Payment mock
- `POST /bookings/{id}/payment-intent` (mock adapter; only for `confirmed` bookings)
- `POST /bookings/{id}/payment-confirmation` (mock-only; never trust the client without server state)

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
