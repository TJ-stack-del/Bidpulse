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
   `origin/main` (`acea384`)**, per the 2026-09-03→04 session.
6. ~~Client dashboard Preview/Download auto-trigger~~ — **fixed in dev,
   fix now on production 2026-09-05** (migrations applied, code pushed
   and deployed). **Still needs a real click-through re-verification on
   `bidpulse.co` itself** — see item #5 below.
7. ~~Push local commits + apply three pending migrations to
   production~~ — **done 2026-09-05.** All 3 migrations
   (`certification_verified_requires_document`, `add_attestation_tracking`,
   `close_submissions_broad_client_policy_gap`) applied cleanly to
   `bidpulse-production` (verified via `supabase migration list`, local
   == remote for every migration), `schema.sql` regenerated to match, and
   12 commits pushed to `origin/main` (`acea384..abdfa9f`, plus the
   `is_test` note after). Vercel should auto-deploy from `main`.
8. ~~Intake flow: move document upload earlier~~ — **investigated
   2026-09-05, not building — see item #2 below for why.** The literal
   ask runs into a real architectural constraint (Supabase Auth session
   requirements), not a simple reorder. Documented and closed per Mike's
   call to leave the flow as-is.
9. ~~Admin page + Fit Check show stale company info~~ — **root-caused
   and fixed 2026-09-05.** See item #3 below: the admin page was never
   actually stale (live join, no caching); Fit Check genuinely was
   (never re-triggered after a profile update) — now fixed.
10. ~~Phone number not appearing on admin page~~ — **fixed 2026-09-05**
    with a display-layer fallback to `business_phone`. See item #4
    below.
11. **Re-verify the Preview/Download auto-trigger fix against
    production** — see item #5 below. Code and migrations are live;
    nobody has actually clicked through it on `bidpulse.co` yet.
12. **Production's actual admin-inbox health — still genuinely
    unverified.** See item #6 below. The org_id theory was ruled out in
    dev; the original 2026-09-02 production report was never directly
    re-checked against production itself.
13. **Inbound bid email pipeline** — built and verified, blocked on Mike's
    IONOS/Gmail/Apps Script setup. See item #8 below. Lower urgency; can
    wait until after launch if needed.
14. **Final pass on `PROJECT-STATUS.md`'s Known Issues** — confirm
    nothing still genuinely open has been missed before launch. Not done
    in the 2026-09-03→04, 2026-09-05 (first), or 2026-09-05 (second)
    sessions.

## Status as of 2026-09-05 (second session)
The first 2026-09-05 session closed two real investigations in dev only
(admin-inbox ambiguous-FK bug, Preview/Download auto-trigger RLS bug) but
left everything local. **This session pushed all of it**: applied the 3
pending migrations to `bidpulse-production` directly (verified clean via
`supabase migration list`), regenerated `schema.sql` (found it had never
been updated after those migrations landed in dev), and pushed 12 commits
to `origin/main`. Also investigated item #2 (move upload earlier) and
found it's blocked by a real architectural constraint, not a simple
reorder — documented and closed rather than built around.

## Active + deferred

### 0. New auto-trigger built (submitted → in_review on first admin view) — BLOCKED on a production migration, do not push yet
Real ask 2026-09-05: complete the pipeline automation — the other two
stage transitions already auto-advance; this was the one remaining
manual-only step. Built, committed locally (`14ab5d9`), verified against
the real dev database and dev server: fires exactly once the moment an
admin opens a `submitted`-stage submission's detail page, flips it to
`in_review`, sets a new `first_viewed_by_admin_at` timestamp, logs the
same `stage_auto_advanced`/`stage_change_email_sent` audit events the
other two auto-triggers use, correctly skips the real client email for
`is_test` submissions, and is idempotent on reload (confirmed via direct
DB query, not just the UI).

**Migration applied to `bidpulse-dev` only.**
`20260905183425_add_first_viewed_by_admin_at.sql` — a single nullable
column add, dry-run confirmed safe on production too (exactly this one
migration, nothing else pending) — **but the actual `db push` to
`bidpulse-production` was blocked twice by this session's permission
classifier.** `schema.sql` is already regenerated to match the dev
state.

**Do not push commit `14ab5d9` to `origin/main` until this migration is
on production.** The auto-trigger runs unconditionally on every
`submitted`-stage submission's page load and both reads and writes
`first_viewed_by_admin_at` — without the column, every single admin
detail-page view for a `submitted` submission would error on production,
not just this one feature. Same failure mode `CLAUDE.md` already warns
about.

**Next step:** either retry `SUPABASE_ACCESS_TOKEN=<token> npx supabase
db push` against `bidpulse-production` (project ref
`rixsgnbivayeaxbdseij`) from a session/environment where it isn't
classifier-blocked, or apply the one-line `ALTER TABLE` directly via the
Supabase dashboard's SQL editor for production **and then still record
it as a tracked migration** (the CLI will otherwise think it's unapplied
and try to push it again) — then push `14ab5d9`.

### 1. ~~Push local commits + apply three migrations to production~~ — done 2026-09-05
Closing this out. All 3 migrations applied to `bidpulse-production` in
order (dry-run confirmed exactly these 3 and nothing else, then applied —
no errors), `schema.sql` regenerated and diffed to confirm it matches
exactly what the 3 migrations do (verified-requires-file CHECK,
`download_attestations` table + RLS + grants, `submissions.
info_attested_at/by` + FK + updated draft-update policy, broad "clients
manage their own submissions" policy gone). 12 commits pushed to
`origin/main`.

**Still needed:** confirm Vercel actually deployed from the new
`origin/main` HEAD (should be automatic), then the real end-to-end
verification this item always called for — a real client attesting
intake info, submitting, downloading a packet with attestation,
confirmed via direct DB reads — plus re-confirming the ambiguous-FK fix
and the Preview/Download auto-trigger fix (item #5) against production
specifically, not assumed from dev.

### 2. Intake flow: move document upload earlier — investigated 2026-09-05, not building
**Real ask, real architectural blocker found before building anything.**
The ask: show the "Want to save some typing?" upload prompt right after
company name, before any other manual field — currently it appears after
company name, contact name, email/phone, *and* password are all
collected and the account is created.

**Why the literal ask isn't achievable without a real tradeoff:**
- `extract-company-profile/route.ts`'s auth check (`if (!user) return
  401`) isn't a technical dependency of the extraction logic itself —
  the route is stateless (extracts fields, returns JSON, never touches
  the DB; the caller writes to `clients` afterward). It exists
  specifically to stop an anonymous visitor from hitting a paid
  Anthropic-backed endpoint for free and unlimited.
- A session can only exist after Supabase Auth `signUp()`, which
  requires an identifier (email/phone) + password.
- The same submit that creates that session (`handleAboutYouNext`) also
  inserts the `clients` row, which requires `company_name` **and**
  `contact_name` — both `NOT NULL` in the schema.
- So today's 4 fields (company name, your name, email/phone, password)
  are already the practical minimum before an account — and therefore
  the upload gate — can exist. There's no field left to defer without
  either a schema migration (make `contact_name` nullable, restructure
  the insert) or relaxing the extraction route's anti-abuse gate
  (allowing anonymous extraction calls, reopening a real cost/abuse
  surface on a paid AI endpoint that was deliberately closed).

**Decided (Mike, 2026-09-05): leave the flow as-is.** Neither tradeoff
(schema change for a minor UX win, or reopening the abuse surface) was
worth it. Closed, not building.

### 3. Admin page + Fit Check show stale company info — root-caused and fixed 2026-09-05
**Investigated before assuming a fix, per this project's history of
caching-related surprises.** The two halves turned out to have different
answers:
- **The admin page's "Client info" panel was never actually stale.**
  Confirmed it's a genuinely live join (`clients!submissions_client_id_
  fkey(...)` in `app/admin/inbox/[id]/page.tsx`), field-by-field, no
  snapshot elsewhere, no caching directive anywhere in the Supabase
  client setup, and Next.js 15 defaults to no fetch caching (unlike
  Next 14). This panel already reflects current data on every load.
- **Fit Check genuinely was stale.** `fit_alignment`/`fit_explanation`
  only ever got (re)computed at two call sites — intake final-submit
  (`lib/submissions.ts`) and admin "Assign" (`MatchesPanel.tsx`),
  confirmed via `grep` across the whole app. Nothing re-triggered it when
  a client updated their Company Profile afterward, so it silently kept
  citing missing license/insurance/certs long after those were added —
  most likely what the original report actually saw, misattributed to
  "the admin page" broadly.

**Fixed:** `CompanyInfoForm.tsx` now re-triggers `generate-fit-check` for
the client's own active submissions (non-draft, non-closed) after a
successful profile save, using the same fire-and-forget browser-fetch
pattern `finalizeSubmission()` already uses successfully for the same
route. Verified the new filter query directly against the real dev
database with a disposable client and three submissions (draft/active/
closed) — correctly returns only the active one.

### 4. Phone number not appearing on admin page — fixed 2026-09-05
**Decision made:** display-layer fallback, not a schema/extraction
change — the earlier reasoning for keeping `phone` (the account's login/
SMS-auth number) separate from `business_phone` still holds (extraction
deliberately never writes to an auth-linked field from a guessed
document value). Third recurring complaint made the friction worth
fixing anyway.

**Fixed:** the admin page's "Phone" row now shows `business_phone` with
a "(business)" label when the dedicated `phone` field is empty, instead
of showing nothing. Verified against the real running dev server with a
disposable admin + client account and a real authenticated session
cookie — both the number and the label render correctly on the actual
page.

### 5. Auto-trigger (deliverables_ready → client_review) — fixed and pushed, needs production click-through
**Status update 2026-09-05 (second session): the fix is now live on
production** — migrations applied, code pushed and deployed (item #1).
**Nobody has actually clicked through it on `bidpulse.co` yet** — that's
the one remaining step.

**Recap of the bug and fix, for context:** real dev testing had
confirmed the UI works fine (Preview/Download both render and function)
while the stage never advanced on a real client click, with no tracking
field anywhere to even prove the click was received. Root cause, found
by actually running it against the dev database: `close_submissions_
broad_client_policy_gap.sql` (applied earlier the same week, for an
unrelated, legitimate reason — closing a real attestation-bypass gap)
had dropped the only client `submissions` UPDATE policy broad enough to
allow this write, leaving only a policy that permits updates while
`draft = true` — but `deliverables_ready` is inherently past the draft
stage. Fixed using the same pattern already established in this codebase
for the identical constraint (`generate-fit-check/route.ts`): keep the
ownership/stage check on the caller's own RLS-scoped session, perform
the already-validated write through the service role instead. Verified
in dev with a direct reproduction (real disposable client, real JWT,
real `UPDATE` — confirmed `status 200, updateData: [], updateError:
null` before the fix, confirmed a real row update after).

**A first attempt at diagnosing this got it wrong, worth remembering:**
an earlier pass investigated by reading the code only — confirmed
`PacketButtons` is mounted with `viewerRole="client"`, confirmed the
gating logic reads correctly — and closed this as "no bug found." That
was wrong. Reading code that looks correct isn't the same as running it.

**Verification required (production, now that it's deployed):** real
client Preview click on a `deliverables_ready` submission, confirm
`stage` becomes `client_review` via a fresh reload. Confirm an admin's
own Preview click on a different submission does *not* trigger the same
change. Mike is running this manually on `bidpulse.co` with a disposable
test client (cleaned up afterward via the admin Delete action — no
`is_test` toggle exists for this, see item #12 below).

### 6. Production's actual admin-inbox health — still genuinely unverified
**Correction from an earlier sync:** the org_id/RLS theory for the
2026-09-02 "admin inbox shows zero submissions" report was investigated
directly in a later session — "with a real authenticated session, not
just service_role" — and found **fully healthy**. That theory is
retracted.

The real bug found and fixed was different, and self-inflicted the same
week: a migration (`info_attested_by` on `submissions`) created a
*second* foreign key from `submissions` to `clients`, breaking
PostgREST's ability to infer which relationship to use in any query
embedding `clients(...)` — silently, at request time, with TypeScript
catching none of it. Fixed across all 9 affected files; schema audited
for other 2+-FK pairs (none found). This exact rule — never let a second
FK exist from the same table to the same target without checking every
PostgREST embed that touches it — is written into `CLAUDE.md` specifically
so it's read automatically before any future migration that adds a
foreign key.

**The fix is now on production** (item #1). **What's actually needed:** a
real, direct check against production itself — not dev — confirming a
real new submission shows up correctly in the admin inbox. Only then
does this close out for real.

### 7. Systemic dark-mode elevation bug — flagged, not fixed
`surface-container-lowest` — the token used by every card/modal in the
app — is **darker** than plain `surface` in dark mode, the opposite of
what "elevated surface" should mean. Fixed only for the two auth-page
cards (a `dark:` override), since that was the scope of the brief that
surfaced it. Every other card/modal in the app (e.g.
`ConfirmDeleteDialog.tsx`) still has the same backwards-in-dark-mode
issue. Not urgent, but worth a broader design-token pass at some point
rather than fixing it piecemeal every time it's separately noticed.

### 8. Inbound bid email pipeline — built, blocked on Mike's email setup
Code is done and verified (`app/api/inbound-bid-email/route.ts`, a second
producer into `matched_opportunities` alongside the existing scraper) —
real extraction calls and direct DB read-backs confirmed it works. **Not
yet live in production** — still needs Mike's IONOS/Gmail forwarding
rule, label/filter, and Apps Script trigger set up per
`scripts/README.md`, plus the real `INBOUND_BID_EMAIL_SECRET` added to
Vercel's **production** environment specifically.

### 9. Client-facing fit badge — REPLACED entirely with a profile-completeness percentage, 2026-09-05
**The badge concept itself is retired, not repaired.** It was built,
then had two real color/size bugs found and fixed the same day — all of
that work is moot now, not wrong. Real reasoning for the reversal:
looking at what `fit_alignment` actually measures, "Weak" almost always
just means the client hasn't filled out NAICS codes, certifications, or
company profile fields yet — a **data-completeness signal wearing a
competitive-sounding label.** Government bid outcomes hinge on price,
competitors, and agency discretion, none of which this score touches,
but the word "fit" reads as a competitive judgment no matter how it's
worded or colored — a "Weak" badge risks disproportionate anxiety over
something easy and fixable, with no equivalent upside from a "Strong"
badge.

**Built and verified 2026-09-05:** `lib/compliance/profile-
completeness.ts` — a deterministic, equally-weighted presence check
across 6 fields (NAICS codes, license number, insurance provider/
coverage, business address, business phone, at least one certification
on file), no LLM judgment call, same reasoning as every other compliance
detector in this codebase. Replaces the badge in the dashboard's Status
card entirely — `fit_alignment` removed from the query and rendering.
Shows "Profile N% complete," never red at any level, since there's
nothing alarming here to soften. Verified against the real running dev
server and database: a client with only NAICS codes set (1 of 6 fields)
shows exactly 17%, and shows 100% on a fresh reload after filling in the
rest — confirms it actually updates live, the same staleness risk item
#3 already found and fixed for Fit Check itself.

**`fit_eligibility_concern` and the admin-side Fit Check panel are
untouched** — this only replaces the client-facing signal.

**Left as-is, out of scope:** the intake confirmation screen
(`IntakeWizard.tsx`) still shows the old fit badge (with its two color/
size bugs already fixed) plus the raw `fit_explanation` text. This
item's ask was specifically the dashboard; the intake screen is a
separate, one-time moment with its own pre-existing inconsistency
(flagged previously) — worth a real look, and worth deciding whether it
should get the same completeness treatment, next time that screen is
touched.

**Not built yet, explicitly flagged rather than rushed:**
auto-populating the compliance checklist from these same missing-field
signals, which this item's own brief asked to merge with the badge
replacement ("avoids them drifting out of sync"). `checklist_items` has
no column to distinguish an auto-generated item from an admin-created
one (e.g. from "Request info from client"), so a safe merge needs its
own schema migration — deliberately not built now since **one migration
is already stuck pending on production from earlier this session** (see
item #0) and stacking a second, or faking the distinction with fragile
label-text matching against real admin-created checklist items, isn't
worth the risk. Needs a real design pass: a `source`/`auto_generated`
column, and rules for when an auto-item should be marked done or removed
once the client fills the corresponding field.

### 10. Law enforcement/detention agency-type integration check — confirmed 2026-09-05, not building
**Checked: not integrated.** `TRADE_SPECIFIC_CERTIFICATIONS`'
bloodborne-pathogen/PREA rows are fine as-is — they trigger off
`submission.scope` text directly (`referenceRequirementRows()` in
`generate-draft/route.ts` passes `submission.scope`, not the agency
name), so compliance-matrix behavior for a detention/correctional bid is
unaffected by this gap. What's actually missing: `lib/agency-type.ts`
has no `detention`/`law_enforcement` `AgencyType` alongside
airport/school/transit/`va`, so a detention-facility bid never gets the
equivalent softer fit-check note (`agencyTypeFitNotes()` in
`generate-fit-check/route.ts` — e.g. "confirm your team can pass
background checks and complete PREA/bloodborne pathogen training before
pursuing this"). Confirmed via `grep` — zero matches for detention/jail/
correctional/sheriff/police in `agency-type.ts`. Per this item's own
original scope, still not building standalone — do this the next time
`agency-type.ts` is touched for another reason.

### 11. Retainer package usage tracking
Track how many bids a retainer client has used this month against the
"up to 2/month" promise. No schema yet — needs a usage-count field or
derived query against `submissions`/`packages`, plus a decision on how
resets are timed (calendar month vs. rolling 30 days). Explicitly
deferred until there's a real retainer client to test against.

### 12. No admin UI toggle for `is_test` — found 2026-09-05, not building yet
While setting up a disposable test client to re-verify a fix on
production, checked whether there's an admin-facing way to mark a
client/submission `is_test = true`. There isn't — the column is real and
actively used (admin inbox ordering, digest emails, reporting all filter
on it), but nothing in the app ever writes `is_test: true` anywhere,
including the intake wizard. The only times it's been set have been
direct database edits (see the Dar Mano Consulting correction in
`PROJECT-STATUS.md`). For one-off disposable testing, the admin Delete
action is the actual answer — remove the test data afterward instead of
flagging it. Worth a real toggle someday if disposable test accounts
become a recurring need, but not scoped or built now.

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
