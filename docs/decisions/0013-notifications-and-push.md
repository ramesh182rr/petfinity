# 0013 — Notifications: in-app inbox first, push through Expo behind an adapter

- **Date:** 2026-11-27
- **Status:** Accepted
- **Owner:** Engineering (within the phase-2 plan the product owner approved: "Expo push, behind an adapter")
- **Partly resolves:** Open Decision #15 (the push part; SMS and email delivery are still open)

## Decision
- **Every notification is stored first** (`notifications` table), then pushed. The in-app inbox is the source of truth, so a failed or disabled push never loses a message.
- **Outbox delivery:**
  - Rows start with `push_status = pending`.
  - The API pushes them right after the response that created them (a FastAPI background task).
  - `python -m app.jobs.notifications` (cron, every 5 minutes) delivers anything left over.
  - Pushes older than 6 hours are skipped rather than sent late. A failed push is retried up to 3 times.
- **Adapter:**
  - `PUSH_BACKEND=log` is the mock: pushes go to the server log. It is refused in production.
  - `PUSH_BACKEND=expo` uses the Expo Push Service, which fronts FCM and APNs.
  - Direct FCM/APNs can replace it later without touching callers.
  - A `DeviceNotRegistered` reply disables that device.
- **Devices:**
  - One Expo push token per install (`push_devices`). It moves to whichever account signs in on that phone, and is released on sign-out.
  - The app asks for permission only when the user taps **Turn on notifications**, never at launch.
- **Who hears what** (nobody is told about their own action; "provider" means every active clinic operator, or the vet who owns the profile):
  - **New booking:** the provider gets "New appointment" (instant) or "New request" with the reply-by time.
  - **The provider responds:** the parent hears that it was confirmed or declined (with the reason).
  - **Expired request:** both sides.
  - **Cancelled:** the other side. Parents are told the refund outcome.
  - **Rescheduled:** the provider ("New time requested" when it needs their OK again).
  - **Completed or missed:** the parent.
- **Reminders** go to the parent, for confirmed bookings, at most once each (a dedupe key per booking and window):
  - **Day before:** sent within 24 hours of the start, including the free-cancellation time. Skipped if the booking was made less than 24 hours ahead.
  - **2 hours before:** skipped if the booking was made less than 2 hours ahead.
- **Privacy:** messages carry the pet, service, listing and local time, never the home-visit address. Tapping a notification opens only in-app routes.

## Needed from the product owner (before real pushes reach phones)
- An Expo (EAS) project for the app. Its `projectId` goes in `app.json` under `extra.eas.projectId` (`eas init` does this).
- An Android FCM v1 service-account key uploaded to that EAS project (`eas credentials`). iOS APNs keys come with iOS QA.
- Optional: an Expo access token if "enhanced push security" is turned on (`EXPO_ACCESS_TOKEN`).

Until then the app shows "Push isn't set up on this build yet" after permission is granted, and everything still arrives in the in-app inbox.

## Alternatives considered
- **Direct FCM/APNs from the API:** more setup and two code paths; the adapter keeps this option open.
- **A separate worker and queue:** not needed at MVP volume. The outbox plus cron is enough and survives restarts.
- **Push only, with no inbox:** messages would be lost whenever permission is off or a push fails.

## Consequences
- Migration 0008 adds `notifications` and `push_devices`.
- Booking events call `notifications.bookings.on_booking_event`; the cancellation outcome is set before the event so the message can describe it.
- Staging and production need the `app.jobs.notifications` cron (doc 16).
