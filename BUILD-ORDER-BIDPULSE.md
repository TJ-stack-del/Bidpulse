# BidPulse — Build Order

Read `PROJECT-STATUS.md` first for full context, evidence, and history.
This file tracks what's actually queued to work on next.

## Status as of 2026-09-01
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
for the full story. Everything through `bebb5b6` is now actually pushed
to `origin/main`.

Nothing is currently mid-flight. The items below are the real remaining
backlog, in suggested order.

## Next up

### 1. Session timeout decision (Open — Needs Attention, not yet a brief)
Not a Claude Code task — a decision Mike needs to make first. Supabase
Auth sessions currently never expire from inactivity (project-level
default). Recommendation on the table: set an inactivity timeout in the
14–30 day range via the Supabase Dashboard (Authentication → Sessions),
skip a hard time-box (unnecessary friction for BidPulse's actual risk
profile). Once decided, this is a one-line dashboard setting, not code —
log the decision and the value chosen in `PROJECT-STATUS.md` either way.

### 2. Manual verification: Dar Mano Consulting VA/CUI exposure
Not a Claude Code task — a real-world read of the actual solicitation
document for this one specific bid, to confirm the system's silence
(no VA-system/CUI trigger language found) reflects genuine safety and
not just absent keywords. Log the outcome in `PROJECT-STATUS.md`'s Known
Issues section regardless of what's found.

### 3. Law enforcement/detention agency-type integration check
Confirm whether `lib/agency-type.ts`'s keyword-detection system covers
law enforcement/detention facilities alongside airport/school/transit/`va`,
or whether that category currently only fires through
`TRADE_SPECIFIC_CERTIFICATIONS` in isolation. Quick check, not a full
build — do this the next time `agency-type.ts` is touched for any other
reason rather than as a standalone brief.

### 4. "Message admin" UI tied to a specific bid
`support_messages` already supports `submission_id` — this is UI-only:
a message box on the submission detail page (both client and admin sides)
that inserts against the existing table and existing RLS policies. No
schema changes needed.

### 5. Retainer package usage tracking
Track how many bids a retainer client has used this month against the
"up to 2/month" promise. No schema yet — needs a usage-count field or
derived query against `submissions`/`packages`, plus a decision on how
resets are timed (calendar month vs. rolling 30 days). Explicitly
deferred until there's a real retainer client to test against.

### 6. Theme no longer matches the new logo
Reported 2026-09-01, still not triaged. Likely fallout from the
shield/heartbeat logo swap (see `PROJECT-STATUS.md`'s Business/Naming
Note) — the app's color tokens/theme were never revisited alongside the
new logo's actual palette. Needs: pull the real colors from the new logo
assets, compare against current Tailwind/design-token theme values, and
decide what to update (primary/secondary colors, surface tones, etc.).
Verify with real screenshots showing logo + theme together before closing
out.

## Closed since the last update (2026-09-01)

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
now at `bebb5b6`. **Needs a real retest against the live site** to
confirm the actual email now arrives correctly — not closed on code
inspection alone, since a real inbox couldn't be checked directly.

**Lesson for next time:** "committed" and "deployed" got conflated more
than once this session — several fixes sat committed-but-unpushed while
marked as done in the handoff docs. Worth pushing immediately after
every commit rather than batching, especially for anything the build
order calls blocking.

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
