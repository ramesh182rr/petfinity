# Testing & QA

## Backend
- Unit tests for services, validation and state transitions.
- Integration tests against test DB.
- API tests for authentication, ownership and RBAC.
- Booking concurrency/double-booking tests.
- Idempotency tests.
- Provider verification/admin audit tests.
- Upload permission and signed URL expiry tests.
- Pagination/filter/search tests.

## Mobile
- Unit/component tests for forms, cards, navigation and state.
- E2E flows for onboarding, add pet, search, booking, caretaker request and community post.
- Permission denied and manual-location scenarios.
- Offline/slow network, retries and app resume.
- Android devices with small/large screen, accessibility font scale and TalkBack.
- Later iOS validation and VoiceOver.

## Marketplace tests
- Slot race: two owners attempt same slot; only one confirmation.
- Request-mode booking holds its slot; provider confirm/decline; unanswered request expires at the deadline and releases the slot.
- Every allowed and forbidden booking status transition ([decision 0004](decisions/0004-booking-confirmation-model.md)).
- Provider cancellation and owner cancellation.
- No-show and completion.
- Care request quote expiration and acceptance.
- Provider suspended after booking.
- Review eligibility only after completed booking.
- Mock payment failure/success/refund states.

## Safety/privacy tests
- Owner cannot view another owner's pet.
- Provider only sees booking-related information; clinic operators see only their clinic's bookings.
- Staff roles cannot be gained by changing email; grants and revocations are audited.
- Unverified or suspended providers are absent from search and cannot receive bookings.
- Verification documents never appear in public endpoints.
- Blocked users cannot interact as expected.
- Report flow and moderation action audit.
- Sensitive location hidden from public feed.

## Release checklist
- Build reproducible.
- Staging smoke tests.
- Crash/error monitoring.
- Privacy/terms and permission copy reviewed.
- App icon, screenshots, store listing and support contact.
- No production payment without settlement/refund/compliance checks.
- Backups and restore verified.
