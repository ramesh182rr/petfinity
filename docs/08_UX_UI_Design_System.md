# UX/UI Design System

## Brand direction
**Balanced:** premium-modern design with warm, playful pet personality. Friendly and accessible, not childish; credible enough for veterinary services.

## Working brand
Petfinity (placeholder; name availability not checked). Brand moodboard image is reference only; generated artwork may contain imperfect text and must not be treated as final logo.

## Colour tokens (final, Milestone 1.4, [decision 0002](decisions/0002-brand-palette.md))
The source of truth is `mobile/src/theme/colors.ts`. Screens use **semantic** tokens only. Contrast is enforced by `mobile/__tests__/theme-contrast-test.ts` (WCAG AA: 4.5:1 text, 3:1 UI).

| Semantic token | Value | Use | Contrast |
|---|---|---|---|
| `primary` | `#6A2C7A` plum | Brand, primary actions, links, active tab | 8.8:1 on cream |
| `primaryPressed` | `#4F1F5C` | Pressed primary | white text 12.5:1 |
| `primarySoft` | `#BF97D5` lavender | Decorative, pressed secondary | — |
| `primaryTint` | `#F1E7F7` | Secondary buttons, lavender icon tiles | plum text 7.8:1 |
| `accentSage` | `#8F9D61` | Decorative fills/illustration only (not text) | 2.8:1 |
| `accentSageText` / `accentSageTint` | `#56663A` / `#EAEFDC` | Sage text and icons / sage tiles | 5.9:1 on cream |
| `accentCoral` | `#F88F73` | Decorative warm accent only (not text) | 2.2:1 |
| `accentCoralText` / `accentCoralTint` | `#A8432A` / `#FEE6DE` | Coral text and icons / coral tiles | ≥ 5:1 |
| `accentPeach` / `accentPeachTint` | `#F9BF8F` / `#FDEEDF` | Warm decorative / peach tiles | — |
| `background` | `#FFF8F0` warm cream | Screen background | — |
| `backgroundAlt` | `#FBF0E4` | Disabled fills, alternate sections | — |
| `surface` | `#FFFFFF` | Cards, tab bar | — |
| `text` | `#2A2233` ink | Body text | 14.5:1 on cream |
| `textMuted` | `#6B6377` | Secondary text | 5.4:1 on cream |
| `textDisabled` / `borderStrong` | `#9A8FA3` | Disabled text; input borders | 3.1:1 on white |
| `border` | `#EADFD3` | Hairlines, card and chip borders (decorative) | — |
| `success` / `warning` / `error` | `#217A54` / `#A35F12` / `#C44747` | Status text and icons (each has a `*Tint` background) | ≥ 4.5:1 |

Rules:
- Sage, coral, peach and lavender **fills are decorative**. Text on them uses `text`, and coloured text uses the `*Text` variants.
- Moodboard icon tiles map to `IconBadge` tones: lavender, sage, coral, peach.

## Typography
- Display/headings: **Poppins** 600/700. Body/UI: **Inter** 400/500/600. Both are SIL Open Font License, bundled via `@expo-google-fonts`.
- Scale (`mobile/src/theme/tokens.ts`): display 30/38, title 24/32, heading 20/28, subheading 17/24, body 16/24, bodyStrong 16/24, label 14/20, caption 13/18.
- Dynamic text is supported. Font scale is capped at 1.8× for body text and 1.4× for display text so layouts stay usable.

## Spacing, shape and elevation
- Spacing scale: 2, 4, 8, 12, 16, 24, 32, 48. Screen padding is 16 and section gaps are 24.
- Radius: 8, 12, 16, 24 (cards), pill (buttons, chips).
- Elevation is restrained: `card` (subtle) and `raised`.
- Minimum touch target: 48dp. Chips are 36 high, extended to 48 with hit slop.

## Components
- Rounded cards (16–24px radius, restrained shadow) — `Card`
- Text with brand variants — `Text`
- Icon tiles in moodboard tones — `IconBadge`
- Screen container (cream, safe areas) — `Screen`
- Pill filters and status chips — `Chip`
- Primary/secondary/tertiary buttons, plus inverse and outline-inverse for plum surfaces — `Button`
- Form fields with visible labels and validation
- Pet avatar/profile cards
- Provider cards with verification badge and rating
- Service chips
- Booking status cards
- Bottom sheets for filters/quick actions
- Skeleton loading, empty states and retry states — `LoadingState`, `Skeleton`, `EmptyState`, `ErrorState`
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
