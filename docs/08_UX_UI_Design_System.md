# UX/UI Design System

## Brand direction
**Balanced:** premium-modern design with warm, playful pet personality. Friendly and accessible, not childish; credible enough for veterinary services.

## Working brand
Petfinity (placeholder; name availability not checked). Brand moodboard image is reference only; generated artwork may contain imperfect text and must not be treated as final logo.

## Colour tokens (initial)

> **Direction updated ([decision 0002](decisions/0002-brand-palette.md), 2026-11-24):** the palette is realigned to the brand moodboard. It uses a deeper **plum** primary, **sage green** in place of mint as an accent, and keeps coral, lavender and warm cream. The list below is the original draft. Milestone 1.4 replaces it with the final semantic tokens and WCAG contrast results.

- Primary purple: `#6F3CC3` (brand/action)
- Primary deep: `#48247C`
- Lavender: `#E9D8FF`
- Coral: `#FF8A70` (warm accent)
- Mint: `#BCE8D0`
- Warm cream: `#FFF8F0` (background)
- White: `#FFFFFF` (cards)
- Ink: `#272333`
- Muted text: `#726C7D`
- Success: `#25835B`
- Warning: `#B66B17`
- Error: `#C44747`

Use semantic tokens; do not hard-code colours throughout screens. Confirm contrast and accessibility in implementation.

## Typography
- Display/headings: rounded geometric sans (e.g., Nunito / Poppins; check licensing and platform loading).
- Body/UI: Inter or system sans.
- Use minimum comfortable body sizes, consistent hierarchy and dynamic text support.

## Components
- Rounded cards (16–24px radius, restrained shadow)
- Pill filters and status chips
- Primary/secondary/tertiary buttons
- Form fields with visible labels and validation
- Pet avatar/profile cards
- Provider cards with verification badge and rating
- Service chips
- Booking status cards
- Bottom sheets for filters/quick actions
- Skeleton loading, empty states and retry states
- Accessible bottom navigation

## Navigation (suggested 5 tabs)
1. Home
2. Discover
3. Bookings
4. Community
5. My Pets

Profile/settings and “Become a provider” accessible from profile/settings and contextual CTA.

## Home screen
- Greeting and location
- Pet switcher/cards
- Primary action: Book a vet
- Secondary action: Find a caretaker
- Upcoming booking
- Care reminders (Phase 2)
- Local community preview
- Nearby services

## Discover
- Search bar
- Category chips
- List/map switch
- Filters: service, distance, price, rating, verified, available/open, provider type
- Provider cards with image, rating, verification, distance, service and price context

## Interaction principles
- Avoid overwhelming dashboards.
- Explain location permission before system prompt.
- Make manual location search available.
- Show total/price and cancellation terms before booking.
- Confirm irreversible actions.
- Use friendly empty states and direct next steps.
- Safety/emergency actions should be conspicuous but not alarmist.

## Asset rules
- Use original or properly licensed assets.
- Prefer real provider photos after verification/consent.
- AI-generated assets are visual references, not proof of provider identity or service quality.
- Avoid fake ratings, testimonials or provider imagery in production.
