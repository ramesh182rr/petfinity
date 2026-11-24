# 0002 — Moodboard-aligned brand palette

- **Date:** 2026-11-24
- **Status:** Accepted. Exact values are pending Milestone 1.4.
- **Owner:** Product owner

## Context
Three sources disagreed:
- `08_UX_UI_Design_System.md` specified a bright violet primary (`#6F3CC3`) and a **mint** accent (`#BCE8D0`), with no sage green.
- The product owner's brief asked for soft purple, warm cream, and **sage green and coral** accents.
- The brand moodboard (`assets/branding/petfinity_brand_moodboard.png`) shows a deeper **plum** purple, lavender, sage/olive green, light green, coral, peach and cream.

## Decision
Align the palette to the moodboard and the brief:
- **Primary:** deeper plum purple (replaces the bright violet)
- **Accents:** sage green (replaces mint) and coral
- **Supporting:** lavender, peach, warm cream background, white cards
- **Feedback colours:** keep success, warning and error as semantic tokens

Milestone 1.4 sets the exact hex values as semantic tokens and checks them for WCAG AA contrast. Those values then replace the draft list in `08_UX_UI_Design_System.md`.

## Alternatives considered
- Keep doc 08's tokens as written: these conflict with the brief and the moodboard.

## Consequences
- Screens use semantic tokens only (`color.primary`, `color.accentSage`, …), so later brand changes stay cheap.
- The moodboard remains a reference, not a production logo or icon.
