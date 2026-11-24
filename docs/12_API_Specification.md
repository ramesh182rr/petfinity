# API Specification — Initial Contract Outline

Base: `/api/v1`. FastAPI OpenAPI is the source of truth. JSON, consistent error codes, pagination and request IDs.

## Auth & profile
- `POST /auth/register`
- `POST /auth/login` / auth-provider callback
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /me`, `PATCH /me`
- `GET /me/roles`, `POST /me/provider-onboarding`

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

## Appointments
- `GET /providers/{provider_id}/slots?service_id=&date=`
- `POST /appointments` (idempotency key; transactional)
- `GET /appointments/{appointment_id}`
- `POST /appointments/{appointment_id}/cancel`
- `POST /appointments/{appointment_id}/reschedule`
- `POST /appointments/{appointment_id}/complete` (provider/admin)

## Caretaker requests/offers
- `POST /caretaker-requests`
- `GET /caretaker-requests/{id}`
- `GET /caretaker-requests/{id}/offers`
- `POST /caretaker-requests/{id}/offers`
- `POST /offers/{id}/accept`
- `POST /offers/{id}/decline`
- `GET /provider/requests` (matching requests)

## Bookings/payment mock
- `GET /bookings`
- `GET /bookings/{id}`
- `POST /bookings/{id}/payment-intent` (mock adapter)
- `POST /bookings/{id}/payment-confirmation` (mock-only; never trust client without server state)
- `POST /bookings/{id}/cancel`

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

## API contract requirements
- Authorization/ownership checks on every resource.
- Standard error response: `code`, `message`, `details`, `request_id`.
- Pagination: cursor preferred for feeds; limit/offset acceptable for admin.
- Date/time: ISO-8601 with timezone; store UTC, retain provider timezone.
- Price snapshots in bookings to avoid later service price changes affecting historical booking.
- Idempotency for booking and payment mutations.
- API tests cover permission failures and race conditions.
