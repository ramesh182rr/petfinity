# Petfinity — instructions for Claude

This file governs work in this repository. `~/Github/CLAUDE.md` describes the unrelated **Gallerials** workspace and does not apply here.

## Git (absolute)
- **Never** run `git commit`, amend, merge, rebase, push, open PRs, or create/switch branches unless explicitly asked.
- Never discard or overwrite user changes. Check `git status` before and after work.
- After each milestone, report:
  1. a summary
  2. the files created or modified
  3. the tests run and their results
  4. outstanding issues
  5. a suggested Conventional Commit message
  6. a statement that the changes are ready for manual review and commit

## Working method
- One milestone at a time. Do not start a new phase without the product owner's approval.
- The current plan is in [`docs/development/phase-3-plan.md`](docs/development/phase-3-plan.md) (earlier: phase-1, phase-1b, phase-2). Progress is tracked in [`docs/IMPLEMENTATION_CHECKLIST.md`](docs/IMPLEMENTATION_CHECKLIST.md).
- Read the relevant `docs/` files before non-trivial work. [`docs/18_AI_Coding_Instructions.md`](docs/18_AI_Coding_Instructions.md) is the detailed rulebook.
- Documented product decisions are authoritative. If two documents contradict each other, report it; don't silently pick one. Record new decisions in `docs/decisions/`.
- Major product decisions belong to the product owner. Ask concisely, and only if the docs don't already answer the question.

## Monorepo boundaries (keep split-ready)
- `mobile/`, `admin/` and `backend/` are independent apps: no imports across them, no shared packages, no root JS workspaces.
- Each app owns its dependencies, lockfile, `.env.example`, README, lint/test config and CI workflow.
- The API contract crosses the boundary only as OpenAPI. Mobile types are generated from it.

## Engineering rules (summary)
- No secrets in the repo; only `.env.example` files. All config comes from environment variables.
- Validate on the server; ownership and RBAC checks on every resource; idempotent, transactional booking and payment operations.
- Never expose verification documents, private pet records or exact addresses. Never present unverified providers as verified.
- Mock payments must be clearly labelled as mocks.
- Mobile: use design tokens only (no ad-hoc colours). Every screen needs loading, empty, error and success states, plus accessible touch targets.
- Backend tests run against real PostgreSQL, not SQLite.
- After changing an API, the schema, navigation, env vars or the dev setup, update the matching docs.

## UI quality bar (product owner, 2026-11-25, applies to ALL future work)
- The UI must look like a polished, distinctive commercial product: attractive, warm and engaging, never bland.
- Each new screen gets a deliberate visual treatment:
  - gradient or accent headers, and soft decorative shapes in the moodboard style
  - a clear hierarchy: eyebrow label, title, then supporting text
  - richer components: stat tiles, icon-badge list rows, status pills
  - no plain stacks of cards
- Shapes and alignment must be precise:
  - card radius 20–24, pill buttons and chips, circular avatars with rings
  - a 4-point grid with equal gutters
  - equal-height (and, where sensible, equal-width) buttons in a row
  - centred icons
- Check every UI change visually (emulator or browser screenshots) before calling it done. This applies to `mobile/` and `admin/`.

## Toolchain
- Node 24 LTS (`.node-version`, used by fnm). The machine default stays Node 18 for other projects.
- Python 3.13 via `uv`.
- Local PostgreSQL 16 (Homebrew service).
