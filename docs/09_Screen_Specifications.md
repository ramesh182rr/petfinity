# Screen Specifications

## Consumer app — MVP screens
### 1. Welcome / sign-in (implemented 1b.2, [decision 0007](decisions/0007-authentication.md))
- **Sign-in** (`app/(auth)/sign-in.tsx`): brand header, Mobile number / Email switch (mobile first, `+91` prefix), inline validation, "Send code", rate-limit and network messages, terms note.
- **Verify** (`app/(auth)/verify.tsx`): masked destination; a 6-digit field with SMS/one-time-code autofill that auto-submits; server error messages; resend countdown; "use a different number/email".
- **Onboarding** (`app/onboarding.tsx`): "What should we call you?" display name (required once, after first sign-in).
- **Routing:** signed-out users can reach only sign-in (deep links redirect there). New users must finish onboarding before entering the app.
- **Still to do:** links to the Terms and Privacy pages (legal copy pending) and the location setup step (screen 2).

### 2. Location setup
Permission explanation, allow location, or manual city/area selection; allow later change.

### 3. Home
Pet selector, booking CTA, caretaker CTA, upcoming booking, nearby services and community preview.

### 4. Pet profile creation/edit (implemented 1b.5)
Required name/species; optional breed, age, sex, weight, temperament, photo, care notes. Save draft; clear validation.
- `app/pets/new.tsx` and `app/pets/[id]/edit.tsx` share `PetForm`, which has three sections:
  - **Basics:** name, species chips (all species, plus "Other" with a description), breed, sex, date of birth with an "estimate" toggle, weight, spayed/neutered.
  - **Health & care:** temperament, diet, allergies, conditions, medications. Marked "only visible to you".
  - **Emergency contact.**
- Inline validation runs before any request is made.
- **Profile** (`app/pets/[id]/index.tsx`): photo, About and Health cards, Edit, and a confirmed Remove.
- **Photo:** picked from the gallery (Android photo picker), square-cropped, resized to ≤ 1280 px and re-encoded as JPEG (this strips EXIF/GPS), then uploaded through a signed URL.
- *Not yet:* save draft, and taking a photo with the camera.

### 5. My Pets (implemented 1b.5)
Pet cards, add pet, select active pet, health information summary.
- Includes skeleton loading, pull-to-refresh, an empty state with "Add your first pet", and an error state with retry and a reference ID.
- **Home pet switcher:** tap to make a pet active, long-press to open it, and "+" to add. The active pet is kept in memory only for now.

### 6. Discover search
Search, category chips, list/map switch, filters and no-results state.

### 7. Provider list
Provider cards, verified state, distance, rating, service summary, price range and availability.

### 8. Clinic/provider detail
Photos, verification, clinic/provider info, address, hours, services/prices, doctor profiles, reviews, map and booking CTA.

### 9. Booking flow
Pet → service → slot → notes → policy/price review → mock payment → confirmation. Request-mode services show "Clinic confirms within …" before submitting, then a pending state until the provider responds (payment follows confirmation). Include loading, slot-conflict, pending, declined/expired, failure and cancellation states. Vet bookings are labelled "appointment" in the UI.

### 10. Booking detail
Status, date/time, provider contact, directions, pet/context, cancellation/reschedule rules and support.

### 11. Care request creation
Care type, pet(s), dates, location, requirements, optional budget and submit confirmation.

### 12. Offers list/detail
Compare offers; provider verification, profile, reviews, price, details and availability; select offer.

### 13. Community feed
Local/following tabs, post composer, post cards, likes/comments, report/block.

### 14. Create post
Text, photo, pet attachment, audience/location scope, guidelines and preview.

### 15. Notifications
Booking events, caretaker offers, community interactions and settings.

### 16. Profile/settings
*1b.2: shows name, email/phone and Sign out.* User details, roles, saved providers, location, privacy, notification settings, support, policies, logout/delete account.

## Provider screens
- Provider onboarding wizard
- Verification status/doc upload
- Profile/service editor
- Availability/calendar
- Booking/request inbox
- Booking detail and status actions
- Care request browse/respond (caretaker)
- Reviews and profile analytics (limited MVP)

## Admin web screens
- Dashboard/metrics
- Provider verification queue
- Provider detail/document review
- User/provider search
- Booking lookup
- Reports/moderation queue
- Dispute/cancellation management
- Audit log
- Configurable categories and policies

## Required states for every screen
Loading, empty, error/retry, offline/poor network, permission denied, success, validation errors and accessibility focus states.
