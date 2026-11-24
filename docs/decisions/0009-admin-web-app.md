# 0009 — Admin web app in the monorepo

- **Date:** 2026-11-25
- **Status:** Accepted
- **Owner:** Product owner
- **Resolves:** Open Decision #13

## Decision
- Staff tools (provider verification, suspensions, reports and moderation, booking lookup, audit log) are built as a separate **admin web app** in `admin/`.
- **Stack:** React + Vite + TypeScript, TanStack Query, React Router, and the same plum/cream design tokens (ported to CSS variables).
- **API contract:** TypeScript types are generated from `backend/openapi.json`, exactly like `mobile/`.
- **Deployment:** a static site (Render static site or Cloudflare Pages), separate from the API.
- **Independence:** `admin/` follows the same split-ready rules as `mobile/` and `backend/` ([0001](0001-monorepo.md)): its own `package.json`, lockfile, `.env.example`, CI workflow and README, and no imports from other apps.
- **Access:** staff sign in with the same OTP flow (email). Every admin API route enforces `admin` or `moderator` server-side ([0006](0006-identity-roles-and-permissions.md)). The UI only hides what the API already forbids. Staff MFA is required before production.
- **Browser sessions:** a browser can't use the OS keychain. The admin app keeps the refresh token in memory plus an httpOnly, Secure, SameSite=Strict cookie scoped to the admin origin. This cookie variant of `/auth/refresh` is implemented when the admin app is built (milestone 2.2), with CSRF protection and CORS limited to the admin origin.

## Consequences
- The API gains `/admin/*` verification and moderation endpoints, built in 2.2.
- CI gets an `admin.yml` workflow with path filters.
- The same app can later host the provider/clinic dashboard (web) if providers prefer desktop for calendars.
