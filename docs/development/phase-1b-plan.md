# Phase 1b — Identity, pets and observability

**Approved:** 2026-11-24 (auth method: email and phone OTP; [decision 0007](../decisions/0007-authentication.md))
**Status:** 1b.1–1b.5 complete (2026-11-25). 1b.6 (observability) needs a provider decision. R2 credentials are pending from the product owner; local storage is used until then.

| # | Milestone | Scope | Done when |
|---|---|---|---|
| 1b.1 | Backend identity and roles | `users`, `otp_challenges`, `auth_sessions`, `staff_roles`, `audit_logs`; OTP request/verify, refresh rotation with reuse detection, logout; `GET/PATCH /me` with capabilities; admin staff-role grant/revoke; bootstrap admin; DB-backed rate limits; mock console OTP sender | Tests cover happy paths, enumeration safety, rate limits, attempt limits, token expiry, refresh reuse, suspension, RBAC and audit |
| 1b.2 | Mobile sign-in | Welcome → email/phone → code → name onboarding; secure token storage; auth state; refresh single-flight; protected routes; sign-out | Component and flow tests; works against local API |
| 1b.3 | Pet profiles (backend) | `pets` table and CRUD with ownership checks; all species; validation | Ownership and validation tests |
| 1b.4 | Media upload | Storage switch (local dev / R2), signed upload URLs, type and size limits, content sniffing, pet photo | Signed-URL tamper/expiry and permission tests; R2 adapter tested against a stubbed S3 client |
| 1b.5 | Pet profiles (mobile) | My Pets list, create/edit form (React Hook Form + Zod), photo picker, active-pet switcher | Form and state tests |
| 1b.6 | Observability | Error monitoring and analytics adapters (provider decision needed), environments and secrets matrix | Events documented; no personal data sent |

Decisions still needed in this phase: the analytics/error-monitoring provider (1b.6), and the email/SMS providers plus DLT registration (before staging).
