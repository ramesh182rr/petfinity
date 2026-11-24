# Petfinity

*Every paw. Every need. Every connection.* (working tagline)

Petfinity is a trust-first pet-care marketplace. It connects pet parents with veterinarians, clinics, caretakers and a local pet community. The initial launch markets are Tamil Nadu, Kerala and Bengaluru. Android comes first; the app stays iOS-compatible.

> "Petfinity" is a working name. Trademark, domain and app-store checks are still outstanding.

## Repository layout

This is a single monorepo. Each app is independent so it can later move to its own repository ([decision 0001](docs/decisions/0001-monorepo.md)).

| Path | What it holds | Status |
|---|---|---|
| `docs/` | Product blueprint (00–20), decisions, development guides, diagrams | ✅ |
| `assets/` | Brand references (the moodboard is a reference, not a final logo) | ✅ |
| `backend/` | Python FastAPI API, SQLAlchemy, Alembic | Milestone 1.1 |
| `mobile/` | React Native + Expo app (TypeScript, Expo Router) | Milestone 1.3 |
| `infrastructure/` | Render/Neon/R2 configuration and deploy notes | Milestone 1.6 |

Rules that keep the apps split-ready:
- No imports between `mobile/` and `backend/`.
- Each app has its own dependencies, lockfile and `.env.example`.
- The API contract is shared only through the backend's OpenAPI schema.

## Where to start reading

1. [Product vision](docs/01_Product_Vision.md) and [product owner decisions](docs/PRODUCT_OWNER_DECISIONS.md)
2. [Product requirements](docs/03_Product_Requirements.md) and [MVP & roadmap](docs/04_MVP_and_Roadmap.md)
3. [Architecture](docs/10_Architecture.md), [database](docs/11_Database_Schema.md), [API](docs/12_API_Specification.md)
4. [Design system](docs/08_UX_UI_Design_System.md) and [screens](docs/09_Screen_Specifications.md)
5. [Phase 1 plan](docs/development/phase-1-plan.md) and [implementation checklist](docs/IMPLEMENTATION_CHECKLIST.md)
6. [Open decisions](docs/20_Open_Decisions.md) and the [decision log](docs/decisions/README.md)

## Prerequisites (summary)

Full setup instructions arrive in Milestone 1.6 (`docs/development/local-setup.md`).

- **Node 24 LTS.** Pinned in `.node-version`; `fnm`/`nvm` switch to it automatically.
- **Python 3.13** via [`uv`](https://docs.astral.sh/uv/). Pinned per app in `backend/.python-version`.
- **PostgreSQL 16** locally for development and tests.
- **Android Studio** with an emulator, and **JDK 17**.

## Contributing workflow

Work proceeds one milestone at a time. Changes are reviewed and committed manually by the product owner, and AI assistants never commit or push. See [`CLAUDE.md`](CLAUDE.md) and [`docs/14_Development_Plan.md`](docs/14_Development_Plan.md).
