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

## Cloudflare R2 ([decision 0008](../docs/decisions/0008-media-storage.md))
The adapter is implemented. Until keys are added, development uses `STORAGE_BACKEND=local`.

To switch on:
1. Create a **private** bucket per environment (`petfinity-dev`, `petfinity-staging`, `petfinity-prod`).
2. Create an R2 API token with **Object Read & Write**, scoped to that bucket only.
3. Set `STORAGE_BACKEND=r2`, `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`, either in `backend/.env` or in the Render dashboard.
4. A bucket CORS rule is needed only for web uploads; the native app doesn't need one.

- Upload URLs sign the exact content type and length.
- Downloads use 1-hour signed URLs.
- Add a lifecycle rule later to clean up never-confirmed uploads under `pets/`.

## Secrets
Never commit secrets. Configure them in the provider dashboards and document only variable **names** (see `backend/.env.example`).
