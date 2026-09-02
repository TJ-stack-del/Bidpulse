# BidPulse — Build Order

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

### 1. Session timeout — blocked on Supabase plan tier, not a decision anymore
Mike chose 14 days. Tried to set it via the Management API
(`sessions_inactivity_timeout: 1209600`) 2026-09-02 — Supabase rejected
it: `"User sessions can only be configured on Pro Plans and up."` This
project is below that tier. Not fixable in code or via API/Dashboard as-is.
Needs Mike to either upgrade the Supabase plan or accept the indefinite-
session default for now. See `PROJECT-STATUS.md` Open — Needs Attention.

### 2. Law enforcement/detention agency-type integration check
Confirm whether `lib/agency-type.ts`'s keyword-detection system covers
law enforcement/detention facilities alongside airport/school/transit/`va`,
or whether that category currently only fires through
`TRADE_SPECIFIC_CERTIFICATIONS` in isolation. Quick check, not a full
build — do this the next time `agency-type.ts` is touched for any other
reason rather than as a standalone brief.

### 3. Retainer package usage tracking
Track how many bids a retainer client has used this month against the
"up to 2/month" promise. No schema yet — needs a usage-count field or
derived query against `submissions`/`packages`, plus a decision on how
resets are timed (calendar month vs. rolling 30 days). Explicitly
deferred until there's a real retainer client to test against.

### 4. Theme color tokens vs. the new logo's palette
Not yet looked at. Flagged as likely fallout from the shield/heartbeat
logo swap — needs pulling the actual colors from the logo assets and
comparing against the current Tailwind/design tokens.

## Closed since the last update (2026-09-01)

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
- Email-based opportunity ingestion (DemandStar/PublicPurchase/JTA
  notification emails, alongside the existing JAA/JEA scrapers). Real
  feature, deliberately deferred, not a quick add. Mechanical plan for
  when it's picked up:
  1. Dedicated inbox address (e.g. `bids@yourdomain.com`), separate from
     personal email — point DemandStar/PublicPurchase/JTA notification
     preferences there, or forward via a Gmail filter rule in the
     meantime.
  2. Inbound email via webhook, not IMAP polling — an inbound-email
     service (Resend inbound, since outbound is already on Resend;
     Postmark and Mailgun are alternatives) turns "email arrives" into an
     HTTP POST with parsed subject/body/sender as JSON.
  3. New API route, same shape as the PDF-extraction route
     (`route (2).ts`) — hand the email body to Claude with an extraction
     prompt asking for the same fields, same "return null if not actually
     present, never invent" discipline already used elsewhere.
  4. Insert into `matched_opportunities` with `assigned_client_id = null`,
     same as the scraper flow — shows up in the existing admin review
     screen, no new UI needed.
  Why it waits: needs a live DemandStar/PublicPurchase registration
  actually receiving real notification emails first, since the extraction
  prompt needs to be built and tested against real template samples, not
  a guess at the format. Also a nice-to-have, not a blocker — it moves
  the manual step from "type into Supabase" to "glance and correct,"
  doesn't remove it entirely.
