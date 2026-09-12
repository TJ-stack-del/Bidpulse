# Working notes for Claude Code on this repo

Read `PROJECT-STATUS.md` and `BUILD-ORDER-BIDPULSE.md` for project history
and what's queued next. This file is durable process/convention notes only
— things learned the hard way that should never need re-learning.

## PostgREST embeds break silently when a table gains a second FK

**What happened (2026-09-04):** the attestation-tracking migration added
`submissions.info_attested_by uuid references clients(id)` — a second
foreign key from `submissions` to `clients`, alongside the existing
`client_id`. That silently broke every `.select(...)` in the app that did
a bare `clients(...)` embed from a `submissions` query — PostgREST can no
longer infer which relationship to use, and returns a `PGRST201`
"more than one relationship was found" error at request time, not build
time. **9 files were affected**: the admin inbox list, the admin
submission detail page, fit-check generation, draft generation,
request-info, stage-change notifications, message notifications, the
deliverables-ready auto-trigger, and the client/admin packet
preview-download component. TypeScript catches none of this — the
`.select()` string is untyped. No test suite in this repo would catch it
either. It was found by a real user report of an empty admin inbox, not
by anything automated.

**The rule going forward:** any time a migration adds a new foreign key
from table A to table B, and table A already has *any* other FK to B (or
gains one later), **every existing `.select()` that embeds `B(...)` from
a query on A must be updated to `B!fk_constraint_name(...)`** to
disambiguate. Concretely, right after writing a migration with a new
`references`:

```bash
# find every bare embed of the table you just added an FK to
grep -rn 'clients(' app components lib --include="*.ts" --include="*.tsx"
```

Check each hit — if the query is `.from("submissions")` (or whatever
table now has 2+ FKs to the referenced table), disambiguate it:
`clients!submissions_client_id_fkey(...)`. The FK constraint name is
whatever the migration named it explicitly, or Postgres's auto-generated
`<table>_<column>_fkey` if declared inline (`column_name uuid references
other_table(id)` — this style doesn't show up in a grep for `ADD
CONSTRAINT`, so check for it separately; it still creates a real,
auto-named FK).

**Better yet — disambiguate proactively.** If a table might plausibly
gain a second relationship to something it already embeds (anything
tracking "who did this" alongside an existing ownership column is a
prime candidate — attestation/audit/approval-style columns almost always
end up pointing at the same table an existing owner column already
does), write the embed with an explicit `!fk_name` from the start rather
than waiting for it to break.

## `.env.local` may not point at the same Supabase project as production — verify, don't assume

**What happened (2026-09-11):** a session set out to verify the handoff
claim "migrations are applied to production." It read
`NEXT_PUBLIC_SUPABASE_URL` out of this checkout's `.env.local`
(`hvrwxcyqgjobrgpcequj`) and confirmed migrations against that project —
then reported "production confirmed." That project is actually
**`bidpulse-dev`**. The real production project Vercel serves
`bidpulse.co` from is a different one, **`bidpulse-production`**
(`rixsgnbivayeaxbdseij`), whose env vars live only in Vercel's dashboard,
not in this checkout's `.env.local`. The mix-up was only caught because
a later step tried to log in through a real browser session against the
live site and the network request revealed the actual project host.

Once checked against the real project, it turned out one migration
(`client_past_performance`) genuinely was missing from
`bidpulse-production` — `PROJECT-STATUS.md` had already logged, on
2026-09-05, that this exact migration was "applied directly against the
live production database via the Supabase dashboard SQL editor," which
was almost certainly done against the wrong project too, given the same
underlying confusion. Applying it for real also surfaced a second,
compounding bug: the table *did* eventually turn out to already exist in
`bidpulse-production` (a stale local migration-history record, not a
missing table) — but PostgREST's schema cache didn't know about it
(`PGRST205: Could not find the table ... in the schema cache`), meaning
every real request touching Past Performance had been silently failing
in production. A manual `NOTIFY pgrst, 'reload schema';` in the SQL
editor fixed the live bug; `supabase migration repair --status applied
<version> --linked` fixed the bookkeeping so `db push` stopped erroring
on "relation already exists."

**The rule going forward:** never trust `.env.local`'s
`NEXT_PUBLIC_SUPABASE_URL` as "production" without checking. Before
claiming anything is verified "on production," confirm the actual
project ref two ways:
1. `npx vercel env ls production | grep -i supabase` to see what's
   *configured* for the live deployment (values are masked, but this at
   least confirms Vercel has its own separate set, distinct from
   `.env.local`).
2. A real network request against the live site (a real login attempt
   is enough) — the request host (`<ref>.supabase.co`) is the actual
   answer, not inference from any local file.

Then run `npx supabase login --token <PAT>` (browser-based `supabase
login` doesn't work in this non-TTY environment; a token from
https://supabase.com/dashboard/account/tokens is required) and `npx
supabase link --project-ref <the-real-ref>` before treating any
`migration list` output as authoritative. `supabase db push` also
refuses to insert a migration that's timestamped earlier than migrations
already applied after it, without `--include-all` — expect that error
if a gap gets found and closed out of order.

Separately: after any DDL applied by hand (dashboard SQL editor, direct
psql) rather than through `supabase db push`, don't assume PostgREST
picked it up automatically. Verify with a real REST call
(`GET /rest/v1/<table>?select=id&limit=1` with the project's public
anon/publishable key) — `PGRST205` means the schema cache is stale
(run `NOTIFY pgrst, 'reload schema';`), not necessarily that the table
is missing.

## A Supabase project's Site URL/Redirect URLs can silently route auth emails to the wrong deployment entirely

**What happened (2026-09-12):** a real user report — "the password reset
email takes me back to bidpulse, no option to reset the password," and
separately the magic-link ("sign in without a password") flow doing the
same thing. First hypothesis was an app-code bug (a cross-device PKCE
code_verifier mismatch, or the callback route not handling every URL
shape Supabase can send) — real gaps, and both got fixed
(`app/auth/callback/route.ts` now handles both the `?code=` PKCE shape
and the `?token_hash=&type=` OTP shape, and logs the real error instead
of silently swallowing it), but neither was the actual root cause here.
~25 minutes were spent watching live production logs
(`npx vercel logs bidpulse.co --follow`) for a request that was never
going to arrive, because the failure happened before any meaningful
request ever reached the app.

The real cause: the user was testing against **`bidpulse-dev`** from a
Codespace's forwarded URL (`https://<id>-3000.app.github.dev`, a URL
that's different every Codespace session). That origin was never on
`bidpulse-dev`'s Redirect URLs allow-list, so Supabase fell back to the
project's configured **Site URL** — which was set to
`https://bidpulse-nine.vercel.app`. That URL isn't a dev/test URL at
all — it's one of the **production** Vercel deployment's own aliases
(confirmed via `npx vercel inspect`, listed right alongside
`bidpulse.co`), wired to the **production** Supabase project. So every
auth email issued by the dev project was redirecting straight into a
live, working, completely unrelated production app instance, which
naturally had no idea what to do with a token issued by a different
Supabase project and just showed its own normal (logged-out) login
page — reading exactly like "the link doesn't work," not like "wrong
project entirely."

**The rule going forward:** when an auth email (password reset, magic
link, invite) redirects somewhere unexpected, check the *Supabase
project's own Auth → URL Configuration* (Site URL + Redirect URLs)
*before* assuming it's an app-code bug — this failure mode produces no
error, no failed request, nothing in the app's own logs at all, because
the request never reaches the app in a usable form. Confirm which
Supabase project is actually in play first (this repo has confused dev
vs. production before — see the rule below this one), then check that
project's own dashboard settings, not just the code. For a Codespace
dev environment specifically, whose forwarded URL changes per session,
`bidpulse-dev`'s Site URL should point at a stable local fallback
(`http://localhost:3000`) and its Redirect URLs should include a
wildcard pattern (`https://*.app.github.dev/**`) rather than one
exact, temporary URL that breaks the next time the Codespace restarts.

## When verifying a fix, test the exact query the real code runs — not a simplified proxy

Directly related to the same incident: partway through debugging the
empty-inbox report, a test query was written by hand to check the RLS
policy directly against a real authenticated session — and it returned
data correctly. That test *omitted* the `clients(company_name)` embed
(only selected `id, agency, stage, draft`), so it didn't exercise the
actual broken code path at all — a false "this works" that sent the
investigation toward RLS, hydration, browser extensions, and tunnel
caching before the real bug (a plain PostgREST error, visible in one
line of server-side logging) was found. The lesson: when a "let me
verify this independently" test doesn't reproduce a report, check
whether the test actually used the *same* query/shape as the real code
path before trusting the negative result. A quick `console.log` of the
real server component's actual query result (temporary, server-side
only, removed after) settled this in one request — faster and more
certain than reconstructing a session to run a hand-written proxy query.
