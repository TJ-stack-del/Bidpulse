# BidPulse — Build Order

Read `PROJECT-STATUS.md` first for full context, evidence, and history.
This file tracks what's actually queued to work on next.

## 🚀 Pre-launch checklist — do these before client #1
1. ~~Dev/prod Supabase split~~ — **done and verified 2026-09-02.**
2. ~~File upload on the new production project~~ — **done and verified
   2026-09-02.**
3. ~~"Message admin" UI~~ — **done and verified 2026-09-02.**
4. ~~Admin delete action~~ — **done and verified 2026-09-02.**
5. ~~"Request info from client" voice/duplication fix~~ and
   ~~certifications optional upload~~ — **both done and pushed to
   `origin/main` (`acea384`)**.
6. ~~Client dashboard Preview/Download auto-trigger~~ — **CLOSED, fully
   verified on production** (real HTTP POST, real stage change, real
   negative case with an admin session correctly rejected).
7. ~~Push local commits + apply pending migrations to production~~ —
   **done.** 12 commits pushed to `origin/main` (`acea384..abdfa9f`,
   plus the `is_test`-toggle finding below), all migrations applied and
   verified via `supabase migration list` (local == remote), `schema.sql`
   regenerated to match. Vercel auto-deploy from Git confirmed genuinely
   working (a harmless test commit produced an automatic deployment,
   no manual `vercel --prod` needed).
8. ~~submitted → in_review auto-trigger~~ — **CLOSED, fully verified on
   production.** Built, migration applied to production, commit pushed
   — both independently confirmed via direct checks (production column
   exists, commit is on `origin/main`).
9. ~~Intake flow: move document upload earlier~~ — **investigated, not
   building.** Real architectural constraint found (see item #2 below),
   not a simple reorder. Mike's call to leave the flow as-is.
10. ~~Admin page + Fit Check show stale company info~~ — **root-caused
    and fixed.** See item #3 below.
11. ~~Phone number not appearing on admin page~~ — **fixed** with a
    display-layer fallback. See item #4 below.
12. ~~Production's actual admin-inbox health~~ — **CLOSED, fully
    verified on production** (a genuinely new client + submission
    appeared correctly on first load, no cache, no manual refresh).
13. **Inbound bid email pipeline** — built and verified, blocked on
    Mike's IONOS/Gmail/Apps Script setup. See item #6 below. Lower
    urgency; can wait until after launch if needed.
14. **Final pass on `PROJECT-STATUS.md`'s Known Issues** — confirm
    nothing still genuinely open has been missed before launch. Not done
    in any session so far.

## Status as of 2026-09-05 (reconciled across two same-day sessions)
The first 2026-09-05 session closed two real investigations in dev only
(admin-inbox ambiguous-FK bug, Preview/Download auto-trigger RLS bug)
but left everything local. A second same-day session pushed all of it:
applied the pending migrations to `bidpulse-production` directly
(verified clean via `supabase migration list`), regenerated `schema.sql`
(it had never been updated after those migrations landed in dev), and
pushed 12 commits to `origin/main`. A third round of direct verification
(real HTTP requests against `bidpulse.co`, real DB reads) confirmed
every pipeline automation and the admin-inbox fix genuinely work on
production, not just in dev — see `PROJECT-STATUS.md`'s Confirmed
Working section for the actual evidence.

Also closed this same day: the intake-upload-reorder investigation
(real architectural constraint found, decided not to build), the
stale-data investigation (admin page was never actually stale; Fit
Check genuinely was, now fixed), and the phone-number display fix.

A `CLAUDE.md` file exists specifically to carry forward hard-won lessons
(the FK-ambiguity rule chief among them) into every future Claude Code
session automatically.

## Active + deferred

### 1. Split dev and production Supabase projects — CLOSED
Fully closed and verified 2026-09-02. See `PROJECT-STATUS.md` for the
complete troubleshooting history (env var type/naming issues, the
stale-deployment build-time gotcha, Auth URL config, OTP-signup
behavior, and the later-corrected Git-integration finding).

### 2. Intake flow: move document upload earlier — investigated, not building
**Real ask, real architectural blocker found before building anything.**
The ask: show the "Want to save some typing?" upload prompt right after
company name, before any other manual field — currently it appears
after company name, contact name, email/phone, *and* password are all
collected and the account is created.

**Why the literal ask isn't achievable without a real tradeoff:**
- `extract-company-profile/route.ts`'s auth check (`if (!user) return
  401`) isn't a technical dependency of the extraction logic itself —
  the route is stateless. It exists specifically to stop an anonymous
  visitor from hitting a paid Anthropic-backed endpoint for free and
  unlimited.
- A session can only exist after Supabase Auth `signUp()`, which
  requires an identifier (email/phone) + password.
- The same submit that creates that session also inserts the `clients`
  row, which requires `company_name` **and** `contact_name` — both
  `NOT NULL` in the schema.
- So today's 4 fields (company name, your name, email/phone, password)
  are already the practical minimum before an account — and therefore
  the upload gate — can exist. There's no field left to defer without
  either a schema migration (make `contact_name` nullable, restructure
  the insert) or relaxing the extraction route's anti-abuse gate
  (allowing anonymous extraction calls, reopening a real cost/abuse
  surface on a paid AI endpoint that was deliberately closed).

**Decided (Mike): leave the flow as-is.** Neither tradeoff (schema
change for a minor UX win, or reopening the abuse surface) was worth it.
Closed, not building.

### 3. Admin page + Fit Check show stale company info — root-caused and fixed
**Investigated before assuming a fix, per this project's history of
caching-related surprises.** The two halves turned out to have different
answers:
- **The admin page's "Client info" panel was never actually stale.**
  Confirmed it's a genuinely live join
  (`clients!submissions_client_id_fkey(...)` in
  `app/admin/inbox/[id]/page.tsx`), field-by-field, no snapshot
  elsewhere, no caching directive anywhere in the Supabase client setup,
  and Next.js 15 defaults to no fetch caching (unlike Next 14). This
  panel already reflects current data on every load.
- **Fit Check genuinely was stale.** `fit_alignment`/`fit_explanation`
  only ever got (re)computed at two call sites — intake final-submit
  and admin "Assign" — confirmed via `grep` across the whole app.
  Nothing re-triggered it when a client updated their Company Profile
  afterward, so it silently kept citing missing license/insurance/certs
  long after those were added — most likely what the original report
  actually saw, misattributed to "the admin page" broadly.

**Fixed:** `CompanyInfoForm.tsx` now re-triggers `generate-fit-check`
for the client's own active submissions (non-draft, non-closed) after a
successful profile save, using the same fire-and-forget browser-fetch
pattern `finalizeSubmission()` already uses successfully. Verified the
new filter query directly against the real dev database with a
disposable client and three submissions (draft/active/closed) —
correctly returns only the active one.

### 4. Phone number not appearing on admin page — fixed
**Decision made:** display-layer fallback, not a schema/extraction
change — the earlier reasoning for keeping `phone` (the account's
login/SMS-auth number) separate from `business_phone` still holds
(extraction deliberately never writes to an auth-linked field from a
guessed document value). Third recurring complaint made the friction
worth fixing anyway.

**Fixed:** the admin page's "Phone" row now shows `business_phone` with
a "(business)" label when the dedicated `phone` field is empty, instead
of showing nothing. Verified against the real running dev server with a
disposable admin + client account and a real authenticated session
cookie — both the number and the label render correctly on the actual
page.

### 5. New feature: extract bid fields from an uploaded RFP document
Real ask 2026-09-05, confirmed in scope — a genuinely new extraction
capability, not just a UI reorder. Currently, step 2 ("About the bid")
requires manually typing agency, solicitation number, due date, and
scope; step 3 ("Your bid file") only stores the raw uploaded RFP with no
extraction at all. This adds real auto-fill from the RFP itself,
mirroring the existing company-document extraction pattern — same
"never invent, return null if not actually found" discipline already
used elsewhere.

**Real technical risk, worth taking seriously before building:** real
RFP/solicitation documents are nothing like the short specimen documents
used for company-profile extraction (a page or two). A real solicitation
can run 30+ pages and often lists **multiple dates** — site-visit date,
Q&A/question-submission deadline, pre-bid conference date, and the
actual final bid-submission due date. The extraction must correctly
identify the real submission due date specifically, not just the first
date-like string encountered — a wrong-date extraction here is a
genuinely serious failure mode (a client could miss a real deadline).
Solicitation number and agency name are comparatively low-risk
(typically clear on a cover page); due date is the one to scrutinize
hardest.

**Also worth deciding:** what "scope" should actually contain — a
faithful excerpt/summary of the real Scope of Work / Statement of Work
section (common section header patterns to look for: "SCOPE OF WORK,"
"STATEMENT OF WORK," "SECTION 1"), not an invented paraphrase, and left
null with a prompt for manual entry if no clear section can be
confidently found — never guessed.

**UX presentation — recommend mirroring the same upload-first pattern
already decided for company info, but this is an assumption, not a
locked decision:** confirm before building.

**Verification required:** test against a **real, actual solicitation
document** (e.g. one of the real JAA/JEA/City of Jacksonville RFPs
already referenced in this project), not just the short synthetic
specimens used for company-profile testing — document length and
structure are a real, distinct risk factor here. Specifically confirm:
the correct due date is extracted when multiple dates are present in
the source document, scope is either a real faithful excerpt or
correctly left null (never invented), and solicitation number/agency
name are captured correctly.

### 6. Inbound bid email pipeline — built, blocked on Mike's email setup
Code is done and verified (`app/api/inbound-bid-email/route.ts`, a second
producer into `matched_opportunities` alongside the existing scraper) —
real extraction calls and direct DB read-backs confirmed it works. **Not
yet live in production** — still needs Mike's IONOS/Gmail forwarding
rule, label/filter, and Apps Script trigger set up per
`scripts/README.md`, plus the real `INBOUND_BID_EMAIL_SECRET` added to
Vercel's **production** environment specifically.

### 7. Client-facing profile-completeness indicator — dashboard done, intake screen still open
**Built and verified on the dashboard:** `lib/compliance/profile-
completeness.ts` — a deterministic, equally-weighted presence check
across 6 fields (NAICS codes, license number, insurance provider/
coverage, business address, business phone, at least one certification
on file), no LLM judgment call. Replaces the old fit badge in the
dashboard's Status card entirely — `fit_alignment` removed from that
query and rendering. Shows "Profile N% complete," never red at any
level, since there's nothing alarming left to soften. Verified against
the real dev server and database: a client with only 1 of 6 fields set
shows exactly 17%, and shows 100% on a fresh reload after filling in the
rest — confirms it actually updates live, the same staleness risk item
#3 already found and fixed for Fit Check itself.

**`fit_eligibility_concern` and the admin-side Fit Check panel are
untouched** — this only ever replaced the client-facing dashboard
signal.

**Still genuinely open: the intake confirmation screen
(`IntakeWizard.tsx`) was explicitly left out of scope, and real
screenshot evidence since then confirms it still shows the old badge
plus the raw `fit_explanation` text** — the same third-person voice
problem caught elsewhere, and worse here since it's the full paragraph,
not just a label, on the very first screen a client sees after
submitting. This needs the same completeness treatment as the
dashboard, applied to this second location. **Real codebase search
required first** (grep for `fit_alignment`, `fit_explanation`,
`fit_eligibility` across every client-facing component) to confirm
there isn't a third location neither of us has spotted yet.

**Separately, also flagged on this same screen:** it doesn't adapt to
desktop width — sits in a narrow, fixed-width column with large unused
margins even on a clearly desktop-width viewport, reading like a
mobile-width container that never picked up a proper desktop layout.
Worth checking a few other post-action confirmation screens for the
same issue while this one's being fixed, rather than finding it
elsewhere later.

**Not built yet, deliberately, real reason:** auto-populating the
compliance checklist from these same missing-field signals — this
item's own earlier brief asked to merge with the badge replacement to
avoid drift. `checklist_items` has no column to distinguish an
auto-generated item from an admin-created one, so a safe merge needs its
own schema migration — deliberately not built alongside this session's
already-pending migration, to avoid stacking a second one during a
session with real migration-permission friction. Needs a real design
pass: a `source`/`auto_generated` column, and rules for when an
auto-item should be marked done or removed once the client fills the
corresponding field.

**Verification required:** first, the codebase-wide search above. Then:
a client with a mostly-empty profile shows a low completeness number and
a populated checklist of what's missing on **both** the intake
confirmation page and the dashboard; after filling in several fields,
both update on a fresh reload, in both locations. Also verify the
desktop-width fix with real screenshots at a genuine desktop viewport,
confirming mobile still looks correct afterward.

### 8. Law enforcement/detention agency-type integration check — confirmed narrow, not building standalone
**Checked directly, not assumed.** `TRADE_SPECIFIC_CERTIFICATIONS`'
bloodborne-pathogen/PREA rows are fine as-is — they trigger off
`submission.scope` text directly, not agency name, so compliance-matrix
behavior for a detention/correctional bid is already correct and
unaffected by this gap. **What's actually missing:**
`lib/agency-type.ts` has no `detention`/`law_enforcement` `AgencyType`
alongside airport/school/transit/`va`, so a detention-facility bid
never gets the equivalent softer fit-check note (e.g. "confirm your
team can pass background checks and complete PREA/bloodborne pathogen
training before pursuing this"). Confirmed via `grep` — zero matches for
detention/jail/correctional/sheriff/police in `agency-type.ts`. Still
not building standalone, per this item's original scope — do this the
next time `agency-type.ts` is touched for another reason.

### 9. Retainer package usage tracking
Track how many bids a retainer client has used this month against the
"up to 2/month" promise. No schema yet — needs a usage-count field or
derived query against `submissions`/`packages`, plus a decision on how
resets are timed (calendar month vs. rolling 30 days). Explicitly
deferred until there's a real retainer client to test against.

### 10. No admin UI toggle for `is_test` — found, not building yet
**Real, genuinely new finding.** While setting up a disposable test
client to verify a production fix, checked whether there's any
admin-facing way to mark a client/submission `is_test = true`. There
isn't — the column is real and actively used throughout the app (admin
inbox ordering, digest emails, reporting all filter on it), but
**nothing in the app ever writes `is_test: true` anywhere, including the
intake wizard.** The only times it's ever been set have been direct
database edits (see the Dar Mano Consulting correction in
`PROJECT-STATUS.md`). For one-off disposable testing, the admin Delete
action is the actual working answer — remove the test data afterward
instead of flagging it. Worth a real toggle someday if disposable test
accounts become a recurring need, but not scoped or built now.

## Process / Infrastructure Recommendations
These aren't things a client would ever notice missing — they're
structural gaps that make the *next* version of problems already seen
recur less likely.

### A. CI safety net — done
`.github/workflows/ci.yml` added: type check + build on every push to
`main` and every PR, using dev-project secrets only. **Still needs Mike**
to add the listed secrets under repo Settings → Secrets and variables →
Actions before it actually runs.

### B. Regression-test script — done, three real bugs found and fixed before committing
`scripts/regression-check.mjs` added — not just copy-pasted. Ran it
before committing and it failed, for real reasons, not flakiness:
- Test 1 used a bare `clients(...)` embed — permanently ambiguous now
  that `info_attested_by` is a real second FK by design (the actual fix
  was disambiguating every real call site, not preventing the second FK
  from existing).
- Test 2 attempted a raw client-session `UPDATE` directly, which the
  real fix deliberately makes fail forever (the fix moved the write
  server-side through the service role, keeping client RLS restrictive
  on purpose).
- A third, separate bug: a silent session-propagation issue — plain
  `signInWithPassword()` on a bare Node client doesn't reliably attach
  the session to later queries with no browser storage to persist it
  from.
All three rewritten to test the real fixed mechanisms and fixed
propagation pattern. **Verified against the real dev database — all
tests genuinely pass now**, and separately re-run against production's
own database with the same result.

### C. Consolidate admin communication surfaces — done and verified
`RequestInfoForm.tsx` now shows a picker of the submission's open
checklist items (plus "Other" for anything not tracked yet); selecting
one pre-fills a second-person request built from that item's own label,
sends the notification tied to it, and marks it `in_progress` instead of
creating a duplicate row. "Other" still creates a new checklist item
exactly as before. Verified against the real dev server and database:
the existing-item path updates in place, the "Other" path still creates
a genuinely new row.

### D. Golden-set regression check for the "never invent facts" guarantee — not built, needs real design time
Deliberately not rushed. LLM outputs are non-deterministic, so a literal
diff-against-expected-text script would be fragile and fail on harmless
wording variation, not just genuine fabrication. A correct version needs
to check *structural* presence/absence (does an expected fact appear,
does an expected null/placeholder stay a placeholder, does anything
appear that wasn't in the source input) rather than exact-text matching
— a real script-design decision, plus real API cost to run repeatedly.
Existing fixtures in `test-fixtures/` (Sunrise Janitorial Solutions,
Coastal Clean) are a reasonable starting point rather than building new
ones from scratch. Next concrete step, not done yet.

### E. Backup/disaster-recovery plan — Mike's own check, not a code task
Log into the Supabase dashboard for `bidpulse-production` → Settings →
Add-ons or Database → Backups, confirm what's actually available on the
current plan tier, decide whether to upgrade given real client data now
exists. If manual-only, the free DIY option (a scheduled GitHub Action
running `supabase db dump`, storing the result in a private repo)
remains available and doesn't require a plan upgrade — nothing to build
until Mike decides which path to take.

### F. Rate limiting on public, cost-incurring routes — premise checked, doesn't hold
**Investigated before building.** Checked every route in `app/api` that
instantiates the Anthropic client: `extract-from-document` and
`extract-company-profile` both already require a real authenticated
Supabase session (401 if absent); `inbound-bid-email` already requires a
shared-secret header. **There is no genuinely public, unauthenticated,
cost-incurring AI route in this codebase right now.** Not zero risk — a
real signed-up account could still hammer an extraction endpoint — but a
materially different, lower-priority shape of problem than anonymous
public abuse. The right future defense, if abuse ever appears, is
per-account/per-`client_id` limiting using the auth context these routes
already have, not IP-based limiting. Not built now.

### G. Error monitoring and alerting — needs Mike to create an account first
Sign up for Sentry (or similar), get a DSN key, hand it to a future
session to wire in `@sentry/nextjs`. Can't proceed without the DSN — not
a code task until then.

## Admin Review Bottleneck — Mitigations

### 1. Reduce what needs review by improving inputs — already underway
Not new work — the profile-completeness indicator (item #7) and the
phone-number fix (item #4) already reduce how many bracketed
placeholders/gaps a draft needs, directly reducing review time.

### 2. Structured review checklist — done
`Admin-Review-Rubric.md` added to the repo — a concrete per-deliverable-
type checklist replacing freeform "read the whole thing carefully"
review. Process document, ready to use immediately, no code involved.

### 3. Batch similar review work
Process habit, not a code task — no artifact needed.

### 4. Surface mechanical checks before full review — done and verified
`lib/compliance/preflight-summary.ts`: three deterministic checks
(deliverable content present, certification verified/unverified counts,
leftover bracketed placeholders in deliverable content), rendered as
status chips at the top of the admin submission detail page. Verified
against the real dev server and database across both an incomplete
state (1/3 deliverables, unverified cert, active placeholder) and a
fully-complete state — all three checks correctly flip.

### 5. Pricing as a deliberate throttle — Mike's decision
Business decision, not implementable.

### 6. Hire a part-time first-pass reviewer — Mike's decision
Business/hiring decision, not implementable now.

## Not building yet (still explicitly deferred)
- Stripe checkout — manual invoicing continues
- Automated recurring bid matching/shortlist delivery — admin-curated
  matching (assign flow) stays as-is
- Any further logo/branding work beyond what's already shipped — paused
  pending the BidPulse trademark question (see `PROJECT-STATUS.md`'s
  Business/Naming Note)
- Intake flow document-upload reorder (item #2) — real architectural
  constraint found, not worth the schema-change or security tradeoff
  required to fully honor the original ask.
- Golden-set regression fixture (item D above) — needs real script-design
  time given LLM output non-determinism, not a quick add.
- IP-based rate limiting (item F above) — premise doesn't hold; the
  routes in question already require auth. Revisit as per-account
  limiting if real abuse ever appears.
- Compliance checklist auto-population from Fit Check/completeness
  signals — needs its own schema migration (a `source` column on
  `checklist_items`), deliberately not stacked behind other pending
  migrations this session.
- Admin UI toggle for `is_test` — the admin Delete action already
  covers the real disposable-testing need; revisit only if that stops
  being sufficient.
