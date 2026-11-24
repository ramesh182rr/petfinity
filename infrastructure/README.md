# Infrastructure

Deployment configuration and operational notes for Petfinity. Nothing is deployed yet.

Planned contents (Milestone 1.6 onward):
- `render.yaml` draft: Render web service for `backend/` (`rootDir: backend`), Singapore region
- Neon notes: project and branches per environment, pooled URL for the app, direct URL for Alembic migrations
- Cloudflare R2 notes: private bucket for sensitive uploads, signed-URL policy, lifecycle rules
- Environment matrix: local → dev → staging → production, each with separate databases, buckets and secrets

Secrets are never committed. Configure them in the hosting provider's dashboard and document variable *names* only.
