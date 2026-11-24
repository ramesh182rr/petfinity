# Development Plan for Solo Developer + Claude

## Working rules
- Work one milestone/feature at a time.
- Do not commit changes. The human developer handles commits.
- At feature/phase completion, provide a **suggested commit message**, but do not execute git commit.
- Never push, create PRs, alter remote history or modify GitHub settings unless explicitly requested.
- Keep `mobile/` and `backend/` independent inside the monorepo: no cross-imports, separate dependencies and CI (see `10_Architecture.md`).
- Before coding, inspect repo, current branch, status and existing conventions.
- Don't overwrite existing work without explaining and asking when destructive.
- Implement tests and update docs with each feature.
- Keep API and database contracts aligned.
- Avoid placeholder TODOs in a claimed complete feature; identify any remaining work.
- Prefer small, reviewable changes and run relevant tests.

## Suggested sequence
1. Product decision and repo bootstrap.
2. Backend skeleton, config, DB, migrations, health endpoint, tests.
3. Mobile app shell, navigation, design tokens, lint/typecheck.
4. Auth and roles.
5. Pet profiles and media upload.
6. Provider onboarding/admin verification.
7. Clinic/provider listings and search.
8. Services and availability.
9. Appointment booking state machine.
10. Mock payment adapter and booking records.
11. Care requests and caretaker offers.
12. Booking management, reviews, cancellation.
13. Community feed and moderation.
14. Notifications.
15. Pilot analytics, bug bash, security and store preparation.

## Definition of done
- Acceptance criteria satisfied.
- Tests added/updated and pass.
- Typecheck/lint pass.
- No secrets or personal data in code/logs.
- Loading/empty/error/success states.
- Authorization checks.
- API docs and README updated.
- Manual test instructions.
- Known limitations listed.
- Suggested commit message provided.

## Claude prompt protocol
Claude should first summarize the task, assumptions, files to change and test plan. For tasks with ambiguity, ask before making broad changes. Then implement, test, summarize, list files changed, state limitations and provide suggested commit message. Never commit.
