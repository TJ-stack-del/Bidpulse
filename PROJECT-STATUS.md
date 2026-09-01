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

**Deploy status (2026-09-01):** `origin/main` is at `439b91e`, pushed and
should be live on Vercel. All schema migrations through
`20260831233428_add_estimated_value_and_lean_package_threshold.sql` are
applied to the live Supabase project.

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
  anywhere in the app before this.
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

## Known Issues / Recently Fixed
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

## Deliberately Deferred (in priority order, decided together)
Items #1, #2, and #4 from the original list (static bid-process warnings,
bid-specific wage/site-visit/cash-flow/mobilization detection, and the
dollar-threshold lean package) were completed 2026-09-01 — see Confirmed
Working above. Remaining:
1. Law enforcement/detention facility category for agency-aware compliance
   (background checks, bloodborne pathogen cert — partially covered now by
   TRADE_SPECIFIC_CERTIFICATIONS, but not fully integrated into the agency
   keyword-detection system alongside airport/school/transit).
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

## Working Style Notes (for continuity)
- Always verify fixes with real regenerated output/evidence, not just "done"
- Auto-draft content must never invent specific facts (registration numbers,
  insurance amounts, brand names, statistics) — bracketed placeholders or
  "NEEDS VERIFICATION" only, grounded strictly in real client/bid data
- Mike is not deeply experienced in gov contracting but is actively
  researching it himself and bringing back real domain knowledge to build in
- Solo operator with a day job — features that catch problems automatically
  (digest emails, SLA tracking) are treated as essential, not nice-to-have
