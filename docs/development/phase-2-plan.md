# Phase 2 — Vet discovery and appointment booking

**Started:** 2026-11-25 (Phase 1b.6 observability skipped for now, at the product owner's request)
**Status:** Phase 2 complete (2.1–2.10, 2026-11-27), plus a UI refresh across mobile and admin. Next phase needs product-owner approval.
**Goal:** a pet parent can find a **verified** vet or clinic, see real availability, and book an appointment (with mock payment). The provider can manage it, and the owner can review it afterwards.
**Decisions it builds on:** 0004 (instant/request confirmation), 0005 (unified bookings), 0006 (roles), 0008 (storage), 0009 (admin web app), 0010 (Google Maps, list-first).

| # | Milestone | Scope | Depends on |
|---|---|---|---|
| 2.1 | Provider and clinic onboarding (API) | `provider_profiles` (veterinarian/caretaker), `clinics`, `clinic_members`; "Become a provider"; verification submissions with **private** document uploads (PDF/images); `/me` capabilities | — |
| 2.2 | Admin verification | Queue, document review via short-lived signed URLs, approve / reject / request info, verified badge, suspension, audit. API plus **admin web UI** | 2.1 (admin web app per 0009) |
| 2.3 | Provider onboarding (app) | "Become a provider" wizard: vet or caretaker profile, clinic setup and membership, document upload, verification status | 2.1 |
| 2.4 | Services and availability | Services (category, price, duration, mode, `confirmation_mode`); weekly hours, breaks, capacity, blackout dates; slot generation in the provider's timezone. API and app (provider side) | 2.1 |
| 2.5 | Discovery | Search by launch city/area or near me (lat/lng radius), filters (service, mode, price, verified, open now), provider and clinic detail. **List first**; map view after the map decision | 2.4 |
| 2.6 | Booking engine (API) | `bookings`, `booking_pets`, `booking_events`; slot holds with an exclusion constraint; idempotency keys; instant/request state machine; request expiry job; **mock payment adapter** | 2.4 |
| 2.7 | Booking flow (app) | Pet → service → slot → notes → policy/price review → mock payment → confirmation; My bookings, detail, cancel/reschedule | 2.5, 2.6 |
| 2.8 | Provider inbox (app) | Confirm/decline requests, check-in, complete, no-show; clinic operators see all clinic bookings | 2.6 |
| 2.9 | Notifications and reminders | Expo push (behind an adapter), in-app notification list, booking reminders | 2.6 |
| 2.10 | Reviews | Only after `completed`; one per booking; moderation status | 2.6 |

**Safety rules for this phase (doc 13):**
- Unverified or suspended providers never appear in search and can't take bookings.
- Verification documents are private and are only ever shown to admins, through short-lived links.
- The verified badge says what was checked.
