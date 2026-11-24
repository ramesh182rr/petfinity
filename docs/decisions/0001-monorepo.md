# 0001 — Single monorepo with independent apps

- **Date:** 2026-11-24
- **Status:** Accepted (supersedes the blueprint's "separate mobile and backend repositories" default)
- **Owner:** Product owner

## Context
The blueprint (v1.0) specified separate `petfinity-mobile` and `petfinity-backend` repositories. The project is built by a solo developer with an AI coding assistant. Changes often span the API and the app, and one place to clone, review and diff reduces overhead.

## Decision
Use one repository, `petfinity/`:

```
docs/  assets/  mobile/  backend/  infrastructure/  README.md  CLAUDE.md
```

Keep it **split-ready**:
- `mobile/` and `backend/` never import from each other. There is no shared code package and no root JavaScript workspace.
- Each app owns its dependencies and lockfile, `.env.example`, `.gitignore`, README, lint/test config and CI workflow (path-filtered).
- The API contract is shared only through FastAPI's OpenAPI schema. The mobile app generates TypeScript types from it.
- Render deploys with `rootDir: backend`. Expo/EAS commands run from `mobile/`.

## Alternatives considered
- **Separate repositories:** cleaner ownership boundaries, but double the setup, review and context-switching for one developer. Cross-cutting changes become two coordinated changes.
- **Monorepo with shared packages / JS workspaces:** enables code sharing, but couples the apps, complicates Expo's Metro bundler and makes a later split harder.

## Consequences
- An app can be split out later with its history: `git filter-repo --subdirectory-filter backend` (or `mobile`). After a split, the only extra work is moving its CI workflow and docs.
- Docs 10, 14, 18, 19, 20, the product owner decisions and the blueprint README were updated to match.
- A future admin/provider web app would be another independent top-level directory, `admin/`.
