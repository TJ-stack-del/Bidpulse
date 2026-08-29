# Open SpecWright — Build Order

Read `MIGRATION-TO-SPECWRIGHT.md` first for the full picture of what's
changing and why. This file is the actual step-by-step build checklist.

**Decisions already made:**
- Manual invoicing for now — no Stripe integration yet, `packages.price_note`
  is just a text field for now
- Clean restart — no old data to preserve, `schema.sql` drops and recreates
  everything

## Step 0 — Reset the database
Run the entire new `schema.sql` in Supabase's SQL Editor. It starts with a
`drop table if exists...` covering the old BidPulse tables, so this is safe
to run even with the old schema still in place.

## Step 1 — Delete the old self-serve pages
These pages assumed contractors do their own work — delete them entirely:
`/bids/new`, `/opportunities`, `/settings/company`, `/bids` (list — gets
rebuilt as the admin inbox), `/intake` (gets rebuilt as the client wizard).

Keep and adapt: `AppShell.tsx`, `LifecycleStepper.tsx` (becomes the 6-stage
pilot timeline), `BidDocuments.tsx` (becomes the file upload in the intake
wizard's "Your bid file" step), `lib/pdf/bid-packet.ts` (becomes the
deliverable generator).

## Step 2 — Auth split
Two very different sign-up paths now:
- **Admin signup** (`/admin/signup` or similar) — creates an `organizations`
  row and a `team_members` row with `role: admin`. This is you/your team,
  rare, maybe just done once by hand in Supabase like before.
- **Client signup** — happens as PART of the intake wizard (step "About
  you"), not as a separate signup page. A client doesn't need to create an
  account before starting — capture their info, then create their
  `auth.users` + `clients` row when they save their first draft or submit.

## Step 3 — Public marketing site
- `/` — home, explains the service plainly
- `/pricing` — one-off / retainer / pilot offer, manual "contact us" or
  "get started" CTA instead of checkout buttons (no Stripe yet)
- `/quiz` — 4-question RFP fit-score quiz
- `/gallery` — capability-statement examples (HVAC, cleaning, IT — use
  clearly-labeled synthetic/redacted examples, never a real client's data)
- `/faq`, `/blog`

## Step 4 — Client intake wizard
Three steps, one flow:
1. **About you** — company name, contact info, NAICS codes, small-business
   statuses, set-asides
2. **About the bid** — agency, solicitation number, due date, scope
3. **Your bid file** — upload the RFP (`BidDocuments`, adapted to
   `submission_documents`)

Support save-draft (`submissions.draft = true`) and a final submit that
locks it (`draft = false`, `submitted_at` set, `stage` moves to `submitted`).
Log every draft-save and the final submit to `audit_log`.

## Step 5 — Client dashboard
Read-only status view: package info, pending-info checklist
(`checklist_items`, but client sees status only — editing is admin-only per
the RLS policies), the 6-stage pilot timeline, and deliverables once
`stage = 'deliverables_ready'` or later.

## Step 6 — Admin operations inbox
- List of all submissions across all clients, filterable by stage and by
  test/waived
- Detail view per submission: full intake info, attached file
  (open/download), stage editor, `admin_notes`, checklist editor
- A clear "confirm submission" action that moves `stage` to
  `confirmed_submitted` and sets a matching `audit_log` entry
- A "create test order" action that creates a submission with `is_test =
  true` for rehearsals — keep these visibly labeled and excluded from any
  future revenue reporting

## Step 7 — Deliverables
Admin-side: prepare capability statement, compliance matrix, technical
narrative per submission (`deliverables` table) — start simple, even just
admin uploading a file or pasting text content counts as "prepared" for now.
Client-side: read-only view once ready.

## Step 8 — Matched opportunities (admin-curated)
Adapt the existing scrapers (`lib/scrapers/*`) to populate
`matched_opportunities` with `assigned_client_id = null`. Build a small
admin screen to review new matches and assign each one to a specific
client (sets `assigned_client_id`) — this is what eventually seeds a new
submission for that client, rather than clients browsing a raw feed
themselves.

## Step 9 — Confirmation emails
Post-submission confirmation, and later, post-payment confirmation once
Stripe is added. Keep this simple for now — even a manual "email sent"
checkbox on the admin side is fine as a placeholder if real email sending
isn't wired up yet.

## Not building yet (explicitly deferred)
- Stripe checkout — manual invoicing for now
- Automated recurring bid matching/shortlist delivery — admin-curated
  matching (Step 8) comes first
- Pilot evidence collection, final pricing — business decisions, not
  build tasks
  