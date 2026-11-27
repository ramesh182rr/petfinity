# Security, Privacy, Trust & Safety

## Trust is a product feature
The platform facilitates animal care and people entering homes or leaving pets with providers. Safety processes must be part of MVP, not postponed.

## Provider verification
- Identity check for caretakers.
- Vet/clinic verification: credentials and registration details checked using an appropriate authoritative process; record review status and reviewer.
- Clinic/business verification.
- Optional references and experience evidence.
- Verification badge must describe what was actually checked; never imply guarantee of safety.
- Reverification, expiration and suspension workflow.

## Care booking safety
- Encourage meet-and-greet before first booking.
- Pet compatibility, provider capacity and environment details.
- Written care instructions and emergency contacts.
- Clear cancellation/refund policies.
- Check-in/out and photo updates in later phase.
- Report incident, emergency escalation and support path.
- Terms clarify marketplace role and provider responsibilities; legal counsel should review.

## Community safety
- Community guidelines, report, block, hide, moderation queue, rate limits and repeat-offender handling.
- No public exposure of exact home addresses.
- Discovery (2.5, [0011](decisions/0011-launch-areas-and-locations.md)):
  - A home-visit vet's base pin is never returned publicly, and neither is a distance to it. Parents see only the area and the travel radius.
  - A parent's device location is sent per search and never stored.
  - Public listing pages omit phone, email, registration numbers, slot capacity and internal day-off notes.
- Bookings (2.6, [0012](decisions/0012-booking-policy-payments-capacity.md)):
  - A home-visit address is shown to the provider only once they confirm.
  - Bookings are visible only to the parent, the listing's operators or vet, and admins; anyone else gets 404.
  - Every change is in `booking_events`; admin cancellations are also in the audit log.
  - Payments are mock-only and labelled as such.
- Reviews (2.10, [0014](decisions/0014-reviews-and-moderation.md)):
  - Only verified visits: one review per completed booking.
  - Authors appear as first name and last initial; no contact details.
  - Contact details, links and abusive words are held for moderation; one report hides a review until a moderator decides.
  - Moderation decisions are audited.
- Notifications (2.9, [0013](decisions/0013-notifications-and-push.md)):
  - Messages never contain the home-visit address.
  - Push tokens are tied to the signed-in account and released on sign-out.
  - Permission is requested only on a user tap.
  - Tapping a notification opens in-app routes only.
- Lost-pet posts may reveal location; warn users and allow approximate location.
- Moderation audit and appeal process.

## Privacy
- Collect minimum data.
- Separate sensitive verification documents from public profile media.
- Exact location only when needed; share with provider for a confirmed service only with consent.
- Pet medical information is sensitive in context; owner controls sharing.
- Data access, correction, export and deletion processes.
- Notification preferences and consent logs.
- Privacy policy and terms must be reviewed for applicable Indian law and store requirements.

## Security baseline
- OWASP mobile/API considerations.
- Secure storage for tokens on device.
- TLS; secret rotation.
- RBAC and resource ownership, layered as: authenticated → capability → resource scope → verification/state gate ([decision 0006](decisions/0006-identity-roles-and-permissions.md)).
- Staff (moderator/admin) access is an explicit, audited grant, limited to verified staff-domain emails. It is never derived from the email alone. Staff MFA is required before production.
- Rate limiting and abuse prevention.
- Upload MIME/size limits, signed URLs, image processing and scanning strategy.
- Audit logs for privileged actions.
- Backup/restore testing.
- Dependency scanning and basic CI security checks.

## Medical safety
- No AI diagnosis or treatment recommendation in MVP.
- Community advice is not professional care; show disclaimers and report dangerous content.
- Emergency flow should direct users to contact a verified clinic/emergency provider; don't delay emergency care with app flows.
- Only qualified providers deliver veterinary services; verify credentials as appropriate.

## Legal/compliance review before launch
Terms, privacy, marketplace liability, professional credential rules, payment settlement, tax, consumer protection, refunds/cancellations, animal welfare and any telemedicine rules. This document is product planning, not legal advice.
