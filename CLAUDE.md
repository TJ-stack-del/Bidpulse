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
