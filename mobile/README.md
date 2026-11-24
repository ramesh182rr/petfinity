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
  _layout.tsx           # fonts, splash, QueryClient, root stack
  (tabs)/               # Home, Discover, Bookings, Community, My Pets
  profile.tsx, +not-found.tsx
src/
  theme/                # design tokens: colors (semantic), typography, spacing, radius, elevation
  components/ui/        # Text, Button, Card, Chip, IconBadge, Screen
  components/states/    # LoadingState, Skeleton, EmptyState, ErrorState
  api/                  # client (error envelope → ApiError), query client, generated/ types
  config/env.ts         # validated EXPO_PUBLIC_* config
  features/<name>/      # feature hooks + components (e.g. system/health)
__tests__/              # Jest (jest-expo) tests: *-test.ts(x)
```

## Conventions

- **Design tokens only:** import colours, spacing and type from `@/theme`. No hex values in screens. Contrast is enforced by `__tests__/theme-contrast-test.ts`.
- **Every data screen** handles loading, empty, error (with retry) and success states, using `components/states`.
- **Accessibility:** touch targets ≥ 48dp, `accessibilityRole` and labels on controls, dynamic text supported (capped multipliers in `Text`).
- **API types are generated, never hand-written:** run `npm run api:types` after the backend contract changes. It reads `../backend/openapi.json`; set `OPENAPI_SOURCE` to a URL or path if the repos are split.
- **Config:** `EXPO_PUBLIC_*` values are bundled into the app, so never put secrets there.
- Install native packages with `npx expo install <pkg>` so versions match the SDK.
