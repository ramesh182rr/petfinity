# Petfinity backend

FastAPI modular monolith: Python 3.13, SQLAlchemy 2.x (sync, psycopg 3), Alembic, PostgreSQL.

## Quick start
```bash
cd backend
uv sync                         # creates .venv with Python 3.13 and dependencies
cp .env.example .env            # local config (never commit .env)
createdb petfinity_dev          # once
uv run alembic upgrade head     # apply migrations
uv run uvicorn app.main:app --reload --port 8000
```
- Liveness: http://localhost:8000/api/v1/health
- Readiness (DB): http://localhost:8000/api/v1/health/ready
- API docs: http://localhost:8000/docs

## Checks
```bash
uv run ruff check . && uv run ruff format --check .
uv run mypy app tests
uv run pytest                   # needs local Postgres; creates petfinity_test automatically
uv run python -m app.openapi_export --check
```

## Layout
```
app/
  main.py            # create_app() factory: settings, logging, middleware, routers
  core/              # config, errors (envelope), logging, request IDs
  db/                # engine/session, declarative base + conventions
  api/v1/router.py   # registers module routers under /api/v1
  modules/<name>/    # one folder per domain module (router, schemas, service, models)
                     # e.g. discovery/ (launch areas, search, public listing pages), catalog/ (services, hours, slots),
                     # bookings/ (booking engine: capacity units, state machine, mock payments)
  dev/seed_demo.py   # demo discovery listings for local development (refuses outside local/development)
  jobs/expire_bookings.py  # cron: expire unanswered booking requests (uv run python -m app.jobs.expire_bookings)
  jobs/notifications.py    # cron: booking reminders + push outbox (uv run python -m app.jobs.notifications)
  openapi_export.py  # writes openapi.json, the contract consumed by mobile/
alembic/             # migrations (versions/ named YYYYMMDD_<rev>_<slug>.py)
tests/               # pytest against real PostgreSQL
```

## Conventions
- **Errors:** raise `AppError(code, message, status_code=…)` for expected failures. Every non-2xx response uses `{"error": {"code", "message", "details", "request_id"}}`.
- **Request IDs:** `X-Request-ID` is accepted from clients (if valid) or generated, then returned and logged.
- **Database:** endpoints using the DB are plain `def` functions and take `Session` from `Depends(get_db)`. Services own commits.
- **Migrations:** every model change needs a reviewed Alembic migration (`uv run alembic revision --autogenerate -m "…"`). `tests/test_database.py` fails if models and migrations drift.
- **Contract:** after changing any route or schema, run `uv run python -m app.openapi_export`, then `npm run api:types` in `mobile/`.
- **Logs:** never log personal data (emails, phones, addresses, tokens, pet health details).
- **Modules** never import each other's internals; they talk through service functions.

## Media storage (decision 0008)
`STORAGE_BACKEND=local` (default, dev only) stores files in `.local-storage/` and serves them through signed `/api/v1/dev-storage/…` URLs. `STORAGE_BACKEND=r2` uses Cloudflare R2 and needs the four `R2_*` variables. Both use the same `ObjectStorage` interface (`app/modules/storage/`), so routes and the app don't change.

## Configuration
All settings come from environment variables; see [`.env.example`](.env.example). Hosted environments use Neon's pooled URL for `DATABASE_URL` (`DATABASE_PGBOUNCER=true`) and the direct URL for `DATABASE_MIGRATION_URL`.
