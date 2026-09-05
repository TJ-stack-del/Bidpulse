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
6. **Push six local-only commits + apply three pending migrations to
   production, in order.** See item #1 below. This is the single most
   urgent action right now — everything from the 2026-09-03→04 session
   (attestation tracking, the ambiguous-FK admin-inbox fix, logo/dark-mode
   fixes) is sitting local-only, nowhere near production.
7. ~~Client-side auto-trigger doesn't fire~~ — **real RLS bug found and
   fixed 2026-09-05** (an earlier same-day pass wrongly closed this as
   "no bug found" from static reading alone — corrected). See item #2
   below.
8. **Production's actual admin-inbox health — still genuinely
   unverified.** See item #3 below. The org_id theory was ruled out in
   dev; the original 2026-09-02 production report was never directly
   re-checked against production itself.
9. **Inbound bid email pipeline** — built and verified, blocked on Mike's
   IONOS/Gmail/Apps Script setup. See item #4 below. Lower urgency; can
   wait until after launch if needed.
10. **Final pass on `PROJECT-STATUS.md`'s Known Issues** — confirm
    nothing still genuinely open has been missed before launch. Explicitly
    not done in the 2026-09-03→04 session either.

## Status as of 2026-09-04
A long session (2026-09-03→04) closed the admin-inbox investigation with
a real root cause (an ambiguous foreign-key relationship, not the org_id
theory — see `PROJECT-STATUS.md` for the corrected account) and shipped
real attestation-tracking work, but **six commits and three migrations
remain entirely local, not pushed to `origin/main` or applied to
production.** A new `CLAUDE.md` file now exists specifically to carry
forward hard-won lessons (the FK-ambiguity rule chief among them) into
every future Claude Code session automatically.

Two items from the previous sync (`request-info voice`, `certifications
optional upload`) are now confirmed genuinely pushed, not just committed
— removed from the active list below.

## Active + deferred

### 1. Push six local commits + apply three migrations to production
**The most urgent, concrete action right now.** Six commits
(`ed394bc..a83b366`) sit on top of the already-pushed `acea384`, entirely
local. Three migrations
(`20260903161956_certification_verified_requires_document.sql`,
`20260904140124_add_attestation_tracking.sql`,
`20260904142743_close_submissions_broad_client_policy_gap.sql`) are
applied to `bidpulse-dev` only. **If any of this ships without the
migrations going to production first, in order, the code will error
against missing columns/tables** — the exact failure mode the dev
environment hit before these existed.

**What's actually in these six commits, for reference when deciding what
to ship:**
- Attestation tracking: `submissions.info_attested_at/by` (client
  attests intake info before final submit) + new
  `download_attestations` table (client attests before downloading the
  packet). Enforced via RLS `WITH CHECK`, same pattern as
  `client_certifications.verified` — Postgres itself rejects a violation,
  not just a disabled button. Also softened "Verified" → "Document
  Reviewed" copy everywhere it's client/agency-facing, including
  generated document text, not just UI badges.
- The ambiguous-FK fix (see item #3 below for the full story) — 9 files
  fixed, schema audited for other 2+-FK pairs (none found), documented in
  the new `CLAUDE.md`.
- Logo SVG containment fix, plus a self-inflicted regression (invalid
  `--` inside XML/SVG comments broke all 6 logo files) found and fixed
  same session, verified with a real XML parser.
- A real dark-mode elevation bug on login/reset-password cards
  (`surface-container-lowest` is darker than `surface` in dark mode —
  backwards) — fixed narrowly for just those two cards. See item #4
  below for the broader, still-open version of this issue.
- Auth-page logo size increase (112px → 224px).

**Before pushing:** decide whether to ship all six as one batch or
review/split them — the attestation-tracking work in particular is a
real compliance-relevant feature (client legal acknowledgment before
submit/download), worth a deliberate look rather than a blind push.

**Verification required:** after migrations are applied to production
(in the exact order listed) and code is deployed, a real end-to-end test
— a real client attesting intake info, submitting, downloading a
packet with attestation — confirmed via direct DB reads, not just UI
appearance. Confirm the ambiguous-FK fix holds on production the same
way it was verified in dev (5 real reloads showing correct admin-inbox
data).

### 2. Client-side auto-trigger (deliverables_ready → client_review) — root-caused and fixed 2026-09-05
**Status: real bug, found and fixed.** An earlier pass the same day
closed this as "code confirmed correct, no bug found" based on static
code reading only — that was wrong, caught by a later session's actual
dev testing (real client account, real Preview click, real DB reload
showing `stage` never advanced) and confirmed here with a direct
reproduction against the real dev database, not another code read.

**Root cause:** `app/api/advance-on-client-preview/route.ts` re-verifies
ownership and current stage correctly, but performed the actual
`stage` UPDATE under the client's own RLS-scoped session. Migration
`20260904142743_close_submissions_broad_client_policy_gap.sql` (applied
to dev this same week, for a real, unrelated, legitimate reason — an
attestation-bypass gap) dropped the one broad policy that used to allow
this. The only client UPDATE policy left on `submissions`
(`clients update their own draft submissions`) only permits writes while
`draft = true` — and `deliverables_ready` is inherently non-draft, so
the write silently no-opped on every single call, for every client, on
every submission, unconditionally.

**Confirmed directly**, not inferred: created a real disposable client +
submission at `deliverables_ready`/`draft=false` against the actual dev
database, signed in as that client for a real JWT, and issued the exact
same `UPDATE` the route performs — result: `status: 200`,
`updateData: []`, `updateError: null`. That's PostgREST's signature for
"RLS silently filtered this row out of the write" — no error surfaces
anywhere, which is exactly why `PacketButtons.tsx`'s
`maybeAdvanceOnPreview()` (which also doesn't check `res.ok` before
reading `data?.advanced`) had nothing to show for it either.

**Fix:** same pattern already used elsewhere in this codebase for the
identical constraint (`generate-fit-check/route.ts`, which persists
fit-check results after a client's own final submit already flipped
`draft` to `false`) — keep the ownership/stage check on the caller's own
session (that's the real authorization boundary, already fully
re-verified server-side), but perform the already-validated write
through the service role instead. Verified the fix with the same
reproduction: the RLS-scoped ownership check still correctly passes,
and the service-role write now genuinely flips `stage` to
`client_review` where it silently failed before.

**Still not on production** — this fix sits on top of the already-
unpushed six-commit/three-migration set in item #1; the RLS gap this
depends on doesn't even exist on production yet since that migration
hasn't shipped there. Once item #1 ships, re-run this exact test against
production before considering this fully closed there too.

### 3. Production's actual admin-inbox health — still genuinely unverified
**Correction from the previous sync:** the org_id/RLS theory for the
2026-09-02 "admin inbox shows zero submissions" report was investigated
directly this session — "with a real authenticated session, not just
service_role" — and found **fully healthy**. That theory is retracted.

The real bug found and fixed this session was different, and
self-inflicted the same session: a new migration
(`info_attested_by` on `submissions`) created a *second* foreign key from
`submissions` to `clients`, breaking PostgREST's ability to infer which
relationship to use in any query embedding `clients(...)` — silently, at
request time, with TypeScript catching none of it. Found via a temporary
server-side `console.log` on the real page component, after RLS,
hydration warnings, browser-extension noise, and tunnel caching were
each ruled out in turn. Fixed across all 9 affected files; schema audited
for other 2+-FK pairs (none found). This exact rule — never let a second
FK exist from the same table to the same target without checking every
PostgREST embed that touches it — is now written into the new
`CLAUDE.md` specifically so it's read automatically before any future
migration that adds a foreign key.

**The real caveat, stated directly in this session's own handoff:** the
*original* 2026-09-02 production report was **never re-verified directly
against `bidpulse-production`** — no production credentials were
available that session. It's reasonable to suspect the same underlying
class of issue, but that's not confirmed, and the fix for it isn't even
on production yet (see item #1).

**What's actually needed:** once item #1's migrations and code are on
production, do a real, direct check against production itself — not
dev — confirming a real new submission shows up correctly in the admin
inbox. Only then does this close out for real.

### 4. Systemic dark-mode elevation bug — flagged, not fixed
Found this session while fixing a narrower version for the login/
reset-password cards: `surface-container-lowest` — the token used by
every card/modal in the app — is **darker** than plain `surface` in dark
mode, the opposite of what "elevated surface" should mean. Fixed only for
the two auth-page cards (a `dark:` override), since that was the scope
of the brief that surfaced it. Every other card/modal in the app (e.g.
`ConfirmDeleteDialog.tsx`) still has the same backwards-in-dark-mode
issue. Not urgent, but worth a broader design-token pass at some point
rather than fixing it piecemeal every time it's separately noticed.

### 5. Inbound bid email pipeline — built, blocked on Mike's email setup
Code is done and verified (`app/api/inbound-bid-email/route.ts`, a second
producer into `matched_opportunities` alongside the existing scraper) —
real extraction calls and direct DB read-backs confirmed it works. **Not
yet live in production** — still needs Mike's IONOS/Gmail forwarding
rule, label/filter, and Apps Script trigger set up per
`scripts/README.md`, plus the real `INBOUND_BID_EMAIL_SECRET` added to
Vercel's **production** environment specifically.

### 6. Client-facing fit badge (color-coded, no text)
Real ask 2026-09-04, resolving a design question from the same
conversation that surfaced the "Request info from client" voice bug:
should Fit Check be visible to clients at all? **Decided: not the raw
panel text** — it's written in third person for admin's own reading, and
includes eligibility-concern language deliberately hedged for someone who
understands the nuance ("worth confirming," never "you don't qualify") —
a client reading it cold, unmediated, risks drawing a harder conclusion
than the text supports.

**Decided approach instead: a simple color-coded badge, no explanatory
text.** Shows the existing Strong/Moderate/Weak alignment signal only —
**not** the eligibility concern, which stays admin-only for now (a
sharper, more consequential flag; showing it client-facing risks the
color itself reading as an implicit "you're disqualified" claim even
without words).

**Needs:**
- A small badge component on the client dashboard reflecting
  `submissions.fit_alignment` (`strong`/`moderate`/`weak`), color-mapped
  — but choose colors and any accompanying micro-copy carefully: a bare
  red "Weak" badge risks implying the bid is doomed, which isn't a claim
  the system should ever make. Consider whether "Weak" needs softer
  wording client-side even if the underlying value is unchanged (e.g.
  admin sees "Weak," client sees something less alarming like "Needs
  more info" in a neutral/amber tone rather than red) — worth a real
  design decision, not just a mechanical color swap.
- Placement: likely the Status card, small and unobtrusive — shouldn't
  compete visually with "What we still need from you," which is where
  the actionable follow-up already lives.
- Separately, still pending from the earlier conversation: auto-populate
  the compliance checklist from Fit Check's actionable missing-info
  signals (NAICS codes, certifications), written in proper client-facing
  voice — this was the other half of the original ask and doesn't depend
  on the badge; can ship independently.

**Verification required:** real screenshots showing the badge correctly
reflecting all three alignment states on real submissions, confirming
the coloring/wording doesn't read as more alarming or definitive than
intended — worth showing a real "Weak fit" client-facing badge to
someone unfamiliar with the system and checking their gut reaction
before calling this done, not just checking it renders.

### 7. Law enforcement/detention agency-type integration check
`TRADE_SPECIFIC_CERTIFICATIONS` already covers background-check/
bloodborne-pathogen requirements for these facility types and is
confirmed working via keyword detection. Not yet confirmed whether it's
also integrated into `lib/agency-type.ts`'s keyword-detection system
alongside airport/school/transit/`va`. Quick check, not a full build — do
this the next time `agency-type.ts` is touched for any other reason
rather than as a standalone brief.

### 8. Retainer package usage tracking
Track how many bids a retainer client has used this month against the
"up to 2/month" promise. No schema yet — needs a usage-count field or
derived query against `submissions`/`packages`, plus a decision on how
resets are timed (calendar month vs. rolling 30 days). Explicitly
deferred until there's a real retainer client to test against.

### 9. No admin UI toggle for `is_test` — found 2026-09-05, not building yet
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
