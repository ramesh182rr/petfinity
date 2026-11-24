# Project Conventions

## Naming
- Product name Petfinity is provisional.
- Repository: `petfinity` (monorepo). Mobile app in `mobile/`, API in `backend/`.
- If split later, the repositories become `petfinity-mobile` and `petfinity-backend`.
- API prefix `/api/v1`.

## Git policy
- User owns commits and pushes.
- Claude never commits.
- Suggest a Conventional Commit-style message when a feature or phase is complete.
- Examples: `feat(pets): add multi-pet profiles`, `feat(booking): implement appointment confirmation`, `fix(discovery): handle denied location permission`.

## Branching
Recommend feature branches, but Claude should not create/change branches without explicit instruction. The user chooses branch policy.

## Documentation
- Feature requirements and acceptance criteria live in docs.
- Update OpenAPI/API notes and DB docs with contract changes.
- Maintain implementation checklist.
- Record decisions in Open Decisions/Decision Log.

## Code quality
- Keep components/modules focused.
- Shared design tokens and UI primitives.
- Avoid duplicated business rules between client and server.
- Server is source of truth for permissions, booking status, pricing snapshots and payments.
- Use consistent error handling and logging; no personal/sensitive data in logs.
