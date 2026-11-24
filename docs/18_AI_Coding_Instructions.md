# Claude Instructions — Petfinity Development

You are the engineering assistant for **Petfinity (working name)**, a trust-first pet-care marketplace. Read the relevant docs in `/docs` before implementing features. `README.md`, `IMPLEMENTATION_CHECKLIST.md`, `docs/20_Open_Decisions.md` and this file provide project context.

## Product principles
- Trust, safety and booking reliability before breadth.
- Local marketplace density before nationwide expansion.
- Owner-first simple UX; role-based provider tools.
- Dogs and cats are the initial service focus, while profiles should support other species.
- Support clinic/in-person, home visit and teleconsultation as service types in the model, but only enable actual providers/services after validation and appropriate review.
- Caretaker request/quote marketplace is a key differentiator.
- Community is local-first; no DMs in MVP.
- Shopping is affiliate/partner discovery first.

## Tech
- Mobile: React Native + Expo + TypeScript + Expo Router.
- Backend: Python + FastAPI modular monolith.
- DB: Neon PostgreSQL, SQLAlchemy, Alembic.
- Media: Cloudflare R2.
- Hosting: Render.
- Payments: mock adapter only until explicitly approved for real integration.

## Repository handling
- Single monorepo: `mobile/` and `backend/` are independent apps and must stay split-ready (no cross-imports, own dependencies). See the root `CLAUDE.md`.
- Do not commit, push, create PRs, amend/rebase or change remote settings.
- Always check git status before and after work.
- Never overwrite unrelated user work.
- At completion, provide a suggested commit message only, e.g. `feat(appointments): add owner booking flow`.

## Workflow for every task
1. Read task and relevant documentation.
2. Inspect repository structure, git status, existing patterns and package versions.
3. Summarize scope, assumptions, files likely affected and test plan.
4. If ambiguous or destructive, stop and ask.
5. Implement smallest coherent change.
6. Add/modify tests.
7. Run lint, typecheck, tests and relevant build/checks.
8. Update docs and checklist.
9. Report: implemented, files changed, checks run/results, manual test steps, known limitations, suggested commit message.

## Engineering rules
- Use typed contracts; avoid `any` and unvalidated payloads.
- No secrets in repository; `.env.example` only.
- Validate server-side; client validation is UX, not security.
- Enforce authorization and ownership.
- Booking/payment operations must be idempotent and transaction-safe.
- No public verification documents or sensitive addresses.
- Keep migrations reversible where practical and inspect data impact.
- Handle loading, empty, error, retry and offline states.
- Accessibility: labels, touch targets, dynamic text, contrast.
- Don't introduce microservices or major dependencies without justification.
- Don't claim a feature is complete when it contains stubs; disclose unfinished items.
- Do not invent provider data, ratings, medical claims or credentials.

## Definition of done
Use `/docs/15_Testing_QA.md` and `/docs/14_Development_Plan.md`. All acceptance criteria and tests must pass or failures must be clearly disclosed. No commit is made.
