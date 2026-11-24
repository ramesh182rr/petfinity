# Local development setup

A step-by-step guide to running Petfinity's API and Android app on a Mac (Apple silicon). Verified on 2026-11-24: the backend steps, all checks, and the Android native build (`BUILD SUCCESSFUL`). Installing and launching on the emulator still needs a manual run (see step 3).

> Metro uses port 8081 and the emulator is shared. If another project (e.g. Gallerials) has Metro running, stop it first or start Petfinity with `npx expo start --port 8082`.

## 1. Prerequisites

| Tool | Version | Install / check |
|---|---|---|
| Node.js | 24 LTS | `brew install fnm`, then add `eval "$(fnm env --use-on-cd --shell zsh)"` to `~/.zshrc` and run `fnm install 24`. The repo's `.node-version` files switch to it automatically on `cd`. |
| uv | ≥ 0.13 | `brew install uv`. It installs Python 3.13 for the backend automatically (`backend/.python-version`). |
| PostgreSQL | 16 | `brew install postgresql@16 && brew services start postgresql@16`. Check: `pg_isready`. |
| JDK | 17 | Android Studio's bundled JDK or `brew install openjdk@17`. |
| Android Studio | current | SDK Platform plus an emulator (e.g. Pixel 8). Set `ANDROID_HOME=$HOME/Library/Android/sdk`. |
| Watchman | any | `brew install watchman` (faster file watching). |

> Other projects on this machine may need a different default Node (fnm's `default` alias). Petfinity does not change it; `.node-version` handles switching.

## 2. Backend
```bash
cd backend
uv sync
cp .env.example .env
createdb petfinity_dev
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8000
```
Open http://localhost:8000/api/v1/health/ready. It should return `{"status":"ready",…}`.

Run the checks:
```bash
uv run ruff check . && uv run ruff format --check . && uv run mypy app tests && uv run pytest
```
Tests create and migrate `petfinity_test` automatically. `TEST_DATABASE_URL` must end in `_test`, and the test database is safe to wipe.

## 3. Mobile (Android emulator)
Start the emulator from Android Studio's Device Manager (or `emulator -avd Pixel_8`), then:
```bash
cd mobile
npm install
cp .env.example .env            # EXPO_PUBLIC_API_URL=http://10.0.2.2:8000
npm run android                 # first run builds the native dev client (several minutes)
```
- **Sign in:** enter any mobile number or email. No message is actually sent; the backend's **mock** sender prints the code in the API terminal as `MOCK OTP (not delivered) to +91******3210: 123456`. New accounts are then asked for a display name.
- To make yourself an admin locally, set `BOOTSTRAP_ADMIN_EMAILS=<your email>` in `backend/.env`, restart the API and sign in with that email.
- In the app, open **Profile** (the person icon on Home). The dev-only pill should read **API: connected (v0.1.0)**.
- After the first build, `npm start` and then `a` reloads quickly. Rebuild only after native dependency or `app.json` plugin changes.
- **Physical device:** set `EXPO_PUBLIC_API_URL=http://<your-Mac-LAN-IP>:8000`, run the API with `--host 0.0.0.0`, and keep both devices on the same network.

Run the checks:
```bash
npm run check && npm run format:check
```

## 4. Changing the API contract
1. Change the backend route or schema.
2. `cd backend && uv run python -m app.openapi_export` (this updates `backend/openapi.json`; a test fails if you forget).
3. `cd mobile && npm run api:types` (regenerates `src/api/generated/schema.d.ts`).
4. Commit both files together.

## 5. Troubleshooting
| Symptom | Fix |
|---|---|
| App shows **API: unreachable** | Is the API running on port 8000? Android emulator must use `10.0.2.2`, not `localhost`. |
| `npm` warns about blocked install scripts (`fsevents`, `@parcel/watcher`) | Expected with npm 11. Both are optional file-watcher accelerators with fallbacks; leave them blocked unless Metro file-watching is slow. |
| `DATABASE_URL` validation error | URLs must use `postgresql+psycopg://`. |
| API won't start: `jwt_secret` / `otp_pepper` field required | Set both in `backend/.env` (≥ 32 chars): `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| No OTP code arrives | Expected locally: read it from the API terminal (mock sender). |
| `429 rate_limited` while testing sign-in | Wait for the cooldown, or lower the limits in `backend/.env` (`OTP_RESEND_COOLDOWN_SECONDS=0`, etc.). |
| Jest can't find a module after adding an Expo package | Install it with `npx expo install <pkg>` so peer dependencies match SDK 58. |
| Gradle build fails after changing `app.json` | `npx expo prebuild --clean`, then `npm run android`. |

## 6. CI
GitHub Actions run `.github/workflows/backend.yml` and `mobile.yml` on pushes and PRs that touch each app (path filters). The backend job uses a Postgres 16 service container.
