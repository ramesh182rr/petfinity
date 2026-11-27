# 0014 — Reviews: verified visits, publish-then-moderate, provider replies

- **Date:** 2026-11-27
- **Status:** Accepted
- **Owner:** Product owner (moderation model, replies and edits); engineering (mechanics)

## Decisions made by the product owner
- **Publish now, report to hide.** A review goes live straight away. It is hidden (`pending`) until a moderator decides when:
  - anyone reports it (one report is enough), or
  - the automatic check flags it: phone numbers or emails, links, or abusive words from a short list
- **The provider can post one public reply,** and edit it.
- **The parent can write a review up to 30 days after the visit, and edit it for the same 30 days.**

## Engineering decisions
- **Who can review:**
  - only the pet parent of a `completed` booking
  - one review per booking (a unique `booking_id`), so there are no reviews without a real visit
  - a rating from 1 to 5; the text is optional (up to 1,000 characters)
- **Statuses:**
  - `published`
  - `pending` (hidden, with a `flag_reason`: reported, contact_details, link or language)
  - `removed`
- **Edits:**
  - editing re-runs the automatic check
  - a review flagged by the check goes live again once the problem is edited out
  - a reported review stays hidden until a moderator decides
  - a removed review can't be edited
- **Moderation:**
  - staff with the `moderator` or `admin` role use the admin web app's **Reviews** page
  - **Keep** publishes the review and resolves its reports; **Remove** takes it down, with an optional note that the author sees
  - every decision is audited
  - moderators can sign in to the admin app and see Reviews only; admins see Verification and Reviews
- **Privacy:**
  - public reviews show the author's first name and last initial ("Arun K."), the pet species and the service
  - they never show an email, phone or full name
  - replies can't include contact details or links (422)
- **Ratings:**
  - a listing's rating is the average of its published reviews
  - search shows it, offers `sort=rating`, and listing pages show the summary plus the 3 newest reviews
- **Notifications (0013):**
  - the provider hears about a new published review (not one that's being held)
  - the author hears about the provider's first reply, and about a removal
  - the "visit completed" message invites a review

## Alternatives considered
- **Holding every review for approval:** safest, but slow to build social proof and needs daily queue work.
- **Report-only, leaving reported reviews visible:** abusive content would stay up longer.
- **No replies or edits:** simpler, but providers couldn't respond and parents couldn't fix mistakes.

## Consequences
- Migration 0009 adds `reviews` and `review_reports`.
- Bookings show the parent's own review (`review`) and a `review` action while one can be written.
- Discovery listings and pages carry `rating` and `review_count`, and pages also carry `recent_reviews`.
