# 0007 — Authentication: passwordless OTP via email or phone

- **Date:** 2026-11-24
- **Status:** Accepted
- **Owner:** Product owner (method chosen: "both email and phone OTP"); engineering design below
- **Resolves:** Open Decision #2

## Decision
- Users sign in with **either** their email address **or** their mobile number. Each time, they receive a **6-digit one-time code** (OTP). There are no passwords.
- **Sign-up and sign-in are the same flow.** Verifying a code for a new identifier creates the account, and the app then asks for a display name.
- One account can hold both a verified email and a verified phone. Adding the second identifier to an existing account (verified by OTP) follows in a later milestone. Until then, an account is keyed by whichever identifier it signed up with.

### Codes (OTP challenges)
- 6 digits, valid for 10 minutes, at most 5 verification attempts. A new request replaces any earlier unused code.
- Rate limits are stored in the database, so they work across instances:
  - 60 s resend cooldown
  - at most 5 codes per identifier per hour
  - at most 20 code requests per client IP per hour
- **Minimal personal data:** codes are stored only as keyed hashes (HMAC-SHA256 with `OTP_PEPPER`). Identifiers and IPs in the challenge table are also stored as keyed hashes, never in clear text.
- **No account enumeration:** requesting a code returns the same response whether or not an account exists.
- Phone numbers use E.164 format. Indian numbers (`+91`) must be 10 digits starting with 6–9. Other countries are accepted in E.164 for future expansion.

### Sessions and tokens
- **Access token:** a JWT (HS256, `JWT_SECRET`) valid for 15 minutes. Claims: `sub` (user), `sid` (session), `iss`, `aud`, `typ=access`. Every request also checks that the session is still active, so logout and suspension take effect immediately.
- **Refresh token:** an opaque 256-bit random value. Only its SHA-256 hash is stored, in `auth_sessions`. It is **rotated on every refresh**.
  - Reusing an already-rotated refresh token is treated as theft: the whole session is revoked and audited.
  - Sliding expiry is 30 days, with an absolute cap of 90 days.
- On the device, tokens live in the OS secure store (`expo-secure-store`). They are never kept in AsyncStorage or logs.
- The mobile client sends a single in-flight refresh request at a time, because parallel refreshes would trip reuse detection.

### Delivery providers
- Sending is behind an `OtpSender` interface.
- Local, test and CI use a **mock console sender**. It writes the code to the server log, is clearly marked as a mock, and **is refused at startup in staging and production**.
- Real email and SMS providers are chosen under Open Decision #15. Candidates: SMS via MSG91, Twilio or Gupshup; email via Amazon SES, Resend or Postmark.
- **India SMS requires DLT registration** (sender ID plus an approved message template) before production. Start that early, because it can take weeks.

### Staff roles (decision 0006, applied)
- `BOOTSTRAP_ADMIN_EMAILS` is an explicit, operator-configured allowlist. On the first verified email sign-in, a listed address receives `admin` once.
  - It is not granted again if that role was ever revoked.
  - It applies to the listed addresses whatever their domain.
- All later grants by admins require a verified email on `STAFF_EMAIL_DOMAINS`. The last active admin can't be removed. Every grant and revocation is written to `audit_logs`.

## Alternatives considered
- **Email + password, plus phone OTP:** adds password storage, reset flows and credential-stuffing risk for little user benefit.
- **A managed auth provider** (Firebase, Supabase, Clerk): faster to start, but adds vendor lock-in and per-user cost, and the domain-specific roles still have to live in our database. It remains possible later because tokens are issued behind our own API.

## Consequences
- Tables: `users`, `otp_challenges`, `auth_sessions`, `staff_roles`, `audit_logs`.
- New environment variables: `JWT_SECRET`, `OTP_PEPPER`, `OTP_DELIVERY`, `BOOTSTRAP_ADMIN_EMAILS`, `STAFF_EMAIL_DOMAINS`.
- SMS cost and abuse are controlled by rate limits now. Add CAPTCHA or app attestation if abuse appears.
