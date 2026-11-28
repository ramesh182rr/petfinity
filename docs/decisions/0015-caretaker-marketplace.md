# 0015 — Caretaker marketplace: care types, open requests, cancellation

- **Date:** 2026-11-27
- **Status:** Accepted
- **Owner:** Product owner (care types, cancellation, request distribution); engineering (mechanics)
- **Resolves:** Open Decision #7, the cancellation and refund part (emergency and incident policies are still open)
- **Builds on:** 0004 (offers confirm on acceptance), 0005 (one `bookings` record), 0006 (caretaker profiles), 0011 (service radius), 0012 (mock payments, capacity units)

## Decisions made by the product owner
- **All four care types at launch:**
  - **Home visit:** drop-ins at the parent's home (feeding, walks, medicines), priced per visit
  - **Day care:** at the caretaker's home, priced per day
  - **Boarding:** overnight at the caretaker's home, priced per night
  - **House sitting:** the caretaker stays at the parent's home, priced per night
- **Cancellation (care bookings):**
  - free until 48 hours before the start
  - after that, the parent gets a 50% refund
  - once care has started, there's no refund
  - caretaker cancellations always refund in full, and are counted
  - payments stay mock (0012)
- **Requests are open to nearby caretakers:**
  - A care request is visible to verified caretakers who offer that care type and species, and whose service area covers the request's location.
  - Each caretaker sends at most one offer (price, message, availability confirmed).
  - The request closes at 5 offers or after 24 hours, whichever comes first. The parent compares the offers and accepts one.
  - Accepting creates a `confirmed` care booking and declines the other offers (0004).

## Engineering decisions (trust and safety)
- **Verification:** caretakers need **identity plus address proof**. Three of the four types put the caretaker in someone's home or the pet in theirs.
- **Privacy:**
  - Before acceptance, caretakers see only the request's area (locality and an approximate distance) and the pets' basic details.
  - The exact address and the parent's name are shared only with the accepted caretaker, once the booking is confirmed.
  - The caretaker's own home address (day care and boarding) is shared with the parent only after confirmation.
- **Capacity:** each caretaker sets how many bookings they take at once (1–5). Overlapping care bookings use the booking engine's capacity units, so a caretaker can't be double-booked beyond their limit.
- **Meet-and-greet:** for house sitting and first-time boarding, the request screen encourages a meet-and-greet (shown as advice, not enforced).

## Consequences
- New tables: `care_services` (a caretaker's offered types, rates, species and pet limits), `care_requests` and `care_offers`.
- `bookings` gains its care columns (`care_request_id`, `care_offer_id`, care modes), and care bookings can have several pets.
- Emergency and incident policies (the rest of #7) are still needed before the pilot.
