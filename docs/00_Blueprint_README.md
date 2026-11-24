# Petfinity — Product Blueprint Kit

> Original blueprint README (v1.0, 23 Nov 2026), kept for reference. The current entry point is the root [`README.md`](../README.md). Paths below were updated when the blueprint moved into the monorepo (decision [0001](decisions/0001-monorepo.md)).

**Working name only.** This blueprint (originally supplied as a ZIP, now under `docs/` and `assets/`) contains the product blueprint, UX/technical guidance, diagrams, templates and AI coding-agent instructions for a pet-care marketplace.

## Product concept
A trust-first local network for pet parents to find and book veterinarians and caretakers, manage pets and connect with a local community. Initial active marketplace: Tamil Nadu, Kerala and Bengaluru (Karnataka), with focused local clusters and expansion based on marketplace liquidity.

## Recommended defaults applied
- Launch in Tamil Nadu, Kerala and Bengaluru (Karnataka), using focused operational clusters rather than attempting uniform coverage immediately.
- Profiles support all pets; marketplace initially focuses on dogs and cats.
- Vet service modes include clinic, home visit and teleconsultation where providers/compliance allow.
- Caretaker verification, completed-booking reviews and meet-and-greet encouraged.
- Community: local + following + public-in-app feed, with moderation.
- Provider-related messaging first; general DMs deferred.
- Product discovery via affiliate/partner links first.
- Brand direction: premium, warm and playful.
- Working brand placeholder: **Petfinity** (not cleared).
- React Native + Expo; Python FastAPI; Neon; Render; Cloudflare R2; mock payments.
- Single monorepo with independent `mobile/` and `backend/` directories, kept split-ready (supersedes the original separate-repos default; see [decision 0001](decisions/0001-monorepo.md)).
- Claude must not commit or push; it should provide suggested commit messages.

## Contents
- `docs/` — 20 Markdown documents covering vision, market, PRD, roadmap, personas, journeys, monetisation, design, screens, architecture, data, API, safety, development, QA, deployment, costs, coding instructions, conventions and open decisions.
- `assets/branding/` — generated Petfinity brand moodboard reference.
- `assets/ui_reference/` — not yet created; reserved for future screen references. The current branded visual reference is in `assets/branding/`.
- `docs/diagrams/` — architecture, user flows and navigation in Mermaid.
- `docs/templates/` — environment example and API collection placeholder.
- `docs/IMPLEMENTATION_CHECKLIST.md` — phase-by-phase progress checklist.

## How Claude should start
1. Open the `petfinity` monorepo; work inside `mobile/` or `backend/` as the task requires.
2. Copy/refer to this blueprint, especially `docs/18_AI_Coding_Instructions.md`.
3. Ask Claude to inspect the repo and propose the first milestone only.
4. Start with foundation; do not jump into the full product.
5. Do not commit; review Claude's suggested commit message yourself.

## Important
Research figures are estimates and competitors/features change. Verify before external use. Generated images are inspiration only; they are not production logos, verified provider imagery or final UI. Name/domain/trademark checks are outstanding.
