# Petfinity admin

Staff web app for provider verification (and, later, moderation and support). It is a **website**, separate from the mobile app ([decision 0009](../docs/decisions/0009-admin-web-app.md)).

Stack: React 19, Vite 8, TypeScript, React Router, TanStack Query. Fonts are Poppins and Inter, self-hosted.

## Quick start

```bash
cd admin                 # Node 24 via .node-version
npm install
cp .env.example .env     # defaults are fine locally
npm run dev              # http://localhost:5173 (proxies /api to http://localhost:8000)
```

1. Start the API first (`cd backend && uv run uvicorn app.main:app --port 8000`).
2. To make yourself an admin locally, set `BOOTSTRAP_ADMIN_EMAILS=<your email>` in `backend/.env`, restart the API, then sign in here with that email. The 6-digit code appears in the API terminal (mock sender).
3. Anyone without the admin role sees "Not authorised". The API enforces this independently.

## Checks

```bash
npm run check            # oxlint + typecheck + vitest
npm run format:check
npm run build
```

## How sign-in works

- The same passwordless email code as the app. Browser endpoints are under `/api/v1/auth/web/*`.
- The refresh token is an **httpOnly, Secure, SameSite=Strict** cookie that scripts can't read. The access token lives only in memory, so a page reload restores the session through the cookie.
- Every request sends `X-Requested-With: petfinity-web`, which the API requires on cookie endpoints as CSRF protection.
- **Local dev** uses the Vite proxy, so the browser sees a single origin.
- **Hosted:** serve the site over HTTPS on the same site as the API (e.g. `admin.example.com` and `api.example.com`). Set `VITE_API_URL`, and on the API set `CORS_ALLOW_ORIGINS=<admin origin>` and `CORS_ALLOW_CREDENTIALS=true`.

## Layout

```
src/
  api/          client (token, single-flight refresh, error envelope), generated/ types
  auth/         SessionProvider (session.tsx) + useSession (context.ts)
  pages/        SignIn, NotAuthorized, Queue, Submission (review + documents + decision + suspension)
  components/   Layout
  index.css     design tokens as CSS variables (mirrors mobile/src/theme)
```

API types are generated from `../backend/openapi.json` with `npm run api:types`.
