# Petfinity mobile

React Native app: Expo SDK 58, TypeScript (strict), Expo Router, TanStack Query. Android first, iOS-compatible.

## Quick start

```bash
cd mobile                       # fnm switches to Node 24 via .node-version
npm install
cp .env.example .env            # EXPO_PUBLIC_API_URL (Android emulator: http://10.0.2.2:8000)
npm run android                 # builds + installs the development build, starts Metro
```

After the first native build, day-to-day you only need `npm start` and then press `a`. Rebuild (`npm run android`) only after adding a package with native code or changing `app.json` plugins.

This app uses a **development build** (`expo-dev-client`), not Expo Go. The `android/` and `ios/` folders are generated (Continuous Native Generation) and git-ignored. Configure native behaviour in `app.json`.

## Checks

```bash
npm run check                   # lint + typecheck + tests
npm run format:check
npm run doctor                  # expo-doctor
```

## Layout

```
app/                    # routes only (Expo Router) — do NOT create src/app/
  _layout.tsx           # fonts, splash, session bootstrap, QueryClient, RootNavigator
  (auth)/               # sign-in, verify (signed-out only)
  onboarding.tsx        # display name after first sign-in
  pets/                 # new, [id] (profile), [id]/edit
  provider/             # hub, profile/{new,[id]}, clinic/{new,[id]}, verify/[subjectType]/[id],
                        # manage/[ownerType]/[id]/{index,service,hours,day-off,bookings} (services, availability, inbox),
                        # booking/[id] (provider view of a booking: confirm, decline, check in, complete)
  discover/             # area (city / near me / radius), clinic/[id], vet/[id] public listing pages
  notifications.tsx     # notification inbox
  reviews/[id]/report   # report a review
  book/                 # review and book an appointment (pet, notes, address, policy)
  bookings/[id]/        # booking detail (status, mock payment, timeline, cancel) and reschedule
  (tabs)/               # Home, Discover (search + filters), Bookings (upcoming/past), Community, My Pets
  profile.tsx, +not-found.tsx
src/
  theme/                # design tokens: colors (semantic), typography, spacing, radius, elevation
  components/ui/        # Text, Button, Card, Chip, IconBadge, Screen, HeroHeader/HeroScreen, ActionCard,
                        # ListRow, InfoRow, StatTile, StatusPill, InitialsAvatar, ChipGroup, FormSection, Decor, TimeField
  components/states/    # LoadingState, Skeleton, EmptyState, ErrorState
  api/                  # client (error envelope → ApiError), query client, generated/ types
  config/env.ts         # validated EXPO_PUBLIC_* config
  features/auth/        # session store (Zustand), secure token storage, auth API, validation
  features/pets/        # pet API + TanStack Query hooks, PetForm, photo picking/upload, active pet
  features/providers/   # provider profiles, clinics, verification documents (picker + signed upload)
  features/catalog/     # services, hours, days off, slot preview: API, hooks, money/time formatting, week validation,
                        # SlotPicker (DayStrip, SlotGrid)
  features/reviews/     # review API + hooks, Stars/StarInput (ui), ReviewCard, RatingSummary, ReviewsSection,
                        # MyReviewCard
  features/notifications/ # inbox API + hooks (unread badge), NotificationBell, push setup (expo-notifications),
                        # PushBridge (re-register, open from tap, refresh on receive)
  features/bookings/    # booking API + hooks (idempotency key per attempt), BookingCard, status/payment/policy text
  features/discovery/   # launch areas, search store/hooks, ListingCard, detail parts, LocationField (area + GPS pin),
                        # one-off foreground location (expo-location)
  features/<name>/      # feature hooks + components (e.g. system/health)
  navigation/           # RootNavigator: protected-route guards by session state
__tests__/              # Jest (jest-expo) tests: *-test.ts(x)
```

## Authentication (decision 0007)

- Passwordless OTP sign-in by mobile number or email. Signed-out users can reach only `(auth)`, and signed-in users without a name only `onboarding`. This is enforced by `Stack.Protected` guards in `src/navigation/RootNavigator.tsx` (client-side only; the API enforces access itself).
- Only the **refresh token** is persisted, in `expo-secure-store` (Keychain/Keystore, this device only). The access token lives in memory.
- `apiClient` attaches the access token automatically. On a 401 it runs one **single-flight** refresh and retries once. Pass `auth: false` for public endpoints.
- **Local sign-in:** the backend's mock sender prints the code in the API terminal (`MOCK OTP (not delivered) …`).

## UI quality bar

Every screen must look polished and distinctive (doc 08, "UI quality bar"). Use `HeroScreen` for top-level screens, tinted `ActionCard` tiles, `ListRow` / `InfoRow` and `StatusPill`. Keep shapes and alignment exact, and check changes on the emulator before calling them done.

## Conventions

- **Design tokens only:** import colours, spacing and type from `@/theme`. No hex values in screens. Contrast is enforced by `__tests__/theme-contrast-test.ts`.
- **Every data screen** handles loading, empty, error (with retry) and success states, using `components/states`.
- **Accessibility:** touch targets ≥ 48dp, `accessibilityRole` and labels on controls, dynamic text supported (capped multipliers in `Text`).
- **API types are generated, never hand-written:** run `npm run api:types` after the backend contract changes. It reads `../backend/openapi.json`; set `OPENAPI_SOURCE` to a URL or path if the repos are split.
- **Config:** `EXPO_PUBLIC_*` values are bundled into the app, so never put secrets there.
- Install native packages with `npx expo install <pkg>` so versions match the SDK.
