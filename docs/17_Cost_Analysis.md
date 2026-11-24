# Cost & Free-Tier Strategy

## Early-stage stack
| Component | Starting option | Notes |
|---|---|---|
| React Native/Expo | Free/open source | EAS cloud builds have limits; local builds possible |
| FastAPI/Python | Free/open source | Hosting has ongoing cost/limits |
| Neon PostgreSQL | Free tier initially | Review quotas, sleep/compute, storage, backups and production suitability |
| Render | Free/low-cost where available | Free services may sleep/limit reliability; production needs paid plan when required |
| Cloudflare R2 | Low-cost object storage | Requests/egress and usage should be monitored; private storage required for documents |
| Push notifications | Expo Push initially | Provider and platform constraints may change |
| Maps/geocoding | Provider free allowance/selected OSM-based service | Maps, search, geocoding, routing may have separate costs; do not assume unlimited free use |
| Payments | Mock | No real charges until provider integration |
| Analytics | Lightweight/free tier or self-hosted later | Collect only necessary events |

## Avoid cost traps
- Don't store high-resolution videos without limits.
- Compress photos on client/server and generate thumbnails.
- Restrict map requests and cache where policy allows.
- Don't run background workers until needed.
- Monitor DB connections and media storage.
- Avoid unnecessary SMS OTP; compare provider pricing and fraud controls.
- Don't add AI APIs before a clear use case and cost cap.

## Publishing costs (verify at launch)
- Google Play developer registration is commonly a one-time fee (historically USD $25).
- Apple Developer Program is commonly annual (historically USD $99/year).
- Fees, tax and regional terms can change; verify official store policies before payment.

## Budget philosophy
Use free tiers for prototype and validation. Budget for reliability, backups, support, provider verification, maps, notifications, domain and production hosting once real users depend on the service.
