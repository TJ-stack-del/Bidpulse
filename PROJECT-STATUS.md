# BidPulse — Project Status & Handoff

Read this first in any new conversation about BidPulse. It captures decisions,
context, and pending work that isn't visible just from reading the code.

## What BidPulse Is
A done-for-you government bid prep service for small local trade contractors
(janitorial, HVAC, landscaping) in the Jacksonville, FL area. Contractor
submits bid info through an intake wizard; Mike (admin) prepares the actual
deliverables (capability statement, compliance matrix, technical narrative)
using AI-assisted drafting, then the client pays and downloads the package.

**Stack:** Next.js 15 (App Router, TypeScript), Tailwind, Supabase
(Postgres + Auth + Storage), Vercel (now deployed at bidpulse-nine.vercel.app).
GitHub Codespaces for development.

**Deploy status (2026-09-01):** `origin/main` is at `bebb5b6`, pushed and
should be live on Vercel shortly. This includes the forgot-password flow
(`46c999f`) and the AppShell logo-link fix (`20d2b57`) — both had been
sitting committed-but-unpushed for a while; see the note below about what
that gap actually caused. One uncommitted change remains, not mine — Mike's
own edit to `lib/email/send.ts`, pointing the sending address at the
verified `bidpulse.co` domain instead of Resend's shared test domain.
All schema migrations through
`20260831233428_add_estimated_value_and_lean_package_threshold.sql` are
applied to the live Supabase project. No new migrations this session — the
"no guarantee of winning" acknowledgment reused the existing `audit_log`
table instead of adding a column.

## How schema changes get made now
As of 2026-08-31, all schema changes go through Supabase CLI migrations —
`npx supabase migration new <name>`, edit the generated file under
`supabase/migrations/`, then `npx supabase db push`. Never edit the schema
freehand in the Supabase dashboard's SQL editor — that's what caused
`schema.sql` to drift from the live database in the first place (four orphan
tables lingering with no tracked history). `schema.sql` is a generated
reference now (`npx supabase db dump --schema public`), not hand-maintained —
regenerate it after every migration and commit the diff, never edit it
directly.

## Confirmed Working (tested with real evidence, not just "reported done")
- Client signup, login (password + magic link), intake wizard (simplified to
  4 fields in step 1; skips "About the bid" when created from an assigned match)
- Scraper pulls real JAA listings from flyjacksonville.com/bids.aspx
- Admin can log/assign opportunities manually, with fit-check firing automatically
- Auto-draft (capability statement, compliance matrix, technical narrative) —
  fabrication bugs found and fixed twice; current behavior correctly uses
  bracketed placeholders / "NEEDS VERIFICATION" instead of inventing facts
- Compliance matrix is agency-aware (airport → SIDA badging, school → background
  checks, transit → DBE, with correct federal-funding reasoning on airport projects)
- Fit-check runs automatically on both client intake AND admin "Assign"
- Company Profile (license, insurance, differentiators) + certifications with
  admin verification toggle — feeds Auto-draft's facts block
- Payment gate: Preview always free (in-app modal, not a real PDF — a real PDF
  preview would let people bypass payment via the browser's own PDF viewer),
  Download gated by `packages.paid`, Pilot package type always bypasses gate
- Full bid packet PDF generation (jsPDF + jspdf-autotable for real tables)
- Stage-change emails (Resend, currently test-mode: only delivers to
  michaeltcoleman@gmail.com until a custom domain is verified)
- Daily digest + 48-hour turnaround SLA tracking (Vercel Cron, 2 jobs/day limit
  on Hobby tier — already at that limit)
- Contact form (`/contact`, saves to `support_messages` + emails admin) +
  `/admin/messages` inbox — verified 2026-08-31 end-to-end (real browser
  session submitted a message, admin login confirmed it in the inbox)
- Real logo (multiple variants — stacked, horizontal nav, app icon/favicon)
- Compliance matrix mandatory/conditional/trade-specific categorization
  (`lib/compliance/requirements-reference.ts`) — verified 2026-08-31: real
  admin session generated a compliance matrix for a test submission whose
  scope mentioned "prevailing wage" and "pesticide," and the generated
  draft correctly included all 7 always-mandatory rows plus the two
  triggered conditional/trade-specific rows
- Fit-check set-aside eligibility flag (`lib/compliance/set-aside-eligibility.ts`,
  `fit_eligibility_concern`/`fit_eligibility_explanation`) — verified
  2026-08-31: a real intake submission mentioning "SDVOSB Set-Aside" from a
  client with no verified SDVOSB cert correctly set the concern flag with
  the right explanation. As of 2026-09-01 this also names the SPECIFIC
  program (JSEB vs. DBE/SDB) based on funding source
  (`lib/agency-type.ts`'s `isFederallyFunded()`, checked against the bid's
  own scope text) instead of a generic "set-aside certification" message,
  and flags a cross-contamination risk even when the client holds the
  *wrong* program's cert for the funding source in play (a JSEB cert
  doesn't satisfy a federally-funded DBE/SDB requirement, or vice versa —
  verified live with a real submission where this exact mismatch fired
  correctly). JSEB and DBE/SDB are now real trackable certification types
  (client-facing dropdown in `CertificationsSection.tsx`) — neither existed
  anywhere in the app before this. Re-verified live during the September
  audit against all 5 hardening edge cases: ambiguous funding source,
  multiple set-aside mentions in one bid, client holding a different
  (wrong) verified cert than what's required, near-miss keyword text not
  false-firing (e.g. "vosb" inside "sdvosb"), and casing/spacing variance
  in set-aside language (e.g. "8 ( A )  SET-ASIDE") — all 5 passed.
- Static bid-process warnings (Cone of Silence, Florida Sunshine Law/public
  records, government payment lag Net-30/45, mobilization/NTP timeline) —
  shared `BidProcessNotices` component shown on the intake confirmation
  screen and the client dashboard. Verified 2026-09-01 rendering in the
  real flow via screenshots at both locations.
- Bid-specific risk detection from real scope text, verified 2026-09-01
  with present/absent real submissions for both:
  - Prevailing/living wage risk (`lib/compliance/wage-risk.ts`,
    `wage_risk_concern`/`wage_risk_explanation`) — flags prevailing wage,
    living wage, Davis-Bacon, Service Contract Act, or wage determination
    language; never invents a dollar figure.
  - Mandatory site visit detection (`lib/compliance/mandatory-site-visit.ts`,
    `mandatory_site_visit_concern`/`mandatory_site_visit_explanation`) —
    requires an actual "mandatory"-equivalent word near a site-visit term
    in the same sentence, so a bare/optional site-visit mention never
    false-positives. Fixed a related bug in the existing compliance-matrix
    reference-library entry, which had a bare "pre-bid conference" keyword
    that would have fired even when a bid called the conference optional.
  - All three fit-check concern flags (this pair plus the pre-existing
    eligibility one) now actually render in the UI for the first time —
    they were computed and persisted by an earlier session but never shown
    anywhere. Escalating visual prominence: mandatory site visit renders
    most urgently (red), since missing a truly mandatory walkthrough gets a
    bid rejected unopened as non-responsive.
- Dollar-value threshold → lean package — `submissions.estimated_value`
  (admin-entered, nullable) and admin-adjustable
  `organizations.lean_package_threshold` (default $35,000, FL Statute
  287.017 Category Two *state* threshold; editable at the new
  `/admin/settings` page since local bodies may set their own). When
  estimated_value is below threshold, the deliverables panel shows a
  suggestion banner — never automatic, confirmed with Mike, since
  estimated_value is often a rough guess — to switch from the full
  3-deliverable set to a lean one (Rate Sheet, Executive Cover, Certificate
  of Insurance). No pricing data exists anywhere in the schema, so Rate
  Sheet is placeholder-only (never invents a rate); Certificate of
  Insurance is a summary of what's on file, not a substitute for the real
  uploaded COI document. Verified 2026-09-01 with real below/above-threshold
  submissions.
- Package-linking UI: `PaymentStatus.tsx` — admin can now create a new
  package (type, price note) or reuse an existing one from the same client
  (packages are 1:many with submissions — no unique constraint ties one to
  the other, confirmed against `schema.sql`), link it to the submission,
  and mark it paid. The earlier "No package linked to this submission yet"
  message with no way to act on it is closed. Verified with a real
  DB-backed test: before linking, `isPaidOrPilot` → false; after linking +
  marking paid → true; a `pilot`-type package unlocks downloads without
  `paid = true`, as designed.
- Tracked Supabase CLI migrations: 8 real migration files in
  `supabase/migrations/`, confirmed via a live query that every column they
  add actually exists on the live database (not just sitting as unapplied
  local files).
- IT/Computer Support compliance vertical: three new
  `TRADE_SPECIFIC_CERTIFICATIONS` tiers in
  `lib/compliance/requirements-reference.ts` — VA information-system/data
  access (VA Handbook 6500.6, VAAR 852.239-70), Section 508/ICT
  accessibility (VAAR 852.239-75), and Controlled Unclassified Information
  (NIST SP 800-171 / CMMC / DFARS 252.204-7012 family). Trigger keywords
  are real VAAR/DFARS clause citations, verified against actual
  Acquisition.gov clause text rather than generic terms, specifically so
  "veteran" or "computer" alone in a bid never triggers any of the three.
  `lib/agency-type.ts` also gained a `"va"` agency type (matched on agency
  name: "veterans affairs," "VAMC," "VISN," etc. — deliberately not a bare
  "VA," which collides with the Virginia state abbreviation) for a softer,
  non-blocking fit-check note. Verified live against 7 cases (no VA/CUI
  language, VA system-access language, Section 508 language, CUI/NIST
  language, plus false-positive probes for "circuit" — which contains the
  substring "cui" — and generic "veteran"/"computer" mentions) — all
  correct. See "Known Issues" for the real Dar Mano Consulting bid this
  vertical was built to address.
- Trade-coverage safety net: `lib/compliance/known-trades.ts` defines the
  currently-supported trades (HVAC, Janitorial, Landscaping, IT/Computer
  Support) as the single source of truth for three touchpoints — a red
  admin-facing banner on the submission detail page, an 8th-grade-level
  note inside the actual compliance-matrix deliverable content (client
  reads this in preview/download), and an intake-time heads-up on the
  client dashboard. Verified live: an electrical-contracting test
  submission (unsupported trade) correctly triggers all three; a
  landscaping test submission (supported) triggers none, no regression.
  One byproduct fix needed to make the deliverable note actually reach the
  downloaded PDF: `lib/pdf/deliverables-packet.ts`'s compliance-matrix
  renderer previously only ever drew the pipe-delimited table and silently
  dropped every surrounding prose line (including the pre-existing
  "[DRAFT...]" disclaimer and the trailing scope-reference line) — fixed to
  render prose and table segments in their original order.
- Homepage trade list is now generated, not hardcoded, in both places it
  appears: the "Built for small trades" tagline (`app/page.tsx`) is built
  from `KNOWN_TRADES` via `Intl.ListFormat` (proper Oxford-comma "X, Y, and
  Z" joining) plus a small sentence-casing helper (keeps acronyms like
  HVAC/IT uppercase, lowercases the rest so it reads naturally mid-sentence).
  The separate "Trades we work with" card grid (icon + description per
  trade) can't be auto-generated the same way — it needs real authored
  content per trade — so instead it has a module-scope check that throws if
  `KNOWN_TRADES` ever gets an entry with no matching card, both in dev
  (real 500 + exact error) and in `next build` itself (confirmed a real
  build failure, not just a dev-time one). The IT/Computer Support card
  that was missing (added when the vertical shipped, but never added here)
  is now present. Verified with real screenshots; the drift check was
  proven by temporarily adding a 5th fake trade with no card and confirming
  both dev and build failed loudly, then reverting.
- Fit-Score Quiz (`/quiz`) audited and confirmed fully built and working —
  not a stub. Four real yes/no questions, `yesCount >= 2` -> "strong fit"
  vs. "we can still help" branch, both routing to `/intake`. Purely
  client-side (`useState`, no `supabase`/`fetch` calls, no schema table) —
  deliberate, not an oversight, per the code's own comment. Means a visitor
  who finishes the quiz but doesn't click through leaves zero trace; worth
  knowing if lead capture on drop-off ever becomes a priority.
- Logo consistency audit: every location that renders a BidPulse
  logo/icon — favicon, marketing nav, marketing footer, admin header,
  client dashboard header (same shared `AppShell`, so these two can't
  drift from each other), login page — already uses its correctly intended
  asset per the three-variant mapping (icon-only for favicon, horizontal
  for nav bars, stacked for login). No code-level mismatches found. Email
  templates (`lib/email/templates.ts`) are plain text, no logo, nothing to
  fix there. See Open — Needs Attention for a real visual inconsistency
  found in the source art itself (not a code bug).
- Login page (`app/login/page.tsx`): the logo is now a `Link` to `/` — the
  page previously had no way out at all except closing the tab. Kept
  minimal, no full nav bar added. Verified real click-through to `/` and
  browser back to `/login` both work.
- **Password reset was redirecting to localhost — root-caused and fixed.**
  Not an app-code bug: there was (and still is, until the item below is
  committed) no `resetPasswordForEmail` call anywhere in the codebase. The
  actual cause was the Supabase project's Auth settings — `site_url` was
  `http://localhost:3000` and the redirect allowlist was completely empty,
  so *any* redirect target, even a correct dynamic one, got silently
  overridden back to localhost. Fixed via the Management API: `site_url` ->
  `https://bidpulse-nine.vercel.app`, redirect allowlist ->
  `https://bidpulse-nine.vercel.app/**,http://localhost:3000/**` (both, so
  local dev keeps working). Verified live: generated a real recovery link
  via the admin API for a real existing user and confirmed the actual HTTP
  303 redirect lands on the production domain, not localhost.
- Forgot-password flow — genuinely missing before, now built.
  `LoginForm.tsx` gained a "Forgot password?" link and a request-reset mode
  calling `resetPasswordForEmail` with `redirectTo` pointed at the existing
  `/auth/callback` route (same PKCE code-exchange route the passwordless
  magic-link flow already used — reused, not duplicated) with
  `next=/reset-password`. New `app/reset-password/page.tsx` +
  `ResetPasswordForm.tsx` lets the user set a new password once a real
  session exists (from the exchanged recovery code), with a clear "this
  link is invalid or expired" fallback if there's no session (link already
  used, expired, or the page opened directly). Verified end-to-end with a
  real test account: real request submitted, signed in with the original
  password, reset the password with a real session, **signed out and back
  in with the new password to confirm it actually changed** (not just that
  the UI reported success), and confirmed the no-session fallback state
  renders correctly for a fresh visitor. A literal inbox click-through
  couldn't be tested (this project's PKCE flow needs the same browser that
  requests the reset to hold the matching code-verifier when it completes
  the exchange, and there's no real inbox to check in this environment) —
  every other real code path this touches was verified instead. Committed
  (`46c999f`) — **but this commit sat unpushed for a while after landing,
  which caused a real, confusing production symptom: see the note below
  under Known Issues about "Forgot password?" appearing to send the wrong
  email.** Now actually pushed (`bebb5b6`), and **confirmed fully working
  live**: a real click-through on the deployed site received an actual
  "Reset your password" email, followed it to a working form, changed the
  password, and logged in with the new one successfully. Fully closed.
- "No guarantee of winning" disclaimer — closes the loop on the fit-check
  system's existing no-win-probability-claims stance for the client-facing
  side. `components/ui/BidFileStep.tsx` (the real final-submit step, shared
  by the intake wizard and the dashboard's "complete your bid" card) now
  has a required checkbox that genuinely gates the "Send it to us" button
  (`disabled={saving || !acknowledged}`, not just decorative text).
  Persisted as a real `audit_log` entry (`no_guarantee_acknowledged`, exact
  acknowledgment text, real timestamp) right alongside the existing
  `submission_locked` entry in `finalizeSubmission()` — no new
  column/migration needed. Also added short plain-language disclaimer text
  to the marketing footer (every page) and the pricing page (right after
  the bottom CTA). Verified end-to-end with a real signup: confirmed the
  submit button is genuinely disabled unchecked, enables once checked, and
  a real DB read-back after submitting showed the audit_log row with the
  correct text and timestamp. Test accounts cleaned up afterward.
- **Signed-in users had no way back to the marketing site — a real bug,
  distinct from the earlier login-page exit-link fix.** The login-page fix
  (`822de01`) only ever covered an anonymous visitor sitting on `/login`.
  Once actually signed in, both admin and client accounts hit a real dead
  end: `components/ui/AppShell.tsx` (the header shared by every `/admin/*`
  and `/dashboard/*` page) had its logo as a plain, unlinked `<Image>` —
  not wrapped in a `Link` at all — and its nav items only point to in-app
  routes. Even a link to `/` wouldn't have helped: `app/page.tsx`'s root
  routing deliberately bounces any signed-in user straight back into the
  app, so `/` can never show the marketing homepage to someone logged in.
  The only way out was signing out entirely — confirmed by reproducing
  with real admin and client test accounts (sign in, land on
  `/admin/inbox` or `/dashboard`, navigate directly to `/`: bounced right
  back both times). Fixed by linking AppShell's logo to `/pricing` instead
  of `/` — a real public page that doesn't get overridden by the
  signed-in redirect. Verified for both roles with real test accounts:
  admin and client each land on `/pricing` after clicking the logo, zero
  console errors either time.
- A separate console error a real browser session surfaced
  (`A tree hydrated but some attributes of the server rendered HTML
  didn't match...`, with `RedirectBoundary`/`HTTPAccessFallbackBoundary`/
  `NotAllowedRootHTTPFallbackError` in the component stack) turned out to
  be a Chrome DevTools artifact, not a real bug — confirmed from the
  screenshot itself, which showed the Responsive device-emulation toolbar
  active. DevTools injects a `zoom` style onto `<body>` in that mode,
  which is exactly the mismatched attribute React flagged; it's unrelated
  to any actual page. Worth remembering for next time: those boundary
  component names are normal Next.js 15 App Router scaffolding present on
  *every* route regardless of whether a redirect/not-found is actually
  firing — seeing them in a stack trace isn't itself evidence of anything
  broken. Re-tested outside Responsive mode and the warning didn't recur.
- `tsconfig.json`: removed the deprecated `baseUrl` option (TS flagged it
  as going away in TypeScript 7.0). It was redundant under
  `moduleResolution: "bundler"` — `paths` resolves relative to the
  tsconfig file's own directory without it. Confirmed via both
  `tsc --noEmit` and a real `next build` that every `@/*` import still
  resolves correctly.
- Mobile nav menu items now read as real tappable buttons. Confirmed
  mobile-only (desktop nav's plain text links are a standard, working
  pattern with hover states — the gap was specifically the full-width,
  stacked, touch-only mobile drawer). `MarketingShell.tsx`'s mobile menu
  items (Pricing, Fit-Score Quiz, Gallery, FAQ, Blog, Log in) now use the
  same secondary-button treatment already established elsewhere on the
  site — bordered, rounded, full-width, hover/active states — matching
  "Get started"'s visual weight instead of sitting as plain stacked text.
  The active/current page keeps a distinct highlighted border+color state.
  Verified with real before/after screenshots at a real mobile viewport,
  plus the active-page and dark-mode states.
- Admin inbox (`/admin/inbox`) is now a genuine FIFO queue, oldest-submitted-
  first — previously there was no consistent order at all (a flag-priority
  sort that ignored `submitted_at` entirely, so due dates jumped around
  row to row with no visible logic). The query now excludes `draft = true`
  rows outright (not yet actionable, no `submitted_at` to queue by) and
  sorts `is_test` ascending before `submitted_at` ascending, so rehearsal
  submissions always sort after every real one regardless of their own
  submission date, matching the existing principle of excluding test data
  from real reporting elsewhere in the app. The "Past due"/"Needs
  attention" badges are unchanged and still computed the same way — they
  no longer reorder rows, just flag them in place, since a real FIFO means
  row position always matches submission order. Verified with a real
  DB-backed test: inserted rows with deliberately out-of-order
  `submitted_at` values, a draft row, and a test row whose `submitted_at`
  was the *oldest* of all — confirmed the real rendered admin inbox
  excluded the draft entirely, ordered the real rows correctly
  oldest-first, and still sorted the test row dead last despite its date.
- Admin → client "need more info" requests: new "Request info from
  client" card on the submission detail page. Went with the
  `checklist_items` + email approach over extending `support_messages`
  bidirectionally — checked that table's actual RLS first (currently
  INSERT-anyone/SELECT-admin-only, no client-facing read UI at all), so
  bidirectional would have needed a new migration, RLS in both
  directions, and a client UI built from scratch; the checklist_items
  route needed none of that. The text box pre-fills from the real Fit
  Check explanation (the one actual "what's missing" text that exists —
  a single joined paragraph, not separate structured suggestions) for the
  admin to edit down before sending. On submit: creates a real
  `checklist_items` row (already client-readable, zero dashboard changes
  needed), emails the client via a new `getInfoRequestEmail()` template
  (`lib/email/templates.ts`), and logs a real `audit_log` entry
  (`info_requested`, alongside the existing event types in
  `AUDIT_EVENT_LABELS`). Test submissions skip the real email send,
  matching the existing convention. Verified end-to-end with a real
  submission: confirmed the prefill pulled the actual Fit Check text,
  sent a real request, and a real DB read-back showed the correct
  `checklist_items` row and `audit_log` entry, plus confirmed the item is
  visible via the exact query the client dashboard already uses.
- **Company-profile document upload/extraction — a real, net-new
  capability, not an enhancement of an existing one.** The brief that
  requested this assumed an existing extraction route already handled
  company-profile fields (company name, license, insurance,
  certifications); that route (`extract-from-document`) only ever
  extracted bid/RFP fields (agency, due date, scope, etc.) — nothing in
  the app extracted company-profile info from a document before this.
  Built as a separate route, `app/api/extract-company-profile/route.ts`
  (kept separate from the bid-extraction route since the schemas and
  consumers are entirely different), sharing a new
  `lib/document-parsing.ts` helper with the bid-extraction route so
  PDF/DOCX/TXT support only needs maintaining in one place (also closes
  the file-type gap on the bid-extraction route itself — legacy binary
  `.doc` deliberately stays unsupported, no safe parser exists without
  adding a new dependency).
  - Two new `clients` columns via a tracked migration:
    `business_registration_number` (state/Sunbiz filing number) and
    `commercial_auto_coverage`, alongside the existing
    `general_liability_coverage`/`workers_comp_coverage`. Also found and
    fixed real drift in `schema.sql` itself while regenerating it — a
    function and an RLS policy that existed live but had gone missing
    from the committed reference file at some earlier point.
  - Added a new mandatory compliance-matrix item, "Business Registration
    (Sunbiz / State Filing)," distinct from the existing "Local Business
    Tax Receipt / Occupational License" row — the brief claimed this
    distinction already existed in `requirements-reference.ts`; it
    didn't, so this closes that gap for real rather than assuming it was
    already done.
  - The extraction prompt is deliberately explicit that
    business-registration numbers and trade-license numbers are
    different things — the one real fabrication risk here, verified with
    a synthetic test fixture whose only registration-style number was a
    Sunbiz Doc# with no separate trade license stated anywhere: extracted
    `licenseNumber: null` correctly, never confused the two.
  - Certifications extract as an array (`client_certifications` is a
    real one-to-many table) using the *actual* `cert_type` vocabulary in
    use in `CertificationsSection.tsx` (`JSEB`, `DBE/SDB` are real
    first-class values there, not just the six federal SBA program types
    the schema comment implied) rather than the stale schema comment —
    caught this before wiring the UI, not after.
  - Wired into both the Company Profile page (`CompanyProfileClient.tsx`
    — upload prefills the form via a remount-on-extraction pattern,
    nothing saved to the `clients` row until the existing "Save company
    info" button is clicked; certifications insert immediately since
    that's a separate table with its own existing "add" flow) and the
    intake wizard's "About you" step, as a new optional micro-step shown
    right after account creation (`Want to save some typing?`) — the
    extraction route requires a real session, so it can't run any
    earlier in an anonymous visitor's flow than that; the wizard's own
    fields stay exactly as minimal as before for anyone who skips it.
  - Along the way, found `/dashboard/*` had no `ToastProvider` at all
    (only `/admin/*` got one earlier this session) — `useToast()` was
    crashing the whole Company Profile page render. Added
    `app/dashboard/layout.tsx` to fix it for real, not just this one
    feature.
  - Verified end-to-end on both surfaces with a synthetic test fixture
    (no real fixture was available in this environment — built one
    matching every field and value the brief specified) via real
    Playwright sessions and real DB read-backs: correct field values
    across the board, all 4 certifications inserted as separate rows
    (not collapsed to one), `licenseNumber` correctly null, Company
    Profile's fields persisted only after clicking Save and confirmed via
    a fresh page reload, intake's fields persisted immediately and
    confirmed via direct query.
- A follow-up report claimed three "systemic field-mapping" bugs in the
  above (insurance provider holding coverage text, license# still
  colliding with the Sunbiz number, phone/business_phone confusion) —
  re-verified against the actual shipped code rather than assumed stale:
  none are present. Specifically retested with a new fixture variant
  that, unlike the original, states a real insurance carrier name — came
  back correctly as `insuranceProvider`, with `workersCompCoverage`
  still separate and correct. Field mapping is by JSON key name
  throughout (`obj.insuranceProvider`, `obj.workersCompCoverage`, etc.),
  not array position, so there's no structural way for values to shift
  between fields. The "phone empty" observation is by design, not a
  bug: `clients.phone` is the account's login/SMS-auth number, and
  extraction deliberately never writes to it — overwriting a real
  auth-linked phone from a guessed document value would be a real risk.
  Confirmed with Mike: leave as-is, business_phone only.
- **One real, live bad record found and corrected.** The re-verification
  above was about the *code* — separately, a genuinely live `clients` row
  ("Coastal Clean Facility Services, LLC," `cbow038@gmail.com`, created
  17:05 that day, well before the extraction feature shipped) actually
  did have the exact bad values described: `license_number` held the
  Sunbiz number with a trailing space, `insurance_provider` held
  "Statutory FL limits." Whitespace/tab artifacts throughout the record
  point to this having been hand-typed into the *old* Company Profile
  form (before it had a dedicated Business Registration field) rather
  than produced by the extraction feature. Backfilled exactly the three
  named corrections, nothing broader: `license_number` → null,
  `business_registration_number` → `L25000TEST99` (trimmed),
  `insurance_provider` → null (its correct value was already separately
  present in `workers_comp_coverage`, left untouched). `phone` left null
  per the same business_phone-only decision above. Verified with a
  direct before/after read of the actual record, not just "the query ran
  without error."
- **Admin → client "need more info" requests — now fully verified, not
  just built.** This was built and committed (`2eb27d6`) but a follow-up
  correctly pointed out that build vs. verified are different things
  here. Closed the one real gap: previously confirmed the email *send*
  succeeded (no error, correct `checklist_items`/`audit_log` rows) but
  never literally checked a received email's content — this time sent a
  real request through the actual UI to a real, publicly-checkable
  mailinator inbox and read back the actual delivered email: subject
  **"We need some info for your Verify Agency bid"** — the real
  `getInfoRequestEmail()` template, not a sign-in-link-style mixup.
  Confirmed working end-to-end.

## Known Issues / Recently Fixed
- **Due-date alerting was reported as broken but is actually already
  correct — audited, not fixed.** The report claimed the daily digest
  (`app/api/daily-digest/route.ts`) only fires on staleness, so a
  submission due tomorrow that was touched today would get no alert.
  Traced the actual filter before writing any code: it's a genuine 3-way
  OR (`breachedTurnaround || daysUntilDue <= 5 || stale`), not staleness
  gating the due-soon check — a due-tomorrow-but-fresh submission already
  fires today, and the email template already labels it distinctly ("DUE
  SOON — N days left," sorted to the top). Git history shows this file
  was only ever touched once, so it's not a regression either. Likely
  explanation for the report: the variable name `staleItems` and the
  `"nothing_stale"` skip reason read as if staleness gates everything,
  without tracing the actual OR. Verified for real, not just by reading
  the code: inserted an isolated test submission (`daysSinceUpdate: 0`,
  `breachedTurnaround: false`, due tomorrow) and confirmed it passed the
  real filter purely on the due-soon condition. No code change made.
- **"Forgot password?" appeared to send a sign-in link instead of a
  password-reset link — root cause was a deployment gap, not a code
  bug.** Real evidence: emails received while testing on the live site
  were titled "Your sign-in link" (Supabase's magic-link template), not
  "Reset your password" (the recovery template) — four arrived within a
  ~3 hour window, consistent with repeated attempts. Investigated by
  checking the actual deployed commit: `origin/main` was still at
  `e83f77a` when this was reported — the forgot-password commit
  (`46c999f`) had been committed locally but never pushed, so production
  had no "Forgot password?" feature at all yet, only the pre-existing
  "Sign in without a password" magic-link option. That's the one that got
  clicked/tested, and it correctly sent exactly the sign-in-link email
  it's supposed to. Confirmed the actual code is correct (grepped every
  call site — the "forgot" mode's form really does call
  `resetPasswordForEmail`, not `signInWithOtp`) and confirmed via the
  Supabase Management API that the recovery and magic-link mailer
  templates are genuinely distinct on the project (`mailer_subjects_recovery
  = "Reset your password"` vs. `mailer_subjects_magic_link = "Your
  sign-in link"`) — so there was nothing to fix in either the app code or
  the Supabase project config. Pushed the previously-stranded commits
  (`bebb5b6` now on `origin/main`) so this stops recurring. **Retested
  live and confirmed fully working**: a real click-through received an
  actual "Reset your password" email, followed it to a working form,
  changed the password, and logged in with the new one successfully.
  Fully closed.
- Fixed twice: RLS blocking `clients` insert during signup. Most recent
  instance was Vercel-only (didn't reproduce in Codespace) — suspected timing
  issue between `signUp()` resolving and the session being ready for the
  `clients` insert's RLS check.
- Admin signup page (`/admin/signup`) was removed — this business only needs
  one organization; the page was a real risk (anyone could accidentally spin
  up a second, disconnected org).
- Fixed 2026-08-31: the `rfp-documents` storage bucket had four broad,
  ownership-blind RLS policies (anyone could read; any authenticated user
  could update/delete/upload into ANY client's or submission's folder, not
  just their own) sitting alongside properly-scoped ones — the broad grants
  fully overrode the scoped checks. Closed via
  `supabase/migrations/20260831210857_fix_rfp_documents_storage_rls.sql`
  (added `can_access_client_object()` for the certifications upload path,
  which the old scoped policies didn't cover, then dropped the four broad
  policies).
- Fixed 2026-08-31: the follow-up above is done. `file_url` columns
  (`submission_documents`, `deliverables`, `client_certifications`) now
  store the bare storage path, not a public URL; every read site generates
  a signed URL at request time (`lib/storage.ts`) instead of persisting
  one. The `rfp-documents` bucket is now private
  (`supabase/migrations/20260831214629_make_rfp_documents_bucket_private.sql`).
  One bug found and fixed mid-migration: certification/deliverable uploads
  never sanitized filenames, so the initial backfill left percent-encoded
  paths (spaces as `%20`) that didn't match the real storage key — corrected
  in a follow-up migration and verified live against `storage.objects`.
- Fixed 2026-08-31: `lib/agency-type.ts`'s school/airport detection regexes
  (`\bschool\b`, `\bairport\b`) never matched their own plurals — no word
  boundary between "l"/"t" and a trailing "s" in "Schools"/"Airports". Real
  impact: "Duval County Public Schools" silently never triggered the Level 2
  background-check compliance row. Also affects real airport-authority names
  using plural "Airports" (e.g. "Metropolitan Washington Airports
  Authority"). Fixed to `\bschools?\b` / `\bairports?\b`; `transit` checked
  and didn't have the same bug.
- Not a bug, but worth a manual look: the Dar Mano Consulting "Computer
  support for Veterans" submission (the real bid that prompted the IT
  vertical and trade-coverage safety net work) correctly shows NO
  VA-system/CUI flags right now — but that's because the bid's scope text
  doesn't contain confirmed trigger language, not because we've verified
  it's actually safe. The system is correctly declining to guess rather
  than confirming an answer either way (its NAICS code, 238290, is also
  generic enough — "Other Building Equipment Contractors" — to give no
  extra signal). Worth reading the actual solicitation by hand for this
  one specific bid before treating the silence as a clean bill of health.

## Open — Needs Attention
- Session timeout is currently unset — Supabase Auth defaults to sessions
  that never expire from inactivity, silently refreshing forever. This is
  a project-level setting (applies to both admin and client sessions
  alike, not settable per-role), configured in the Supabase Dashboard
  under Authentication → Sessions, not in code. Given client data includes
  real insurance policy numbers, license numbers, and uploaded RFP files,
  this shouldn't stay on the indefinite default by accident. Recommendation
  discussed: set an inactivity timeout in the 14-30 day range; skip a hard
  time-box for now (more appropriate for stricter compliance needs than
  BidPulse actually has, and would add re-login friction for admin with no
  real security gain). Not yet set — needs a deliberate choice, not left
  as a default.
- Manually verify the Dar Mano Consulting "Computer support for Veterans"
  bid's actual VA-system/CUI exposure by reading the real solicitation —
  see the matching note in Known Issues above. The system correctly stayed
  quiet, but quiet isn't the same as verified-safe for this one.
- Favicon doesn't visually match the nav/login logo mark. The logo audit
  (2026-09-01) confirmed every location uses its correctly *intended* asset
  (no code-level mismatch), but the three source PNGs weren't drawn as a
  matched set: the favicon (`app/icon.png`) is a flat navy "BP" monogram
  with heavier strokes, while the nav/login mark is a plain heartbeat-only
  shield with a lighter gradient and thinner strokes. Not something a code
  fix can resolve — needs a design decision (redesign the favicon to match,
  or leave the bolder "BP" monogram as deliberate for small-size
  legibility), and per the Business/Naming Note below, further
  logo/branding work is already paused pending the trademark question — put
  this in the same bucket rather than deciding it standalone.
- Theme color tokens vs. the new logo's real palette — not yet looked at.
  Flagged in the 2026-09-01 build order as likely fallout from the
  shield/heartbeat logo swap; needs pulling the actual colors from the logo
  assets and comparing against the current Tailwind/design tokens.

## Deliberately Deferred (remaining items)
Items #1, #2, and #4 from the original list (static bid-process warnings,
bid-specific wage/site-visit/cash-flow/mobilization detection, and the
dollar-threshold lean package) were completed 2026-09-01 — see Confirmed
Working above. Remaining:
1. Law enforcement/detention facility category for agency-aware compliance
   (background checks, bloodborne pathogen cert — covered by
   TRADE_SPECIFIC_CERTIFICATIONS and confirmed working via keyword
   detection, but not yet confirmed whether it's integrated into the
   `lib/agency-type.ts` keyword-detection system alongside
   airport/school/transit/`va` — worth a quick check next time agency-type
   is touched).
2. "Message admin" feature tied to a specific bid (same `support_messages`
   table already supports this via `submission_id` — just needs the UI).
3. Retainer package usage tracking (how many bids used this month vs. the
   "up to 2/month" promise) — explicitly deferred, no schema yet.

## Business/Naming Note
A different company (ad-tech, Boston, bidpulse.io) already uses the name
"BidPulse" — different industry, likely low trademark risk, but Mike was
advised this isn't a legal opinion and to check the USPTO database or consult
an attorney before investing further in the name. Also relevant: he's not
fully happy with the current logo and was already planning to revisit it —
worth reconsidering both together.

**New shield/heartbeat logo is now wired in**, ahead of the trademark
question being resolved — the three PNG variants (BP-monogram shield icon,
horizontal shield+wordmark, stacked shield+wordmark) were trimmed to their
real content bounds and given a transparent background (the originals were
opaque-white 1024x1024 canvases, which would have shown ugly white boxes
against the app's own surface color), then wired into every actual asset
location: `app/icon.png` is the new shield+BP+heartbeat mark (replacing
both the old glossy 3D icon and the `app/icon.tsx` placeholder — that
placeholder's own comment said "until a real designed logo exists," so
it's deleted now that one does), `public/logo.png` is the new horizontal
shield+wordmark (used by `AppShell.tsx` nav, `MarketingShell.tsx` nav +
footer, and the `PacketButtons.tsx` PDF-preview watermark — all four call
sites' width/height props updated to the new image's real aspect ratio so
none of them render squished), and the new `public/login-logo.png` (stacked
variant) now replaces the old wide logo on the login page. Verified with
real Playwright screenshots of the live dev server's homepage nav and login
page — both render correctly. This does supersede the current logo
entirely (the old `logo.png`/`icon.png` are gone, not kept as alternates) —
worth flagging that the trademark question is still open, so this
represents committing real design/engineering time to a name that might
still change.

## Working Style Notes (for continuity)
- Always verify fixes with real regenerated output/evidence, not just "done"
- Auto-draft content must never invent specific facts (registration numbers,
  insurance amounts, brand names, statistics) — bracketed placeholders or
  "NEEDS VERIFICATION" only, grounded strictly in real client/bid data
- Mike is not deeply experienced in gov contracting but is actively
  researching it himself and bringing back real domain knowledge to build in
- Solo operator with a day job — features that catch problems automatically
  (digest emails, SLA tracking) are treated as essential, not nice-to-have
