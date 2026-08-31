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
- Contact form (`/contact`, saves to `support_messages` + emails admin)
- Real logo (multiple variants — stacked, horizontal nav, app icon/favicon)

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
- **Tracked follow-up, not yet done:** the `rfp-documents` bucket is still
  marked `public`, so any file's direct URL is fetchable by anyone who
  obtains it, independent of RLS (lower urgency than the fix above — this
  needs someone to already have a specific unguessable UUID-bearing URL).
  Proper fix is a sequenced change, not a quick patch: (1) switch the 3
  upload sites — `app/dashboard/profile/CertificationsSection.tsx`,
  `app/admin/inbox/[id]/DeliverablesPanel.tsx`,
  `components/ui/SubmissionDocuments.tsx` — to store the bare storage path
  instead of a public URL; (2) backfill existing `file_url` rows (parse the
  path out of their current public-URL format) across
  `submission_documents`, `deliverables`, `client_certifications`; (3)
  switch the 3 server pages that select `file_url`
  (`app/admin/inbox/[id]/page.tsx`, `app/dashboard/page.tsx`,
  `app/dashboard/profile/page.tsx`) to call `createSignedUrl()` at render
  time instead of passing through a stored value; (4) only then flip the
  bucket to private. Doing this out of order breaks existing document links
  for active clients mid-flight.

## In Progress / Sent to Claude Code, Not Yet Confirmed Working
- Compliance matrix mandatory/conditional categorization using
  `lib/compliance/requirements-reference.ts` (ALWAYS_MANDATORY,
  CONDITIONAL_REQUIREMENTS, TRADE_SPECIFIC_CERTIFICATIONS)
- Fit-check eligibility/disqualification flag (set-aside restrictions vs.
  client's verified certs) — schema columns added
  (`fit_eligibility_concern`, `fit_eligibility_explanation`)

## Deliberately Deferred (in priority order, decided together)
1. Static "always true" bid-process warnings (Cone of Silence — never contact
   agency staff directly once a solicitation is published; Florida Public
   Records/Sunshine Law — bids become public record, proprietary content must
   be explicitly marked "Exempt/Trade Secret") — low-risk, no AI needed,
   next up once the two in-progress items above are confirmed.
2. Bid-specific variable items needing real detection from bid text:
   prevailing wage requirements, mandatory vs. optional site visits,
   mobilization/NTP timelines, payment-terms cash-flow education.
3. Law enforcement/detention facility category for agency-aware compliance
   (background checks, bloodborne pathogen cert — partially covered now by
   TRADE_SPECIFIC_CERTIFICATIONS, but not fully integrated into the agency
   keyword-detection system alongside airport/school/transit).
4. Dollar-value threshold → lean package (Rate Sheet + Cover + COI only) for
   informal quotes. Default threshold researched: $35,000 (FL Statute 287.017
   Category Two) — but this is the *state* threshold; local bodies (JEA, JAA,
   City of Jacksonville, Duval Schools) may set their own. Needs an
   `estimated_value` field and admin-adjustable threshold setting, neither
   built yet.
5. "Message admin" feature tied to a specific bid (same `support_messages`
   table already supports this via `submission_id` — just needs the UI).
6. Retainer package usage tracking (how many bids used this month vs. the
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
