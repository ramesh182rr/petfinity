# 0012 — Booking engine: cancellation policy, mock payment choice and capacity

- **Date:** 2026-11-26
- **Status:** Accepted
- **Owner:** Product owner (policy and payment); engineering (capacity and mechanics)
- **Builds on:** 0004 (instant/request), 0005 (one `bookings` record)

## Decisions made by the product owner
- **Cancellation policy (vet bookings):**
  - **Free until 2 hours before the start.**
  - Later cancellations by the parent are still allowed, but are marked `late_no_refund`. A mock charge is not refunded (`payment_status = not_refunded`).
  - Provider and admin cancellations always refund in full and require a reason.
  - Rescheduling uses the same 2-hour cutoff.
  - The policy is snapshotted on every booking (`cancellation_policy`) and returned as `policy.free_cancellation_until`, so the parent sees it before and after booking.
- **Payment (mock):**
  - Once a booking is `confirmed`, the parent chooses **Pay now (mock)** or **Pay at the visit**.
  - Nothing is ever charged. Every payment row has `provider = 'mock'`, and the API marks `payment_is_mock: true`.
  - Request-mode bookings are `not_due` until the provider confirms (0004).

## Engineering decisions
- **Capacity units:**
  - An opening window's `capacity` (1–20) is a set of numbered units for the listing (clinic or vet profile).
  - A booking takes the lowest free unit, and a Postgres **exclusion constraint** (`btree_gist`) forbids overlapping slot-holding bookings on the same unit.
  - Allocation is serialised per listing with a transaction-scoped advisory lock, so concurrent requests get a clean `409 slot_unavailable`. The constraint is the last line of defence.
  - Capacity is shared across all of a listing's services.
- **One pet per vet appointment.** `booking_pets` still supports several pets for future care bookings.
- **Species:** a pet's species must be offered by the service. Dog and cat map directly; every other species maps to `other`.
- **Home-visit address:**
  - Required when booking.
  - The provider sees it only once the booking is `confirmed` (doc 13).
- **Request mode:**
  - Request-mode slots need 60 minutes' notice (instant slots need 30).
  - `response_deadline = min(now + 2 h, start − 30 min)`.
  - Rescheduling a request-mode booking needs the provider's confirmation again (back to `pending_provider`).
- **Expiry without a worker:**
  - Overdue requests stop holding capacity immediately: availability ignores them once the deadline has passed.
  - They are marked `expired` whenever the API reads or books for that listing.
  - `python -m app.jobs.expire_bookings` (a Render cron job) also tidies them. A missed run never blocks a slot.
- **Idempotency:**
  - `POST /bookings` requires an `Idempotency-Key` header (8–64 characters), unique per parent.
  - The same key with the same body replays the original booking (`200`, `Idempotent-Replayed: true`).
  - The same key with a different body returns `422 idempotency_key_reused`.
- **Provider actions:**
  - Check-in opens 60 minutes before the start.
  - No-show can be marked from 15 minutes after the start.
  - Complete follows check-in.
- **Limits:** at most 20 active bookings per parent.

## Alternatives considered
- **Counting overlapping bookings against capacity (no units).** This can't be enforced by a database constraint, so a race could overbook.
- **A strict 24-hour cancellation window, or always free.** Rejected by the product owner.
- **Always prepay, or pay at the visit only.** Rejected by the product owner. Many clinics expect payment at the visit, and prepaying fits the future marketplace.

## Consequences
- Migration 0007 adds `bookings`, `booking_pets`, `booking_events` (append-only timeline and audit) and `payments` (mock ledger), plus the `btree_gist` extension.
- Every place slots are computed now subtracts capacity taken by bookings: the provider preview, public open times and the next free slot in search.
- Staging and production need a cron entry for the expiry job (doc 16).
