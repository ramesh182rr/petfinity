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

## Auth & profile
- `POST /auth/register`
- `POST /auth/login` / auth-provider callback
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /me`, `PATCH /me`
- `GET /me` includes derived capabilities (`pet_parent`, `veterinarian`, `caretaker`, `clinic_operator`, `moderator`, `admin`) and provider verification statuses ([decision 0006](decisions/0006-identity-roles-and-permissions.md))
- `POST /me/provider-profiles` (become a veterinarian or caretaker)
- `POST /clinics` (the creator becomes a clinic operator), `POST /clinics/{id}/members`

## Pets
- `GET /pets`
- `POST /pets`
- `GET /pets/{pet_id}`
- `PATCH /pets/{pet_id}`
- `DELETE /pets/{pet_id}`
- `POST /pets/{pet_id}/media-upload-url`

## Discovery
- `GET /providers?category=&lat=&lng=&radius=&service=&price_min=&price_max=&verified=&available=`
- `GET /providers/{provider_id}`
- `GET /clinics/{clinic_id}`
- `GET /services`

## Clinic/provider setup
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
