# Session Handoff (2026-09-03 → 2026-09-04)

Very long session. Read `CLAUDE.md` first — new this session, it's the
durable "don't relearn this the hard way again" file, automatically read
by every future Claude Code session. Then this doc for what's actually
done vs. pending. 6 commits are local-only right now (`ed394bc..a83b366`)
— nothing below is on production yet, either code or database.

## Environment: healthy, dev server running
Env vars, Vercel/Supabase links all resolved early this session (see
older git history if the full story's needed — condensing here since
it's long settled). Dev server is up (`npm run dev`, port 3000).
**Supabase CLI auth expires periodically** — needs a fresh
`SUPABASE_ACCESS_TOKEN=<token> npx supabase login` (browser flow doesn't
work in this non-interactive environment) whenever a migration needs
pushing and it's not already authenticated.

## Everything from the start of this session through the COJ scraper
Already reconciled and pushed (`origin/main` is at `acea384`) —
pre-launch bug fixes (request-info voice, certifications optional
upload), the full logo/brand-color swap, nav standardization, dashboard
simplification, and the new City of Jacksonville scraper. Not repeating
that whole history here; see `BUILD-ORDER-BIDPULSE.md` for the
reconciled status of everything from before this point.

## What's new since then (all 6 unpushed commits)

**Attestation tracking + "Verified" → "Document Reviewed" copy**
(`ed394bc`). Four-part brief: softened the "Verified" claim everywhere
it's client/agency-facing (including the actual generated document
copy, not just the two obvious badges), added `submissions.
info_attested_at/by` (client attests intake info before final submit)
and a new `download_attestations` table (client attests before
downloading the packet). The brief assumed a server "submit route" to
re-validate in — this app has none, `finalizeSubmission` writes
`draft=false` directly from the browser via RLS — so both new
attestation checks are enforced the same way `client_certifications.
verified` already is: a `WITH CHECK` on the RLS policy that Postgres
itself rejects if violated, not just a disabled button. **Migrations
applied to `bidpulse-dev` only.**

**Logo pulse-overflow fix, then a self-inflicted regression, then that
fixed too** (`99fc4e6`, `e1e1c60`): rescaled the pulse-wave path in all 6
logo SVG files so it reads as contained within the shield outline. Then
found my own explanatory comments used `--` (invalid inside XML/SVG
comments) in all 6 files, breaking them as valid XML — fixed, verified
with a real XML parser this time, not just a text search.

**Login card shadow → then a real dark-mode elevation bug** (`4977b61`,
then `50a0165`): first added a `--color-primary`-tinted shadow (per a
brief asking for one), then a *later* brief correctly pointed out
shadows don't read on a dark page at all. Real finding while fixing it:
`surface-container-lowest` (the token this card, and literally every
other card/modal in this app, uses) is *darker* than plain `surface` in
dark mode — the opposite of "elevated." Fixed with a `dark:` override
(`bg-surface-container-lowest dark:bg-surface-container-low`) on just
the login/reset-password cards, since neither token alone is correct in
both themes. **Flagged, not fixed**: every other card/modal in the app
(e.g. `ConfirmDeleteDialog.tsx`) still has this same backwards-in-dark-
mode issue — out of scope for that brief, worth a broader pass someday.
Same commit doubled the auth-page logo (112px → 224px, new
`--auth-logo-height` variable, separate from `--nav-logo-height`).

**The big one: a real, user-reported, launch-blocking bug** (`a83b366`).
The attestation migration's new `info_attested_by` FK created a *second*
foreign key from `submissions` to `clients` — which silently broke
**9 files** across the app that embed `clients(...)` from a submissions
query (PostgREST can't infer which relationship to use once there are
two, and errors at request time — TypeScript catches none of it). This
is what caused a real "admin inbox shows zero submissions" report.
Fixed all 9, audited the whole schema for other 2+-FK pairs (none
found), and wrote up the whole incident — root cause, the exact rule to
follow next time, and a debugging-methodology lesson — in the new
`CLAUDE.md`. **Read that file before touching any future migration that
adds a foreign key.**

## Real debugging detour worth knowing about (led to the bug above)
Mike reported the admin inbox empty. Investigated in order: RLS/org_id
alignment (fully healthy — verified with a real authenticated session,
not just service_role), hydration mismatches (real, but a DevTools
device-emulation artifact, not the cause), browser extension noise (real,
unrelated), tunnel-level page caching (ruled out with a cache-busting
query param). The actual cause only surfaced once a *temporary,
server-side-only* `console.log` was added directly to the real page
component to see its real query result on a real request — one line of
logging beat every other diagnostic approach. Removed after confirming
the fix across 5 real reloads showing the correct data.

## Migrations applied to `bidpulse-dev` only — NOT production
Three since the last full accounting:
`20260903161956_certification_verified_requires_document.sql` (already
covered in prior handoff history), plus this session's two new ones:
`20260904140124_add_attestation_tracking.sql` and
`20260904142743_close_submissions_broad_client_policy_gap.sql`. None of
these are on `bidpulse-production`. If any of this session's code ships,
all three (in order) need to go to prod first, or the code will error
against missing columns/tables exactly like the dev environment did
before they were applied.

## Still genuinely open, unrelated to anything above
- **Production's actual `org_id`/admin-inbox health** — the original
  report that kicked off this whole investigation was about a
  *different* Supabase project (`bidpulse-production`), from 2026-09-02,
  back when it was freshly split off. Never verified directly — no
  production credentials available this session. Dev's admin inbox is
  now confirmed fully healthy (the real bug was the embed issue above,
  unrelated to org_id, which was already fine).
- Final pass on `PROJECT-STATUS.md`'s Known Issues — never done this
  session.
- Inbound bid email pipeline — code done, blocked entirely on Mike's
  IONOS/Gmail/Apps Script setup.
- The systemic dark-mode elevation issue (every other card/modal using
  bare `surface-container-lowest`) — flagged, not fixed, out of scope
  each time it came up.

## Uncommitted / local-only
- `CODESPACE-REBUILD-BRIEF.md`, this file — local scratch docs, never
  committed, per established pattern this whole session.
- Nothing else — working tree is otherwise clean.
