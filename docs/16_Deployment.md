# Deployment & Environments

## Local development
- Mobile: Expo development server; run on Android emulator or physical device.
- Backend: FastAPI local server, local/test DB configuration, optional local object-storage emulator or R2 dev bucket.
- Use mock payment provider by default.

## Environments
1. Local
2. Development/shared
3. Staging
4. Production

Each environment uses separate database, storage bucket, credentials and provider configuration.

## Render
- Initial backend as Render Web Service.
- Add worker only for scheduled/reminder tasks once needed.
- **Cron (2.6):** run `uv run python -m app.jobs.expire_bookings` every 5 minutes (Render cron job) to mark unanswered booking requests `expired` ([0012](decisions/0012-booking-policy-payments-capacity.md)). Availability does not depend on it, so a missed run only delays the status change.
- **Cron (2.9):** run `uv run python -m app.jobs.notifications` every 5 minutes, after the expiry job. It queues booking reminders and delivers pending pushes ([0013](decisions/0013-notifications-and-push.md)). Set `PUSH_BACKEND=expo` in production (the mock `log` sender is refused there).
- Health endpoint and readiness checks.
- Configure environment variables in Render dashboard; never commit secrets.
- Review cold starts/availability and free-tier restrictions before production.

## Neon
- Separate DB branches/environments where useful.
- Migrations with Alembic.
- Backups and restore procedure; test restore.
- Connection pooling/configuration reviewed for Render.

## Cloudflare R2
- Private bucket for verification documents and sensitive uploads.
- Public or signed delivery for approved media according to privacy settings.
- Upload via short-lived signed URLs; validate size/type and ownership.
- Lifecycle policies and deletion workflows.

## Expo/app distribution
- Development builds and local builds are possible without requiring a paid Expo plan.
- EAS cloud builds have free-tier limits; local builds are an alternative.
- Android Play Store publication requires developer account fee; Apple Developer membership required for iOS distribution. Confirm current fees/policies at release time.
- Use Android-first QA but preserve iOS compatibility.

## Release
- Internal testing → closed testing → staged rollout.
- Versioning and release notes.
- Crash monitoring, analytics and support.
- Rollback strategy for API and mobile releases.
