# 0006 — Identity, roles and permissions

- **Date:** 2026-11-24
- **Status:** Accepted (implemented in Phase 1b)
- **Owner:** Product owner
- **Resolves:** audit contradiction #3 (the PRD lists veterinarian, clinic operator, caretaker, admin and moderator; `user_roles` only had owner/provider/admin)

## Requirements (product owner)
- All roles are needed: pet parent (user), veterinarian, clinic operator, caretaker, moderator and admin.
- One unified sign-in. A vet can also be a clinic operator, and a pet parent can also be a caretaker.
- Admins and moderators should be distinguishable by email.

## Decision

### 1. One account per person, one sign-in
Every person has a single `users` account. The sign-in method is still Open Decision #2. Capabilities are **added** to that account, never chosen at login. The app never shows a "log in as vet / log in as owner" toggle.

### 2. Three kinds of capability
| Capability | How it is held | Notes |
|---|---|---|
| **Pet parent** | Implicit: every active account | No row needed. Owning a pet is enough to book. |
| **Veterinarian**, **Caretaker** | `provider_profiles` row (`user_id`, `provider_type`, `verification_status`, `status`), unique per (user, type) | A person can hold both. Each profile is verified separately. |
| **Clinic operator** | `clinic_members` row (`clinic_id`, `user_id`, `member_role` = `operator` \| `veterinarian`, `status`) | A clinic is a business with its own verification. A vet who runs their own clinic has a vet profile, an `operator` membership and a `veterinarian` membership. A non-vet manager can be an operator. |
| **Moderator**, **Admin** | `staff_roles` row (`user_id`, `role`, `granted_by`, `granted_at`, `revoked_at`) | Platform staff only. Every grant and revocation is audited. |

`GET /me` returns the derived capability list, for example `["pet_parent", "caretaker", "clinic_operator"]`, plus each provider profile's verification status. The app then shows a **workspace switcher** ("Pet parent" / "Provider") once a provider capability exists. Admin and moderator tools live in the admin web (Open Decision #13), not in the consumer app.

### 3. Staff roles and email: eligibility, not authority
The product owner's idea of distinguishing admins and moderators by email is kept, with one refinement for safety. **Email decides who *may* become staff. A stored, audited role grant decides who *is* staff.**
- `STAFF_EMAIL_DOMAINS` (env) lists the company domains, for example `petfinity.<tld>`. The domain is pending brand clearance. Staff roles can only be granted to accounts with a **verified** email on one of these domains.
- `BOOTSTRAP_ADMIN_EMAILS` (env) lists the founder address(es). The first time such an account signs in with a verified email, it receives `admin` once, recorded in the audit log. After that, admins grant and revoke `moderator` or `admin` from the admin tool.
- If an account's email changes off a staff domain, its staff roles are revoked automatically.
- Staff accounts must use MFA before production launch.

**Why not grant power purely from the email address?** Anyone able to register or switch to a matching address would become an admin. A lapsed domain or a mail-forwarding mistake would become a breach. There would also be no record of who granted what, and no clean way to revoke one person's access.

### 4. Permission scopes
| Area | Pet parent | Veterinarian | Clinic operator | Caretaker | Moderator | Admin |
|---|---|---|---|---|---|---|
| Own pets and bookings | ✅ | ✅ (as owner) | ✅ (as owner) | ✅ (as owner) | — | read for support |
| Own provider profile and services | — | ✅ | clinic's profile, services, staff, hours | ✅ | — | ✅ |
| Booking inbox and actions | — | own appointments | all clinic appointments | own care bookings and offers | — | ✅ |
| Booking-related pet info | — | for their bookings only | for clinic bookings only | for their bookings only | — | ✅ (audited) |
| Community moderation | report/block | report/block | report/block | report/block | ✅ act on reports and content | ✅ |
| Provider verification decisions | — | — | — | — | — | ✅ |
| Suspensions, staff grants, policy config | — | — | — | — | — | ✅ |

### 5. How a request is authorised (layers)
1. **Authenticated** and account `status = active`.
2. **Capability:** the needed profile, membership or staff role exists and is active.
3. **Resource scope:** ownership, clinic membership or booking participation. This is checked in the service layer on every resource, never only in the UI.
4. **State/verification gate:** unverified or suspended provider profiles can be set up and edited, but they never appear in public search and can't receive bookings or send offers.

## Alternatives considered
- **Single role column per user:** forbids "vet + clinic operator" and "pet parent + caretaker".
- **Generic `user_roles(role)` for everything:** loses the per-profile verification status and per-clinic scoping that real permissions depend on.
- **Email-derived staff authority:** rejected for the reasons in section 3.

## Consequences
- Doc 11's `user_roles`, `providers` and `provider_staff` become `staff_roles`, `provider_profiles` and `clinic_members`. Docs 03, 11, 12 and 13 were updated.
- Implemented in Phase 1b together with authentication.
