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

**Deploy status (2026-09-02):** `origin/main` is at `f1e4545`, pushed and
live on Vercel. Working tree is clean — nothing outstanding. All schema
migrations through
`20260901230450_add_business_registration_and_commercial_auto.sql` are
applied to the live Supabase project (adds `clients.business_registration_number`
and `clients.commercial_auto_coverage` — the "no guarantee of winning"
acknowledgment itself needed no migration, reusing the existing
`audit_log` table instead).

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
- **Request-info voice/duplication fix, and certifications optional
  upload** — both confirmed done and **pushed to `origin/main`**
  (`acea384`), per the 2026-09-03→04 session handoff. Not just committed
  locally this time — reconciled and on the main branch.
- **"Message admin" UI** — a genuine two-way message thread on a
  submission (`SubmissionMessages.tsx`), separate from "Request info from
  client." New `support_messages.sent_by_admin_id` column + a rewritten
  INSERT policy (the old one was `with check (true)`, too permissive for
  a real thread) covering the anonymous contact form, a client's own
  message, and an admin's message, plus a new client SELECT policy (none
  existed before). Verified 2026-09-02 with a real disposable client and
  admin: client sends → admin sees and replies → client sees the reply,
  each step confirmed via direct DB reads. Confirmed the anonymous
  contact-form path still works completely unmodified, and confirmed the
  RLS negative case — a second client genuinely cannot read the first
  client's messages (empty result, not an error).
- **File upload on the new production project** — a real, pre-launch-blocking
  bug found 2026-09-02 during the first genuine end-to-end test against the
  new project, root-caused to two things created out-of-band before tracked
  migrations existed and invisible to the whole system (they live outside
  `public` schema): the `rfp-documents` storage bucket was never actually
  created by any migration (only later changes to it were tracked), and the
  submission-scoped `storage.objects` RLS policies (`can_access_rfp_object`)
  were never migrated either — only the client-scoped ones happened to be.
  Both confirmed directly via raw queries against the new project (zero
  buckets, 4 of the expected 8 policies) before writing either fix. Fixed
  with two new migrations, applied to both projects. Verified end-to-end
  against the *actual new project* (not dev) — a disposable test client
  uploaded a real PDF through the real intake UI, confirmed via the UI, a
  direct `submission_documents` read, and a direct Storage listing showing
  the real object with correct metadata.
- **Admin delete action** (submissions + matched opportunities) — single-record,
  admin-only, real type-to-confirm dialog (`ConfirmDeleteDialog.tsx`), never
  a bulk tool. Verified 2026-09-02 with a real disposable submission carrying
  a child row in every cascading table (`deliverables`, `checklist_items`,
  `admin_notes`, `submission_documents`) — confirmed all four are genuinely
  empty after deletion (checked directly), confirmed the `audit_log` entry
  for the deletion survives (its `submission_id` goes null via `ON DELETE
  SET NULL`, but `event_detail` keeps the agency/company name), and
  confirmed the client account itself stays intact afterward.
- **Dynamic diagonal watermark on the Preview modal** (`PacketButtons.tsx`)
  — "PREVIEW — [client company name] — [today's date]" tiled across the
  modal, ~7% opacity, `pointer-events: none`. Deliberately scoped to the
  existing text-only preview, not a real PDF (Preview never generates a
  real file for exactly this reason — a real PDF's native browser viewer
  would bypass the payment gate). Verified 2026-09-02 with a real
  screenshot using a deliberately extreme company name to stress-test
  wrapping — renders cleanly, content underneath stays fully legible.
- **5-stage submission pipeline** (`submitted → in_review → deliverables_ready
  → client_review → closed`) — `confirmed_submitted` removed 2026-09-02 via a
  real tracked migration (Postgres has no `DROP VALUE` for an enum, so this
  swapped in a new `submission_stage` type); confirmed zero rows sat in that
  stage beforehand, and row counts matched exactly before/after (16 total).
  Two auto-triggers replace what used to require a manual "Move to stage"
  click: `in_review → deliverables_ready` fires the moment all three full
  deliverables have real content/a file (`app/api/advance-if-deliverables-complete`),
  and `deliverables_ready → client_review` fires when the *client* (not an
  admin doing QA) clicks Preview on their own dashboard
  (`app/api/advance-on-client-preview`). Verified with a real disposable
  admin + client account: partial deliverable saves correctly don't advance,
  a complete set does; an admin's own Preview click does NOT advance the
  stage, a client's does. Every stage-label map, the Kanban board, the
  "Move to stage" button set, and the client-facing stepper all confirmed
  showing 5 stages via real screenshots, not just code review.
- Client signup, login (password + magic link), intake wizard (simplified to
  4 fields in step 1; skips "About the bid" when created from an assigned match)
- Scraper pulls real JAA listings from flyjacksonville.com/bids.aspx
- Inbound bid email pipeline (`app/api/inbound-bid-email/route.ts`) — a
  second producer into `matched_opportunities` alongside the scraper, for
  DemandStar/PublicPurchase/JTA notification emails forwarded via a Gmail
  Apps Script trigger (`scripts/gmail-inbound-bid-trigger.gs`). Verified
  2026-09-02 with real extraction calls and direct DB read-backs — not
  yet live in production, since it needs Mike's IONOS/Gmail/Apps Script
  setup first (see `scripts/README.md`) and the real
  `INBOUND_BID_EMAIL_SECRET` added to Vercel
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
- **Document upload/extraction's remaining items (file types beyond PDF,
  multi-certification, Commercial Auto) were re-requested as "still
  needed" but were already built and verified in the same-day work
  above** — a stale build order, not new scope. Re-confirmed directly
  against the current code (`detectDocumentKind` on both extraction
  routes, `certifications: ExtractedCertification[]` as a real array,
  `commercial_auto_coverage` in `schema.sql`) rather than trusting either
  claim. Closed the one genuinely untested angle: generated a real
  `.docx` file (not just `.txt`, which was already tested) from the same
  mock content and ran it through the actual extraction route — every
  field came back correct, including all 4 certifications and the
  Commercial Auto coverage.
- Theme color tokens recolored to match the new logo's actual palette.
  Sampled `public/logo.png`'s dominant pixel colors directly (navy
  wordmark `#102858`, cobalt shield blue `#2080c8`) rather than eyeballing
  it, then compared against `app/globals.css`'s design tokens.
  `--color-primary` was already close (deliberately matched to the logo
  during the earlier dark-mode-contrast fix), but `--color-secondary`
  (a teal, driving every button/link/badge app-wide) was a genuinely
  different hue family. Confirmed with Mike before touching it, since
  it's an app-wide visual change. Recolored `--color-secondary` and its
  container/on-* variants (light and dark mode) to the logo's blue,
  preserving each token's exact original HSL lightness — same contrast
  characteristics, different hue. Verified WCAG contrast ratios
  before/after: every pair improved (e.g. white-on-secondary button
  text 5.95:1 → 9.04:1), no accessibility regression. Left
  `--color-surface-tint` alone — confirmed via grep it's defined but
  never actually used as a class anywhere. Verified with real
  screenshots in both themes, homepage and login.
- 14-day inactivity sign-out, built at the app level since Supabase's
  native `sessions_inactivity_timeout` setting is real but gated behind
  a Pro-plan paywall this project isn't on (confirmed via the Management
  API — see Known Issues). `middleware.ts` now tracks a plain
  `bp_last_active` cookie (httpOnly, 14-day maxAge) as a sliding window,
  renewed on every authenticated request. Once a signed-in visitor goes
  14 days without a single request, the next one they make calls
  `supabase.auth.signOut()` server-side and redirects to
  `/login?reason=inactive`, which shows a real message ("You were
  signed out after 14 days of inactivity") instead of an unexplained
  bounce. Anonymous visitors never get the cookie at all. Verified
  end-to-end with a real signed-in session: normal continued activity
  never falsely signs out; backdating the cookie to 15 days old
  triggers the sign-out on the very next request; a second request
  afterward confirms the session was actually cleared server-side (lands
  on plain `/login`, not just a one-time redirect) rather than silently
  refreshing forever, which is what happened before this existed.
- Gallery page's sample-deliverable cards (`app/gallery/page.tsx`) were
  a completely separate hardcoded array from `known-trades.ts` — the
  homepage's "Trades we work with" build-time drift check never
  covered this page, exactly how it fell out of sync when IT/Computer
  Support shipped (Gallery still only showed 3 of 4 trades). Added a
  real synthetic IT/Computer Support example card ("Help Desk & Network
  Support," matching the other three's tone/length), extracted the
  drift-check into a shared `assertNoMissingTradeCards()` helper in
  `known-trades.ts` so one mechanism now covers both the homepage and
  Gallery instead of two separate checks, and fixed the same 3→4-card
  grid-orphan layout issue the homepage hit earlier. Verified: real
  screenshot showing all four cards; confirmed the shared check fires
  for *both* pages via a temporary 5th fake trade (both `/` and
  `/gallery` returned real 500s), reverted and confirmed clean 200s;
  real production build succeeds.

## Known Issues / Recently Fixed
- **Admin inbox Board view had horizontal-only scroll, unusable on
  mobile — fixed.** Columns were a fixed `flex` row at every width,
  meaning reaching later-stage columns on a ~380px phone required
  horizontal scrolling. Added a `sm` breakpoint: columns stack full-width
  vertically below `sm`, side-by-side (original layout, unchanged) from
  `sm` up. Verified with real screenshots at 380px (stacked, correct
  Submitted→Closed top-to-bottom order) and 1440px (pixel-identical to
  before), both against the real `submissions` table via a disposable
  test admin account.
- **Admin inbox was a flat list with no way to group by stage or filter/
  sort — fixed with a Board/List toggle.** The reported complaint (the
  same client scattered across multiple non-adjacent rows, no way to
  filter to "Needs attention," no due-date sort) was real — confirmed
  directly against the code before building anything: no Kanban/column
  layout existed anywhere, and the query's only ordering was the fixed
  `is_test ASC, submitted_at ASC` FIFO. Built a new `InboxBoard.tsx`
  client component with a Board view (columns per `submission_stage`,
  active stages shown by default, closed/confirmed reachable via a
  toggle) and the original List view kept as an alternate (Board is now
  the default). Added real filter/sort controls on both views: "Needs
  attention only," "Include test submissions," and a submission-order/
  due-date sort toggle — `is_test` stays the primary sort key in every
  mode, so a test row still can't out-rank a real one just from an
  earlier due date. Verified with a real DB-backed test using a
  disposable test admin account (created and deleted for this test
  specifically, rather than touching the real admin's actual password):
  signed in through the real login form, drove the live UI against the
  real 9-row `submissions` table, confirmed columns show/hide correctly,
  the attention filter narrows 9→4, excluding test rows narrows 9→8, and
  due-date sort reorders correctly with the test row still last. The
  exact reported symptom (River City Janitorial Partners LLC scattered
  across 3 rows) now reads as 3 cards in 3 distinct columns, confirmed
  via screenshot.
- **Intake confirmation page ("We've got it") had no way back to the
  marketing site — third instance of the same navigation-dead-end
  pattern, now fixed.** `app/intake/page.tsx`'s header rendered "BidPulse"
  as a bare `<span>`, not a link — confirmed before fixing, matching the
  report. Audited every other standalone page in the app (not using
  `AppShell` or `MarketingShell`) the same way this bug was found twice
  before: `login` and `reset-password` already link their logo correctly,
  so intake was the only remaining gap. Linked it to `/pricing` (not
  `/`) since this flow creates a real account partway through step 1 —
  a signed-in visitor mid-intake clicking a link to `/` would hit
  `app/page.tsx`'s root-routing redirect and get bounced right back into
  the app, the same reason `AppShell`'s logo fix used `/pricing` instead
  of `/`. Verified in both auth states with a real anonymous context and
  a real signed-in session (disposable test admin) — both correctly land
  on `/pricing`.
- **Intake/Company Profile document upload failing with "Couldn't read
  that document" — fixed, but root cause is inferred, not directly
  reproduced.** Could not reproduce the failure with two synthetic PDF
  fixtures (a bare jsPDF text dump, and a realistic Chromium-rendered
  PDF with real tables/fonts) — both extracted every field correctly
  through the real API and the real browser upload flow on both
  surfaces (Company Profile page and intake wizard). No real fixture
  was actually attached to the brief that reported this despite its
  wording, so the exact failing document was never available to test
  directly. Most probable cause based on strong circumstantial
  evidence: neither `extract-from-document/route.ts` nor
  `extract-company-profile/route.ts` had a `maxDuration` override, so
  both ran on Vercel's default ~10s serverless timeout — and real
  Claude extraction calls were already observed taking 15–25s even for
  tiny test files in this session, so a larger real-world document
  would plausibly get killed mid-request. A killed function returns a
  non-JSON platform error page, which breaks `res.json()` client-side
  and surfaces as exactly this generic message with no indication it
  was a timeout — and this class of failure can't reproduce locally
  (`npm run dev` has no such limit), consistent with nothing failing
  despite thorough local testing. Fixed by adding
  `export const maxDuration = 60;` to both routes, and by hardening
  `CompanyProfileUpload.tsx` to show a distinct message for a non-JSON
  (crashed/timed-out) response instead of folding it into the same
  string as "no readable text" or "no network connection." Saved both
  synthetic fixtures into the repo (`test-fixtures/`, with a README) so
  future verification doesn't need to rebuild them from scratch. This
  is flagged honestly as the most probable cause, not a confirmed one —
  a real deployed Vercel timeout can't be directly tested from local
  dev.
- **Favicon vs. nav/login logo mismatch — decided, no code change.**
  The logo audit (2026-09-01) confirmed every location already uses its
  correctly *intended* asset (no code-level mismatch); the open question
  was purely whether to redesign the favicon to visually match the
  plain heartbeat nav/login mark, or keep its bolder "BP" monogram
  deliberately. Mike's call 2026-09-02: keep it as-is, for small-size
  legibility. Closed.
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
- The Dar Mano Consulting "Computer support for Veterans" submission
  (the one that prompted the IT vertical and trade-coverage safety net
  work) turned out to be test data, not a real client bid — confirmed
  by Mike 2026-09-02. It correctly showed NO VA-system/CUI flags because
  its scope text has no confirmed trigger language (the system declining
  to guess, same as always), but since it isn't a real bid there's
  nothing to manually verify against a real solicitation. Corrected its
  `is_test` flag to `true` (it was `false`, inconsistent with reality —
  would have counted toward real reporting/revenue and competed for
  real queue position otherwise). Verified with a direct before/after
  read of the record.

## Open — Needs Attention
- **Six commits + three migrations sitting local-only, nowhere near
  production (2026-09-03→04 session).** `ed394bc..a83b366` on top of the
  already-pushed `acea384` — none of this is on `origin/main`, let alone
  deployed. Includes: attestation tracking (client attests intake info
  before final submit, and before downloading the packet — new
  `submissions.info_attested_at/by` + `download_attestations` table),
  softened "Verified" → "Document Reviewed" copy everywhere it's client/
  agency-facing, the ambiguous-FK fix described above, logo SVG
  containment + a self-inflicted XML-comment bug (found and fixed same
  session), a real dark-mode elevation bug on the login/reset-password
  cards, and an auth-page logo size increase. Three migrations
  (`certification_verified_requires_document`, `add_attestation_tracking`,
  `close_submissions_broad_client_policy_gap`) are applied to
  `bidpulse-dev` only — **if any of this ships, they need to go to
  production first, in order, or the code will error against missing
  columns/tables exactly like dev did before they existed.**
- **Systemic dark-mode elevation bug, flagged not fixed.**
  `surface-container-lowest` — the token used by every card/modal in the
  app — is *darker* than plain `surface` in dark mode, the opposite of
  "elevated." Fixed narrowly for the login/reset-password cards only
  (`dark:bg-surface-container-lowest dark:bg-surface-container-low`
  override) since that was in scope for a specific brief; every other
  card/modal (e.g. `ConfirmDeleteDialog.tsx`) still has the same
  backwards-in-dark-mode issue. Worth a broader pass someday, not urgent.
- **Contradiction to resolve: client dashboard Preview/Download.** This
  doc's Confirmed Working section claims the `deliverables_ready →
  client_review` auto-trigger was verified with a real client account
  clicking Preview successfully. But a real live check against the
  actual production site (2026-09-02, after this doc was last updated)
  found the opposite: a submission with real deliverables prepared shows
  no Preview/Download UI at all on the client dashboard — just static
  text ("Being prepared."). Leading theory, given this project's history
  of exactly this pattern (the forgot-password confusion earlier today
  was caused by a real fix that was verified but never actually pushed/
  deployed): **the verification here may have been done locally/via a
  disposable test account in dev, or by calling the API route directly,
  without the actual UI component (`PacketButtons.tsx` or equivalent)
  being deployed to production.** Needs a direct check: is the
  commit that mounts Preview/Download on the client dashboard actually
  on `origin/main` and actually live on `bidpulse.co`? Don't take either
  claim (this doc's "verified" or the live observation) as fully
  resolved until that's checked directly.
- **Admin inbox "zero submissions" bug — root cause found, but scope
  turned out narrower than first suspected; production still genuinely
  unverified.** The org_id/RLS theory from 2026-09-02 was directly
  investigated this session (2026-09-03→04) "with a real authenticated
  session, not just service_role" and found **fully healthy** — that
  theory is retracted. The actual bug reproduced in dev was different
  and self-inflicted this same session: a new migration
  (`info_attested_by` on `submissions`) created a *second* foreign key
  from `submissions` to `clients`, which broke PostgREST's ability to
  infer which relationship to use in any query embedding `clients(...)`
  — silently, at request time, with TypeScript catching none of it.
  Found via a temporary server-side `console.log` on the real page
  component after RLS, hydration warnings, browser-extension noise, and
  tunnel caching were each ruled out in turn. Fixed across all 9 affected
  files; audited the whole schema for other 2+-FK pairs (none found).
  Documented in a new `CLAUDE.md` file, read automatically by future
  Claude Code sessions, specifically so this class of bug doesn't
  recur unnoticed.
  **Caveat, stated directly in the handoff doc:** the *original*
  2026-09-02 production report was never re-verified directly against
  `bidpulse-production` — no production credentials were available this
  session. It's reasonable to suspect the same root cause, but that's
  not confirmed. This fix, along with everything else from this session,
  is **not yet on production** — see the unpushed-work note below.
- **Split dev and production Supabase projects — done and verified.** New
  production project (`rixsgnbivayeaxbdseij`) live since 2026-09-02: all
  tracked migrations applied and verified byte-identical to `schema.sql`,
  Vercel's production env vars pointed at it, a real incognito-window test
  confirmed a genuinely empty admin inbox on the live site after redeploy.
  The one real bug this surfaced (file upload) is fixed and verified — see
  Confirmed Working above.
- **Inbound bid email pipeline — code built and verified, blocked on
  Mike's IONOS/Gmail/Apps Script setup before it's actually live.** See
  `scripts/README.md` for the exact steps (forwarding, label/filter, Apps
  Script project + trigger, `INBOUND_BID_EMAIL_SECRET` on Vercel's
  **production** environment specifically). Until that's done, no real
  emails ever reach the route — it just sits ready.
- **`client_reported_submitted_at` column — kept on `submissions`, by
  Mike's explicit call 2026-09-02, even though "I've submitted this"
  (`ReportSubmittedButton.tsx`) itself was removed.** A drop migration was
  written and verified safe (zero rows anywhere ever used the column) but
  paused rather than pushed same-session. Nothing in the app reads or
  writes it anymore either way — purely a schema-tidiness item, not
  blocking anything. Revisit whenever convenient.

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
2. Retainer package usage tracking (how many bids used this month vs. the
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
