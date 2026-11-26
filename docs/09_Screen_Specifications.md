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

### 6. Discover search (implemented 2.5, `app/(tabs)/discover.tsx`)
- Gradient hero with:
  - a location pill ("Chennai · 10 km" or "Near you"), which opens the area picker
  - a search box (debounced, searching names, localities and qualifications)
- Filter card:
  - All / Clinics / Home visits
  - quick chips: Open now, Lowest price, Emergency
  - category chips
- First visit, no location yet: a "Where should we look?" card with **Near me** and **Choose city**, both the same height.
- States: skeleton cards, an error with retry, and an empty state. The empty state offers "Clear filters", or "Search within 25 km" when nothing is nearby.
- Pull to refresh; results also refresh when the tab regains focus. "Show more" pages through results.
- **Area picker** (`app/discover/area.tsx`):
  - "Use my current location" (foreground only, never saved)
  - search radius chips: 5, 10, 15, 25 km
  - the launch cities grouped by state
- List/map switch: the map view comes after the Maps key (0010).

### 7. Provider list (implemented 2.5, `ListingCard`)
Each card shows:
- an initials avatar with a clinic or home-visit badge, the name and a verified shield
- for clinics: locality and distance (`~` when estimated from the area centre)
- for vets: area and "Home visits within N km", with no distance
- Open now / Closed now and Emergency pills
- the "from ₹" price
- a footer with the next free slot and a category summary

Ratings arrive with reviews (2.10).

### 8. Clinic/provider detail (implemented 2.5)
- **Clinic** (`app/discover/clinic/[id].tsx`):
  - gradient hero with stat tiles: From, Services, Open/Closed right now
  - "Verified by Petfinity" card listing what was checked
  - about, then selectable services
  - **Available times**: 14-day strip and a slot grid; the button reads "Booking opens soon" until 2.7
  - vets at the clinic
  - opening hours ("Open 24 hours" where it applies), plus closures in the next 14 days
  - address with **Get directions**, which opens the phone's maps app: no API key, no billing
- **Home-visit vet** (`app/discover/vet/[id].tsx`):
  - hero tiles: From, Experience, Travels N km
  - a "Visits your area" or "Outside their travel area" banner
  - verified checks, about and languages, home-visit services, available times, "Also practises at" clinics, visiting hours
- Unlisted or suspended listings show a friendly "isn't listed right now" state.
- Photos, reviews and the map come later.

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
*Implemented in 2.3:*
- **Provider hub** (`app/provider/index.tsx`, from Profile → "Become a provider"):
  - your profiles and clinics with verification pills
  - start tiles for Veterinarian, Caretaker and Clinic
  - a three-step "How verification works" guide
- **Provider profile form**, create and edit:
  - display name, bio, experience, city, language chips
  - for vets: registration number, council chips and qualifications
- **Clinic form**, create and edit:
  - details, landline/mobile phone, email, emergency switch
  - address with state chips (TN / Kerala / Karnataka + other) and PIN
  - "I practise here" for vets creating their own clinic
- **Verification checklist** (`app/provider/verify/[subjectType]/[id]`):
  - status hero: Not submitted / Under review / Action needed / Verified / Not approved
  - the admin's message card
  - details completeness, with a link to edit
  - required documents with ticks and Upload buttons (PDF or photo via the system file picker, 10 MB limit), plus optional documents
  - the uploaded list (Remove / Sent)
  - submit with an optional note
  - documents lock while under review, and the screen refreshes on focus

*Implemented in 2.4 (vets and clinics; the provider hub opens these instead of the checklist):*
- **Workspace** (`app/provider/manage/[ownerType]/[id]/index.tsx`):
  - gradient hero with stat tiles (Services, Open days, verification status)
  - verification row, linking to the checklist
  - service cards: icon badge, category, duration and mode, ₹ price, Instant/Request pill, Paused state
  - opening-hours summary with Edit
  - days off and special hours, with Remove
  - **slot preview**: service chips, the next 14 days as date chips, and a slot grid
  - refreshes on focus
- **Service form** (`service.tsx`):
  - category chips (the title auto-fills from the category)
  - price in ₹, duration chips
  - mode (In clinic / Home visit; teleconsult is shown as coming later), Instant or Request
  - species chips, "Bookable" switch, Archive
- **Opening hours** (`hours.tsx`):
  - a card per weekday with an Open switch
  - each time range is a tinted block: start and end time pills (5-minute steps) with remove, and an "Appointments at once" stepper
  - Add hours (up to 6 per day), Copy Monday to Tue–Fri
  - client-side overlap check before saving
- **Day off or special hours** (`day-off.tsx`):
  - date picker field (from today, up to 60 days ahead)
  - Closed all day / Special hours (time pills and capacity), optional note
- Editors return to the workspace even when opened from a deep link.

*Added in 2.5:* the clinic form and the vet profile form have a **Location** or **Home visits** section:
- launch-area chips
- "Use my current location" pin, with Clear
- for vets, travel radius chips: 5, 10, 15, 25 km

The vet's pin is private.

*Still planned:*
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
