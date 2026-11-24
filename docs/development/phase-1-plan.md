# Phase 1 — Foundation plan

**Approved:** 2026-11-24 ([decision 0003](../decisions/0003-phase-1-scope.md))
**Goal:** a tested, documented base for both apps. No marketplace features are built in this phase.

Each milestone is small, independently testable, reviewed and committed manually by the product owner.

| # | Milestone | Scope | Done when |
|---|---|---|---|
| 1.0 | Repo scaffold and docs | Move the blueprint into `docs/` and `assets/`; add root README, `CLAUDE.md`, `.gitignore`, `.editorconfig`, `.node-version`; update "separate repos" wording; add decision log | Tree matches decision 0001; docs consistent ✅ |
| 1.1 | Backend skeleton | `uv` project (Python 3.13), app factory, pydantic-settings config (fails fast), `/api/v1` router, `GET /api/v1/health`, error envelope (`code`, `message`, `details`, `request_id`), request-ID middleware, structured logging without personal data; ruff, mypy, pytest | Tests pass; `/docs` OpenAPI loads |
| 1.2 | Database connectivity | SQLAlchemy 2.x engine and session (psycopg 3), Alembic setup, baseline migration (conventions only, no business tables), `GET /api/v1/health/ready` with a DB check; transactional test-database fixture | Migrations upgrade and downgrade cleanly; readiness test passes on local Postgres |
| 1.3 | Mobile skeleton | Expo (latest stable SDK) TypeScript strict, Expo Router, 5 tabs (Home, Discover, Bookings, Community, My Pets) plus a Profile route, dev build (`expo-dev-client`); ESLint, Prettier, `tsc`, Jest | Runs on the Android emulator; lint, typecheck and tests pass |
| 1.4 | Design system foundation | Final palette tokens per [decision 0002](../decisions/0002-brand-palette.md) with contrast check; typography, spacing, radius and elevation tokens; fonts; `Text`, `Button`, `Card`, `Chip`, `Screen`, loading, empty and error views | Component tests pass; tabs show branded empty states; doc 08 updated |
| 1.5 | App–API wiring | `EXPO_PUBLIC_API_URL` config, typed API client parsing the error envelope, TanStack Query provider, OpenAPI type generation script, dev-only API health indicator | The app shows live backend health on the emulator; client tests pass |
| 1.6 | CI and developer docs | GitHub Actions `backend.yml` (with a Postgres service) and `mobile.yml`, path-filtered; `docs/development/local-setup.md`; draft `infrastructure/render.yaml` (not deployed) | Workflows valid; setup doc verified end-to-end locally |
| 1.7 | *(optional)* First cloud deploy | Neon dev branch plus Render web service, health checks live. Requires product-owner accounts | Health endpoint answers over HTTPS |

## Out of scope for Phase 1
Auth and roles, pet profiles, media upload, analytics and error-logging providers (all Phase 1b), and any marketplace feature.

## Decisions needed before later phases
| Decision (doc 20 #) | Needed before |
|---|---|
| Auth method: email / phone OTP / both (#2) | Phase 1b |
| Booking policy: instant vs request-to-confirm (#5) | Phase 2 |
| Admin/provider web technology (#13) | Phase 2 |
| Map provider (#3) | Phase 2 (discovery map) |
| Single booking record vs separate appointments/bookings tables | Phase 2 |
| Payment gateway for India marketplace payouts (#8) | Phase 7 (mock until then) |

See [blueprint-audit-2026-11-24.md](blueprint-audit-2026-11-24.md) for the open consistency findings.
