# Monetization & Marketplace Economics

## Principle
Do not optimise monetisation before marketplace trust and successful fulfillment. Keep the initial payment flow mocked; model the eventual marketplace carefully.

## Potential revenue streams (priority)
1. **Vet appointment commission or lead/booking fee:** validate clinic preference; completed-booking commission is transparent but may be resisted.
2. **Caretaker booking commission:** likely the clearest transaction-based monetisation; test take rate and value-added services.
3. **Grooming/walking/training commission:** add after service quality and supply.
4. **Clinic subscription:** optional professional tools, analytics, promoted profile or calendar management; avoid charging before value is proven.
5. **Affiliate product discovery:** low operational burden, disclose affiliate relationship.
6. **Sponsored/featured listings:** only with transparent labels and ranking safeguards.
7. **Events, partnerships and insurance referrals:** later, subject to legal/compliance review.

## Illustrative unit economics (not a forecast)
| Scenario | Monthly completed bookings | Average value | Take rate | Gross marketplace revenue |
|---|---:|---:|---:|---:|
| Early pilot | 100 | ₹1,000 | 10% | ₹10,000 |
| Local traction | 1,000 | ₹800 | 12% | ₹96,000 |
| Care bookings | 300 | ₹2,000 | 15% | ₹90,000 |

Revenue = completed bookings × average transaction value × take rate. Excludes payment fees, refunds, support, taxes, marketing, incentives and provider payout costs.

## Payment design
- MVP: mock payment adapter and explicit “not charged” UI.
- Keep payment provider integration behind a service interface.
- Model payment, refund, commission, provider payout and reconciliation states separately.
- Real marketplace payouts require gateway availability, provider KYC, settlement rules, refunds/chargebacks, taxes and legal review. Stripe's exact India/platform capabilities should be rechecked before implementation.
- Do not store card data.

## Marketplace leakage
Provide value after discovery: booking records, cancellations/refunds, reminders, support, verified reviews, repeat booking and provider tools. Avoid coercive lock-in.
