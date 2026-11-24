# Infrastructure

Deployment configuration and operational notes for Petfinity. **Nothing is deployed yet.** The first deploy is Milestone 1.7, which needs product-owner accounts.

| File | Purpose |
|---|---|
| [`render.yaml`](render.yaml) | Draft Render Blueprint for the API (`rootDir: backend`, Singapore, health check `/api/v1/health`, migrations as a pre-deploy step) |

## Environments
Local → development → staging → production. Each uses a **separate** database, storage bucket and secrets (doc 16).

| | Local | Development (1.7) | Staging / Production |
|---|---|---|---|
| API | `uvicorn` on your Mac | Render web service (free) | Render paid instance |
| Database | Homebrew PostgreSQL 16 | Neon branch `dev` | Neon branches `staging` / `main` |
| Media | — | R2 bucket `petfinity-dev` (Phase 1b) | Separate buckets |

## Neon notes
- Create the project in **AWS ap-southeast-1 (Singapore)** so it sits next to Render Singapore.
- The app uses the **pooled** connection string as `DATABASE_URL` with `DATABASE_PGBOUNCER=true` (disables prepared statements).
- Alembic uses the **direct** connection string as `DATABASE_MIGRATION_URL`.
- Change the scheme Neon gives you from `postgresql://` to `postgresql+psycopg://`.
- Test restores from Neon's point-in-time recovery before the pilot.

## Cloudflare R2 notes (Phase 1b)
- A private bucket for verification documents and sensitive uploads, accessed only through short-lived signed URLs.
- Approved public media is delivered according to privacy settings. Lifecycle rules handle deletions.

## Secrets
Never commit secrets. Configure them in the provider dashboards and document only variable **names** (see `backend/.env.example`).
