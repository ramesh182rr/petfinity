# 0003 — Phase 1 is the technical foundation only

- **Date:** 2026-11-24
- **Status:** Accepted
- **Owner:** Product owner

## Context
`04_MVP_and_Roadmap.md`'s "Milestone 1 — Foundation" bundles auth, roles, pet profiles, image upload, analytics and error logging with the technical scaffolding. The product owner's initial instructions limited the first phase to scaffolding, config, database connectivity, health checks, documentation and tests.

## Decision
- **Phase 1** covers milestones 1.0–1.6, plus an optional 1.7. Scope: repo structure, backend and mobile skeletons, environment config, DB connectivity and migrations, health APIs, design tokens and UI primitives, app–API wiring, CI and developer docs. The plan is in [`../development/phase-1-plan.md`](../development/phase-1-plan.md).
- **Phase 1b** covers auth and the role model, environments and secrets, pet profiles with image upload, and analytics and error logging. It starts only after approval, and after the auth method (Open Decision #2) is chosen.

## Consequences
The foundation can be reviewed in small, independently testable steps. Feature work begins on a tested base.
