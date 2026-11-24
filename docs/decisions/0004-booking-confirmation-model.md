# 0004 — Booking confirmation model

- **Date:** 2026-11-24
- **Status:** Accepted (revisit after pilot data)
- **Owner:** Product owner (delegated to engineering recommendation)
- **Resolves:** Open Decision #5; audit contradiction #1 (diagram showed instant booking, PRD statuses began at `requested`)

## Context
Instant booking is the best experience for owners: no waiting and no uncertainty. It only works when the provider's calendar is reliable. Home visits involve travel and location checks, and caretaker work needs the provider to judge the specific pet and dates. A single global rule fits neither case.

## Decision
Each **service** carries a `confirmation_mode`: `instant` or `request`. The owner always sees which applies *before* booking. Examples: "Instant confirmation", or "Clinic confirms within 2 hours".

| Booking kind | Default mode | Rationale |
|---|---|---|
| Vet — in-clinic appointment | `instant` | Slots come from the provider's published availability. Best UX, and the main conversion path. |
| Vet — home visit | `request` | The provider must confirm travel, area and timing. |
| Vet — teleconsultation (later phase) | `instant` | Slot-based, no travel. |
| Caretaker care | Quote flow (see below) | The PRD's request → offers → select flow. |

- Providers can switch a service to `request` if they can't keep a calendar up to date. Admins can force `request` for a provider (for example, after repeated provider cancellations).
- **Request mode:**
  - The booking is created as `pending_provider` and **holds the slot**, so it can't be double-booked.
  - The provider must confirm or decline before a `response_deadline`. The default is the earlier of 2 hours after the request or 2 hours before the start time. Both values are configurable.
  - If the provider doesn't respond in time, the booking becomes `expired`, the slot is released and the owner is notified with alternatives.
  - The owner is never charged (mock or real) until the booking is `confirmed`.
- **Caretaker flow:**
  - The owner posts a care request, and caretakers submit offers. Each offer already confirms availability and price.
  - When the owner accepts an offer, the booking is created directly as `confirmed`. A second confirmation would only add delay.
  - Accepting one offer closes the request and declines the competing offers.
- **Mock payment:** in `instant` mode it happens inside the booking review step. In `request` mode the payment step is shown after the provider confirms.

## Booking status model
| Status | Meaning |
|---|---|
| `pending_provider` | Request-mode booking waiting for the provider (slot held) |
| `confirmed` | Booking is firm |
| `in_progress` | Owner checked in at clinic / care has started (UI: "Checked in" for vet) |
| `completed` | Service delivered; review becomes available |
| `declined` | Provider declined a request |
| `expired` | Provider did not respond by the deadline |
| `cancelled_by_owner` / `cancelled_by_provider` / `cancelled_by_admin` | Cancelled, with reason and policy outcome recorded |
| `no_show` | Owner did not attend (marked by provider, disputable) |
| `disputed` | Under support review after `completed` or `no_show` |

**Allowed transitions:**
- `pending_provider` → `confirmed` | `declined` | `expired` | `cancelled_by_owner` | `cancelled_by_admin`
- `confirmed` → `in_progress` | `cancelled_by_owner` | `cancelled_by_provider` | `cancelled_by_admin` | `no_show`
- `in_progress` → `completed` | `cancelled_by_admin`
- `completed` | `no_show` → `disputed`
- `disputed` → `completed` | `cancelled_by_admin` (resolution recorded)

**Reschedule** is not a status. It changes the time of a `confirmed` booking: immediately for `instant` services, or as a new provider-confirmation step for `request` services. The change is recorded as a booking event. The PRD's former `rescheduled` and `checked_in` statuses map to this event and to `in_progress`.

Slot-holding statuses, which block overlapping bookings, are `pending_provider`, `confirmed` and `in_progress`.

## Alternatives considered
- **Instant everywhere:** best UX on paper, but unreliable provider calendars cause confirmed bookings that get cancelled, which damages trust.
- **Request everywhere:** safe for providers, but it adds waiting and drop-off for the most common case.

## Consequences
- `services.confirmation_mode` and `bookings.response_deadline` are added to the schema. An expiry job is needed in Phase 2 (a scheduled task; a worker is only added if necessary).
- The booking-flow diagram and PRD statuses were updated.
- Pilot metrics to watch: provider-cancellation rate on instant bookings, and the request response time.
