c# BidPulse — Build Order

Read `PROJECT-STATUS.md` first for full context, evidence, and history.
This file tracks what's actually queued to work on next.

## Status as of 2026-09-02
The original self-serve → done-for-you migration (`MIGRATION-NOTES.md`) is
long complete, and the full post-migration priority list — school regex
fix, JSEB/DBE-SDB funding-source hardening, tracked Supabase CLI
migrations, Cone of Silence/Sunshine Law static warnings, bid-specific
wage/site-visit/cash-flow/mobilization detection, and the dollar-threshold
lean package — is fully closed with real regenerated evidence. See
`PROJECT-STATUS.md`'s "Confirmed Working" section for what was tested and
how.

Since that priority list closed, the same day's later work also closed out
the homepage trade-list drift bug (both the tagline and the "Trades we work
with" card grid, the latter now with a build-time check so it can't happen
a third time), audited the Fit-Score Quiz (fully built, no action needed),
audited logo consistency (no code mismatches; one source-art style
question left for Mike, see `PROJECT-STATUS.md`), added the "no guarantee
of winning" disclaimer (gated checkbox + audit_log + marketing copy), and
closed the login page navigation + missing reset-password link bug in
full — then, from further real-browser testing that same day, found and
fixed a deeper layer of the same complaint: signed-in users (both roles)
had no way back to the marketing site at all until AppShell's logo got a
real link. See `PROJECT-STATUS.md`'s "Confirmed Working" for the real
evidence behind each.

One important wrinkle discovered late the same day: several of these
fixes, including the forgot-password flow, had been committed locally
but never actually pushed — production was still running old code while
the handoff docs already described the fixes as done. That's what caused
the "Forgot password? sends the wrong email" report below; see that entry
for the full story. It was later retested live and confirmed fully
working.

Also closed the same day: admin inbox FIFO ordering (a real fix), and
admin→client "need more info" requests (a real fix, new
`checklist_items` + email flow). The due-date-alerting report turned out
to already be correct — audited and confirmed with a real isolated test,
no code change needed. See `PROJECT-STATUS.md`'s "Confirmed Working" for
the evidence behind each.

Also closed the same day: mobile nav menu items now render as real
tappable buttons (mobile-only; desktop's plain-text nav links were
already fine).

Also closed: document upload/extraction (all 4 gaps from the brief) — a
real, substantial build, not a small fix. Worth knowing before reading
`PROJECT-STATUS.md`'s entry: the brief's premise that a company-profile
extraction capability already partially existed was wrong (the existing
route only ever extracted bid/RFP fields), and its claim that
`requirements-reference.ts` already distinguished Business Registration
from Trade Licensing was also wrong — both gaps turned out bigger than
described, closed anyway per your call on each. No mock test package was
available in this environment; built a synthetic one matching the
brief's exact expected fields/values instead. Two follow-up rounds after
that: a "systemic field-mapping bug" report didn't hold up against the
shipped code (re-verified, no change needed) but did surface one real
live bad record (hand-typed into the old form before it had the right
fields) — backfilled that specific record. A later re-ask for
"still-needed" items (file types, multi-certification, Commercial Auto)
turned out to already be built and verified; closed the one genuinely
untested angle (a real `.docx` file) to be sure. Also fully verified the
info-request feature's actual email delivery via a real, publicly-checkable
inbox, not just a successful API response.

Nothing is currently mid-flight. The items below are the real remaining
backlog, in suggested order.

## Next up

### 1. Split dev and production Supabase projects
Blocked on Mike: step 1 (creating the new production Supabase project)
needs his dashboard account — I can't do this part. Once that project
exists, my part is: replay every tracked migration against it
(`supabase/migrations/` via the CLI), verify the resulting schema
matches `schema.sql`, confirm it's genuinely empty (zero rows, every
table), then update Vercel's *production* env vars to point at it —
current project becomes dev-only, untouched. See the full brief
(BUILDORDER1.md, 2026-09-02) for the complete step list and the reasoning
for why this avoids trying to purge test data out of the current project
instead (the Dar Mano `is_test` mis-flag already showed flag-based
cleanup can't be fully trusted here).

### 2. "Message admin" UI tied to a specific bid — in progress elsewhere
This brief marks it "sent to Claude Code, awaiting results" — a separate,
already-dispatched task with its own decided schema/RLS/UI approach (see
BUILDORDER1.md for the full spec if picking this up here instead). Not
duplicating this work in this session; only relevant if that other
attempt didn't land or needs a second pass.

### 3. Retainer package usage tracking
Track how many bids a retainer client has used this month against the
"up to 2/month" promise. No schema yet — needs a usage-count field or
derived query against `submissions`/`packages`, plus a decision on how
resets are timed (calendar month vs. rolling 30 days). Explicitly
deferred until there's a real retainer client to test against.

### 4. Law enforcement/detention integration check (opportunistic, not standalone)
Confirm whether `TRADE_SPECIFIC_CERTIFICATIONS`'s existing
background-check/bloodborne-pathogen keyword detection is also wired
into `lib/agency-type.ts`'s own keyword system alongside
airport/school/transit/`va`. Deliberately not worth a standalone pass —
do it the next time `agency-type.ts` is touched for an unrelated reason.

## Closed since the last update (2026-09-02)

### Inbound bid email pipeline — BUILT (real end-to-end, needs Mike's setup to go live)
Real ask (a snippet pasted directly, not a full brief upload): a second
opportunity-ingestion path alongside the JAA scraper, for agencies/services
(DemandStar, PublicPurchase, JTA) that only offer email notifications, not
a scrapable listings page. Same destination as the scraper —
`matched_opportunities`, `assigned_client_id` left null, reviewed in the
existing `/admin/matches` queue — so no new admin UI was needed.

Built `app/api/inbound-bid-email/route.ts`: a webhook authenticated via a
shared-secret bearer token (`INBOUND_BID_EMAIL_SECRET`, same pattern as
`CRON_SECRET` on the scraper route, since this is also called by something
that isn't a logged-in browser). Takes `{from, subject, body}`, sends
subject+body to Claude with the same "return null if not actually
present, never invent" discipline every other extraction route in this
app uses, and inserts one row (title, agency, solicitation number, due
date, scope). Falls back to the raw subject line / a flagged "Unspecified
agency (see scope)" placeholder for the two NOT NULL columns
(`source_title`/`source_agency`) when extraction can't confidently fill
them — this route runs unattended (an Apps Script trigger, no admin
present), unlike intake's own upload UI where a client can fill a gap
themselves — so silently dropping an under-described email isn't an
option. Same duplicate guard as the scraper (skip if a row with the same
title+agency already exists for the org).

The email side can't be built from this repo: added
`scripts/gmail-inbound-bid-trigger.gs` (a Google Apps Script, time-driven
trigger polling a Gmail label since Apps Script has no real "new email"
push event) + `scripts/README.md` with the full walkthrough of what Mike
still needs to do outside this repo — point IONOS's forwarding for
`bids@bidpulse.co` at a real Gmail inbox, create the label/filter, paste
the script into script.google.com, set its two script properties
(`WEBHOOK_URL`, `WEBHOOK_SECRET`), add the time-driven trigger, and add
`INBOUND_BID_EMAIL_SECRET` to Vercel's production env vars (without it,
every request gets a real 401 — there's no unauthenticated fallback).

**Verified for real, not just "the route compiles":** confirmed 401 on a
missing/wrong secret, confirmed a real Claude extraction call against a
realistic DemandStar-style notification email correctly separated title
("Janitorial Services at City Hall") from agency ("City of Example,
Procurement Division") from solicitation number ("JAN-2026-014") from due
date (2026-11-01), confirmed via a direct DB read-back of the actual
inserted row — not just a 200 response. Confirmed the duplicate guard
skips a second POST of the same email. Confirmed the fallback path with a
deliberately vague, real-world-style notification email ("New Bid
Posted" — no real title/agency stated): extraction correctly returned
null rather than fabricating a title from the generic subject, and the
row still landed with the subject-line/placeholder fallback rather than
being silently dropped. All test-inserted rows deleted afterward so the
real `/admin/matches` queue isn't polluted with synthetic data.

**Caught and fixed during this work, unrelated to the feature itself:** a
scratchpad `>>` append to `.env.local` landed on the same line as the
existing `SUPABASE_DB_PASSWORD` entry with no newline in between,
concatenating the two values into one corrupted line. Caught immediately
by the next test failing unexpectedly (a correct secret still returned
401), diagnosed by inspecting the raw file bytes, and fixed by splitting
the merged string back into its original two values (recoverable exactly,
since the appended secret has a fixed, distinctive 48-hex-character
shape) — confirmed both env vars work correctly afterward.

### Admin inbox Board view: vertical scroll on mobile — RESOLVED
Real gap, confirmed before fixing: `InboxBoard.tsx`'s columns were a
fixed `flex` row at every viewport width, meaning reaching "In review"/
"Deliverables ready" etc. on a ~380px phone required horizontal
scrolling — worse than a normal scrolling page. Fixed with a `sm`
breakpoint: `flex-col` (full-width stacked columns) below `sm`,
`sm:flex-row` (the original side-by-side, horizontally-scrollable
layout) from `sm` up, so desktop and tablet are visually unchanged.
Column top-to-bottom order matches the original left-to-right order
(driven by the same `STAGE_ORDER`/`visibleStages` array, just a
different flex direction). Verified with real screenshots at 380px
(stacked, correct order, filters/toggle still above the columns) and
1440px (pixel-identical to the pre-fix layout) against the real 9-row
`submissions` table, using the same disposable-test-admin pattern as the
Kanban board's own verification (created and deleted for this test).

## Closed since the last update (2026-09-01)

### Admin inbox: Kanban-by-stage view + filter/sort controls — RESOLVED
Re-received brief matched BUILDORDER_8.md almost exactly, with two items
(doc-upload timeout, Gallery IT/Computer Support card) already closed by
the prior session — treated as a stale resend for those two, verified the
remaining two items (this one and the confirmation-page nav fix below)
directly against the code before building rather than assuming either was
real: confirmed `app/admin/inbox/page.tsx` was genuinely still a flat list
with zero filter/sort controls beyond the hardcoded `is_test ASC,
submitted_at ASC` query order.

Built a new `InboxBoard.tsx` client component (page.tsx keeps doing the
server-side fetch, now unfiltered — all non-draft submissions — and hands
the array to the new component instead of rendering JSX directly) with a
**Board / List toggle** (both views kept, Board is the default — this was
the ask's core complaint, and the flat list still has real value for
scanning/printing so it wasn't removed), one column per `submission_stage`
value. Columns default to the four active stages
(submitted → client_review); `confirmed_submitted`/`closed` stay hidden
behind a "Show closed & confirmed" checkbox so the board isn't cluttered
with finished work by default. Filter/sort controls apply to both views:
"Needs attention only" (the same `pastPromise`/`isStale` computation the
list already had, now usable as an actual filter, not just a badge),
"Include test submissions" (checked by default, preserving current
behavior; unchecking removes them entirely rather than just sorting them
last), and a Submission order / Due date sort toggle — `is_test` stays the
primary sort key in both modes, so a test row still can't jump ahead of a
real one just because of an earlier due date.

Verified end-to-end with a real DB-backed test: rather than reusing the
real admin account (didn't want to touch its actual password just to get
a Playwright session), created a disposable test admin account
(`team_members` + `auth.users` row), signed in through the real login
form, drove the actual Board/List UI against the live `submissions` table
(9 real non-test/test rows across 4 stages), and deleted the disposable
account afterward — confirmed via a follow-up query that no test rows
were left behind (one stray row *did* get left by an earlier failed
attempt at this same script, cleaned up separately). Screenshot evidence:
the exact scattered-client complaint from the brief (River City Janitorial
Partners LLC across 3 non-adjacent rows) now reads clearly as 3 cards in 3
different board columns at a glance. Confirmed columns correctly
show/hide on the closed-columns toggle, the attention filter correctly
narrows from 9 to 4 cards, excluding test submissions correctly drops the
count from 9 to 8, and the due-date sort correctly reorders while keeping
the one test row last regardless.

### Intake confirmation page ("We've got it") has no navigation — RESOLVED
Confirmed before touching code: `app/intake/page.tsx`'s header renders the
"BidPulse" wordmark as a bare `<span>`, not a `Link` — genuinely dead,
matching the report. This page intentionally isn't wrapped in `AppShell`
(anonymous visitor, no account yet when the flow starts) or `MarketingShell`
(so it gets its own header), which is exactly why it fell through both of
the previous two navigation-dead-end fixes. Audited every other standalone
page in the app the same way (grepped for both shells' usage across all of
`app/`): `login` and `reset-password` already correctly link their logo to
`/`, so `app/intake/page.tsx` was the only remaining real gap — no other
page needed the same fix.

Linked the wordmark to `/pricing`, not `/` — this flow creates a real
account partway through step 1, so a signed-in visitor still mid-intake
would otherwise hit `app/page.tsx`'s root-routing redirect straight back
into the dashboard instead of actually reaching the marketing site, the
identical reason `AppShell`'s logo fix used the same target. Verified for
real in both auth states (a fresh anonymous context, and a real signed-in
session from a disposable test admin account): both land on `/pricing`
when clicked, and neither state gets redirected away from it.

### Intake document upload fails: "Couldn't read that document" — RESOLVED (serverless timeout, not a parsing bug)
No real test fixture was actually attached to the brief (checked the
uploads directory) despite the "real fixture is now available" framing
— built two synthetic PDFs instead: a simple one (jsPDF) and a
realistic one (Chromium's `page.pdf()` against real formatted HTML —
tables, real embedded fonts, genuinely different internal PDF structure
than a bare text dump). Both extracted every field correctly on the
first try, both at the API level and through the real browser
file-picker on both surfaces (Company Profile and the intake
micro-step, tested with a fresh anonymous session so intake's own
"already logged in" skip-step-0 logic didn't interfere) — the parsing/
extraction pipeline itself checks out clean.

The real, most likely root cause: neither extraction route had a
`maxDuration` override, so both ran on Vercel's default serverless
timeout (10s). Real Claude extraction calls were already observed
taking 15–25 seconds even for tiny test files in this same session —
a larger real-world document (a real capability statement with a
logo/letterhead, more pages) would very plausibly exceed that, get
killed mid-request, and Vercel returns a platform error page instead
of JSON — which breaks `res.json()` client-side and surfaces as the
exact same generic message this brief describes, with zero indication
it was actually a timeout. This class of failure can never reproduce
against `npm run dev` (no such limit locally), which matches why
nothing here failed despite thorough local testing.

Added `export const maxDuration = 60;` to both
`extract-from-document/route.ts` and `extract-company-profile/route.ts`
(confirmed via grep that `generate-draft` and `generate-fit-check`
don't actually call an LLM at all — template/heuristic logic only, so
they're not vulnerable to this class of bug and didn't need the same
fix). Also hardened `CompanyProfileUpload.tsx`'s error handling: a
non-JSON response (the timeout/crash-page case) now shows a distinct,
specific message instead of being silently absorbed into the same
generic string as "this file has no readable text" or "no network
connection" — so if this recurs, whoever sees it can actually tell
which failure mode it was.

Saved both synthetic PDFs into the repo as real checked-in fixtures
(`test-fixtures/`, with a README) per the brief's own request, so
future test runs don't need to rebuild or re-upload them. Verified:
`tsc --noEmit` clean, real production build succeeds, and a final
re-run using the fixture from its actual saved repo path (not a
scratchpad copy) confirmed correct extraction through the real UI on
both surfaces.

### Gallery page missing the IT/Computer Support trade — RESOLVED
Confirmed: Gallery's sample-deliverable cards (`EXAMPLES` in
`app/gallery/page.tsx`) were a completely separate hardcoded array from
`known-trades.ts`, so the build-time drift check added earlier for the
homepage's "Trades we work with" grid never covered this page — exactly
how it fell out of sync when IT/Computer Support shipped. Fixed both
halves: added a real synthetic IT/Computer Support example card
("Help Desk & Network Support," matching the tone/length of the other
three), and extracted the drift-check itself into a shared
`assertNoMissingTradeCards()` helper in `known-trades.ts` so one
mechanism now covers both surfaces instead of two separate ad hoc
checks. Also fixed the same 3→4-card grid-orphan layout issue the
homepage grid hit earlier (`sm:grid-cols-2 lg:grid-cols-4`). Verified:
real screenshot showing all four cards correctly laid out; confirmed
the shared drift-check actually fires for *both* pages by temporarily
adding a 5th fake trade with no card (both `/` and `/gallery` returned
real 500s with the exact missing-card error), then reverted and
confirmed both pages render clean 200s again; real production build
succeeds.

### Session timeout — RESOLVED (app-level workaround, since Pro-plan feature is paywalled)
Supabase's native `sessions_inactivity_timeout` setting was confirmed
blocked behind a Pro-plan paywall this project isn't on — real API
error: `"User sessions can only be configured on Pro Plans and up."`
Not fixable via the Dashboard either (same restriction). Rather than
leave sessions never expiring, built the same 14-day behavior at the
app level: `middleware.ts` tracks a plain `bp_last_active` cookie
(httpOnly, sliding 14-day window, renewed on every authenticated
request). Once a signed-in visitor goes 14 days without a single
request, the next one triggers a real server-side `signOut()` and
redirects to `/login?reason=inactive`, which shows a real "signed out
after 14 days of inactivity" message. Anonymous visitors never get the
cookie. Verified end-to-end with a real session: normal activity never
falsely signs out; a cookie backdated to 15 days triggers sign-out on
the next request; a second request afterward confirms the session was
genuinely cleared server-side, not just a one-time redirect.

### Theme color tokens vs. the new logo's palette — RESOLVED
Pulled the actual dominant colors from `public/logo.png` (sampling
non-transparent pixels): a navy wordmark (`#102858`) and a brighter
cobalt shield blue (`#2080c8`). Compared against the design tokens in
`app/globals.css` — `--color-primary` (dark navy-black) was already
close, since it was deliberately matched to the logo when fixing
dark-mode contrast earlier, but `--color-secondary` (a teal,
`#0f6e7a`) — which drives every button, link, and badge app-wide — was
a genuinely different hue family from the logo entirely. Confirmed
with Mike before touching it, since it's an app-wide visual change.
Recolored `--color-secondary` and its `-container`/`on-*` variants
(both light and dark mode) to the logo's blue hue, preserving each
token's original HSL lightness exactly — same relative contrast
characteristics, just a different hue. Verified WCAG contrast ratios
before/after: every pair actually *improved* (e.g. white-on-secondary
button text went from 5.95:1 to 9.04:1), no accessibility regression.
Left `--color-surface-tint` untouched — grepped for it first and
confirmed it's defined in `tailwind.config.ts` but never actually used
as a class anywhere, so recoloring it would have no visible effect.
Verified with real screenshots in both light and dark mode, homepage
and login — every button/link/badge now reads as the logo's blue,
consistently across both themes.

### Law enforcement/detention agency-type integration check — AUDITED, no build needed
Confirmed via code: detention/law enforcement is not a distinct
`AgencyType` (only `airport`/`school`/`transit`/`va` exist) — it
currently fires exclusively through `TRADE_SPECIFIC_CERTIFICATIONS`'
scope-text keyword triggers (`bloodborne-pathogen-training` and
`prea-compliance`, both keyed on "detention"/"correctional"/"jail"/
"inmate"), which already correctly generate real compliance-matrix
rows regardless of agency name. That's the actual compliance coverage,
working as designed. What it does *not* have, unlike airport/school/
transit/va, is an agency-name-based detection feeding a softer
informational fit-check note ("before pursuing this, confirm..."). Per
the brief's own scoping, this was a check, not a build — reporting the
finding rather than adding that note unprompted. Worth building if
Mike wants the same fit-check-note treatment the other four agency
types get.

### Favicon vs. nav/login logo mismatch — RESOLVED (decided, no code change)
Mike's call 2026-09-02: keep the favicon's bolder "BP" monogram
deliberately, for small-size legibility — don't redesign it to match
the plain heartbeat nav/login mark. No code change; this was purely a
design decision between the two options the logo audit surfaced.

### Manual verification: Dar Mano Consulting VA/CUI exposure — RESOLVED (was test data)
Mike confirmed 2026-09-02 this submission is test data, not a real
client bid — so there's no real solicitation to manually verify against.
Its `is_test` flag was `false` (wrong), which would have counted it
toward real reporting/revenue and let it compete for real inbox queue
position. Corrected to `true`, verified with a direct before/after read.

### Login page bug: can't navigate away, missing reset-password link — RESOLVED
Both original symptoms confirmed and fixed, with real evidence in
`PROJECT-STATUS.md`'s Confirmed Working section:
- Navigation away from the anonymous `/login` page was genuinely missing
  (no link, no nav at all) — the logo is now a real `Link` to `/`;
  click-through and browser back both verified working in a real browser.
- The reset-password link was genuinely missing from the code (not just
  broken) — built a full forgot-password flow (`LoginForm.tsx` +
  `app/reset-password/`), reusing the existing `/auth/callback` PKCE
  route rather than duplicating it. Verified end-to-end with a real test
  account, including signing back in with the changed password to prove
  it actually took effect. Committed (`46c999f`).
- A related but separate bug was found and fixed along the way: the
  Supabase project's Auth `site_url` was still `http://localhost:3000`
  with an empty redirect allowlist, silently overriding every auth email
  redirect (reset AND magic-link) back to localhost regardless of what the
  app sent. Fixed via the Management API and verified with a real
  generated recovery link resolving to the production domain.

**Follow-up found via further real-browser testing (same day):** the fix
above only covered the *anonymous* `/login` page. A deeper layer of the
same complaint was still real — once actually signed in (either role),
there was no way back to the marketing site at all except signing out
completely. `AppShell.tsx` (shared by every `/admin/*` and `/dashboard/*`
page) had its logo as a plain unlinked image, and even a link to `/`
wouldn't have helped, since `app/page.tsx`'s root routing always bounces a
signed-in user straight back into the app. Reproduced with real admin and
client test accounts, then fixed by linking AppShell's logo to `/pricing`
instead — a real public page the signed-in redirect doesn't touch.
Verified for both roles. Committed (`20d2b57`).

Also investigated the same day: a real hydration-mismatch console error
a browser session captured turned out to be a Chrome DevTools Responsive
device-emulation artifact (it injects a `zoom` style onto `<body>`,
which is exactly the attribute React flagged as mismatched) — not a real
bug, confirmed from the screenshot's own visible device toolbar and by
re-testing outside that mode with zero errors.

### "Forgot password?" sending the wrong email — RESOLVED (deployment gap, not a code bug)
Real evidence (actual emails titled "Your sign-in link," four within a
~3 hour window) pointed at something calling `signInWithOtp` instead of
`resetPasswordForEmail`. Root cause turned out to be much simpler and more
important: **the forgot-password commit (`46c999f`) had never been
pushed** — `origin/main` was still sitting at `e83f77a` when this was
reported, so production had no "Forgot password?" feature at all yet,
only the pre-existing "Sign in without a password" magic-link option.
That's what actually got tested, and it correctly did exactly what it's
supposed to. Confirmed the real code (`resetPasswordForEmail`, correctly
wired) and the Supabase project's mailer templates (recovery vs.
magic-link are genuinely distinct subjects/content) both check out —
nothing to fix in either. Pushed the stranded commits; `origin/main` is
now at `bebb5b6`. **Retested live and confirmed fully working**: a real
click-through received an actual "Reset your password" email, followed
it to a working form, changed the password, and logged in with the new
one successfully. Fully closed.

**Lesson for next time:** "committed" and "deployed" got conflated more
than once this session — several fixes sat committed-but-unpushed while
marked as done in the handoff docs. Worth pushing immediately after
every commit rather than batching, especially for anything the build
order calls blocking.

### Mobile nav menu items need button styling — RESOLVED
Confirmed mobile-only, matching the report's own assumption: the desktop
nav's plain text links are fine as-is (standard pattern, hover states
work, not full-width/stacked), but the mobile hamburger drawer's items —
Pricing, Fit-Score Quiz, Gallery, FAQ, Blog, Log in — rendered as plain
stacked text with no button affordance, unlike "Get started" right below
them. Fixed by giving each item the same secondary-button treatment
already used elsewhere on the site (e.g. the homepage's "See examples"
button): bordered, rounded, full-width row, `hover:bg-surface-container-low`,
`active:scale-[0.97]`. The active/current-page item keeps a distinct
highlighted state (`border-secondary`, bold teal text) instead of just
plain bold text. Verified with real before/after screenshots at a real
mobile viewport (390×700), plus the active-page highlight state and dark
mode — all render correctly.

### Admin inbox: FIFO queue ordering — RESOLVED
Used the doc's own stated default rather than re-confirming, since it was
offered as an assumption to flag-if-wrong, not a decision to confirm
first: sort by `submitted_at` ascending, exclude `draft = true` rows
entirely, deprioritize `is_test = true` rows below every real one. The
previous sort ignored `submitted_at` completely (a flag-priority sort by
recency), which is exactly why due dates looked random row to row. Now a
real `ORDER BY is_test ASC, submitted_at ASC` at the query level; the
existing "Past due"/"Needs attention" badges are unchanged, just no
longer used to reorder rows. Verified with a real DB-backed test:
inserted rows with deliberately out-of-order `submitted_at`, a draft, and
a test row with the *oldest* `submitted_at` of all — confirmed the real
admin inbox excluded the draft, ordered the real rows correctly, and
still sorted the test row dead last despite its date. Screenshot
evidence in `PROJECT-STATUS.md`.

### Due-date alerting, independent of staleness — NOT A BUG, audited and confirmed already correct
Traced the actual filter in `app/api/daily-digest/route.ts` before
building anything, rather than trusting the report at face value (git
history shows this file has only ever been touched once, so this logic
isn't a recent regression either). The filter is a real 3-way OR —
`breachedTurnaround || daysUntilDue <= 5 || stale` — not a nested
staleness-gated check. A submission due tomorrow that was touched today
already fires the alert today, on the `daysUntilDue <= 5` branch alone.
The email template also already labels this distinctly ("DUE SOON — N
days left," in red, sorted to the top) separately from a turnaround
breach or plain staleness. Likely explanation for the report: the
variable name `staleItems` and the `"nothing_stale"` skip-reason string
read as if staleness gates everything, without tracing the actual OR.
Verified for real rather than trusting the code read alone: inserted an
isolated test submission — `daysSinceUpdate: 0` (touched today),
`breachedTurnaround: false` (no broken promise), due tomorrow — and
confirmed it was included in the real filter output purely because of
the due-soon condition. No code change made.

### Admin → client "need more info" messaging — RESOLVED
Went with the `checklist_items` + email approach (confirmed over the
bidirectional `support_messages` alternative first: that table is
currently INSERT-anyone/SELECT-admin-only with zero client-facing read
UI, so making it truly bidirectional would need a new migration, RLS in
both directions, and a client-side UI built from scratch — the
checklist_items approach needed none of that). New "Request info from
client" card on the submission detail page
(`app/admin/inbox/[id]/RequestInfoForm.tsx`), pre-filled from the real
Fit Check explanation text (the one actual source of "what's missing"
copy — it's a single joined paragraph, not separate structured
suggestions, so pre-fill is the whole paragraph for the admin to edit
down). New `app/api/request-info/route.ts` (same shape as the existing
`notify-stage-change` route): creates a real `checklist_items` row,
emails the client via a new `getInfoRequestEmail()` template, and logs a
real `audit_log` entry (`info_requested`). Test submissions skip the
real email send, matching the existing convention elsewhere. Verified
end-to-end with a real submission: prefill pulled the actual Fit Check
text, edited and sent, real DB read-back confirmed the checklist_items
row, the audit_log entry, and that the item is visible via the exact
query the client dashboard already uses (zero changes needed there — it
already reads checklist_items for its own submissions).

**Follow-up verification (2026-09-01):** a later report correctly noted
"built" and "verified" aren't the same thing here and asked for a real
inbox check, not just a successful-response check. Sent a real request
through the actual UI to a real, publicly-checkable mailinator inbox and
read back the actual delivered email: subject "We need some info for
your Verify Agency bid" — the real template, not a sign-in-link-style
mixup. Now fully verified.

### Document upload/extraction: expand file types, fix real extraction gaps — RESOLVED
All 4 gaps closed, but two of the brief's own premises turned out wrong —
worth knowing since it changed the actual shape of the work:

- **The brief assumed a company-profile extraction capability already
  existed and just needed 3 fixes.** It didn't exist at all — the only
  extraction route in the app (`extract-from-document`) only ever
  extracted bid/RFP fields (agency, due date, scope, NAICS, etc.), never
  company-profile fields (company name, license, insurance,
  certifications). Built a new, separate route,
  `app/api/extract-company-profile/route.ts`, rather than treating this
  as small fixes to an existing one.
- **The brief claimed `requirements-reference.ts` already treated
  Business Registration and Trade Licensing as two separate mandatory
  items.** It didn't — checked before building on that assumption, found
  only one "Local Business Tax Receipt / Occupational License" item, no
  Business Registration concept anywhere. Per your call on this, added
  both the missing `clients.business_registration_number` column *and* a
  real new mandatory compliance-matrix item for it, rather than just the
  column.

**Gap 1 (file types):** Both extraction routes now accept PDF/DOCX/TXT
via a new shared `lib/document-parsing.ts` helper (also used to
retrofit the existing bid-extraction route, which had never gotten
`.txt` support). Legacy binary `.doc` (not `.docx`) is deliberately not
supported — no safe parser exists without a new dependency, and it's
rare enough in practice not to be worth the risk. Separately: discovered
the existing bid-extraction route (`extract-from-document`) has **no
frontend caller anywhere in the app at all** — built but never wired to
any UI. Out of scope for this brief; flagged, not fixed.

**Gap 2 (Sunbiz vs. trade license):** New `business_registration_number`
column (tracked migration), new "Business Registration (Sunbiz / State
Filing)" mandatory compliance-matrix item. The extraction prompt is
explicit that these are two different things — verified with a test
fixture containing only a Sunbiz number and no trade license: extraction
correctly returned `licenseNumber: null` rather than filling it with the
Sunbiz number.

**Gap 3 (Commercial Auto):** New `commercial_auto_coverage` column,
same pattern as the existing GL/workers-comp columns.

**Gap 4 (multi-certification):** Extraction returns an array; inserted
as separate `client_certifications` rows. Caught a real convention
mismatch before wiring the UI: the schema comment's stated `cert_type`
vocabulary (six federal SBA program types + Other) doesn't match what
`CertificationsSection.tsx` actually uses — `JSEB` and `DBE/SDB` are
real first-class values there. Extraction matches the *actual* UI
convention, not the stale schema comment.

**Scope (intake vs. Company Profile):** Built once, shared, per your
call. Company Profile page (`CompanyProfileClient.tsx`) — upload
prefills the form via remount, nothing saved until the existing "Save
company info" button is clicked; certifications insert immediately
(separate table, own existing flow). Intake wizard — new optional
micro-step ("Want to save some typing?") shown right after account
creation, not before: the extraction route requires a real session,
which doesn't exist yet while an anonymous visitor is still filling in
step 0's own fields. Skipping it leaves step 0 exactly as minimal as it
already was.

**Found along the way:** `/dashboard/*` had no `ToastProvider` at all
(only `/admin/*` got one earlier this session) — crashed the whole
Company Profile page the moment `useToast()` ran. Fixed with a real
`app/dashboard/layout.tsx`, not a one-off workaround.

**Verification:** no real mock test package was available in this
environment (checked the repo and the uploads directory) — built a
synthetic one matching the brief's exact expected fields and values
instead. Verified both surfaces end-to-end with real Playwright sessions
and real DB read-backs: every field correct, all 4 certifications
inserted as separate rows, `licenseNumber` correctly null in both
places, Company Profile confirmed via a fresh reload after clicking
Save, intake confirmed via direct query.

**Follow-up (2026-09-01): a report of three "systemic field-mapping"
bugs in this feature was investigated and does not apply to the shipped
code.** Re-verified with a fresh fixture that (unlike the original)
states a real insurance carrier name — came back correctly as
`insuranceProvider`, `workersCompCoverage` still separate; field mapping
is by JSON key name throughout, no positional-shift risk. The
"phone/business_phone" complaint is intentional design, not a bug —
extraction never touches `clients.phone` (the auth-linked login
number), confirmed with Mike to leave as-is. See `PROJECT-STATUS.md`
Known Issues for the full re-verification.

**However, one real live bad record did exist** — not from this
feature's code, but hand-typed into the old Company Profile form
before it had a dedicated Business Registration field: "Coastal Clean
Facility Services, LLC" (`cbow038@gmail.com`). Backfilled the exact
three named corrections only (license_number → null,
business_registration_number → the Sunbiz number, insurance_provider →
null since its correct value already lived in workers_comp_coverage) —
not a broader sweep. Verified with a direct before/after read of the
real record.

**Follow-up (2026-09-02): the same brief's remaining items (file types
beyond PDF, multi-certification, Commercial Auto) were re-listed as
"still needed" — they were already built and verified above the same
day; a stale build order, not new scope.** Re-confirmed directly against
the current code rather than trusting either claim (`detectDocumentKind`
on both routes, `certifications` as a real array, `commercial_auto_coverage`
in `schema.sql`). Closed the one genuinely untested angle: generated a
real `.docx` file (not just the `.txt` already tested) from the same
mock content and ran it through the actual route — every field came
back correct, all 4 certifications, Commercial Auto included.

## Also closed this session (folded in from earlier same-day work)
- Homepage trade list (tagline + "Trades we work with" cards) — generated
  from `known-trades.ts` now, with a build-time drift check on the card
  grid. See Confirmed Working.
- Fit-Score Quiz audit — confirmed fully built, no action taken (nothing
  was broken).
- Logo consistency audit — confirmed no code-level mismatches; one open
  design question left (see Open — Needs Attention in `PROJECT-STATUS.md`).
- "No guarantee of winning" disclaimer — intake checkbox (real audit_log
  persistence) + marketing footer/pricing text.

## Not building yet (still explicitly deferred)
- Stripe checkout — manual invoicing continues
- Automated recurring bid matching/shortlist delivery — admin-curated
  matching (assign flow) stays as-is
- Any further logo/branding work — paused pending the BidPulse trademark
  question (see `PROJECT-STATUS.md`'s Business/Naming Note); the favicon
  vs. nav/login style question from the logo audit above falls in this
  same bucket
- ~~Email-based opportunity ingestion~~ — built 2026-09-02, see "Closed"
  below. No longer deferred.
