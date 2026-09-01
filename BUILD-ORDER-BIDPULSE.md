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
closed item #6 below (login page navigation + missing reset-password link)
in full. See `PROJECT-STATUS.md`'s "Confirmed Working" for the real
evidence behind each.

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
Both symptoms confirmed and fixed, with real evidence in
`PROJECT-STATUS.md`'s Confirmed Working section:
- Navigation away was genuinely missing (no link, no nav at all) — the
  logo is now a real `Link` to `/`; click-through and browser back both
  verified working in a real browser.
- The reset-password link was genuinely missing from the code (not just
  broken) — built a full forgot-password flow (`LoginForm.tsx` +
  `app/reset-password/`), reusing the existing `/auth/callback` PKCE
  route rather than duplicating it. Verified end-to-end with a real test
  account, including signing back in with the changed password to prove
  it actually took effect. **Not yet committed as of this writing** — flag
  this if picking the repo up before that commit lands.
- A related but separate bug was found and fixed along the way: the
  Supabase project's Auth `site_url` was still `http://localhost:3000`
  with an empty redirect allowlist, silently overriding every auth email
  redirect (reset AND magic-link) back to localhost regardless of what the
  app sent. Fixed via the Management API and verified with a real
  generated recovery link resolving to the production domain.

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
