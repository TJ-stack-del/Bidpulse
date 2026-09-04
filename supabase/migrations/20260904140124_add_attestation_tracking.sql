-- Attestation brief, part 2: two checkpoints, tracked separately since
-- they're genuinely different events -- a client attesting their intake
-- info is accurate (once, at final submit) vs. attesting they reviewed a
-- specific deliverable before downloading it (possibly more than once,
-- if they re-download after a revision).

-- Submission-level: client attests intake info is accurate before final
-- submit. Nullable -- most existing rows predate this and never will
-- have it backfilled.
alter table "public"."submissions"
  add column if not exists "info_attested_at" timestamptz,
  add column if not exists "info_attested_by" uuid references "public"."clients"("id");

-- Deliverable-download-level: one row per attestation event, not per
-- submission -- a client may re-attest if they re-download after a
-- deliverable is revised, so this is an append-only log, not a flag to
-- overwrite.
create table "public"."download_attestations" (
  "id" uuid primary key default "extensions"."uuid_generate_v4"(),
  "submission_id" uuid not null references "public"."submissions"("id") on delete cascade,
  "deliverable_type" text not null,
  "attested_by" uuid not null references "public"."clients"("id"),
  "attested_at" timestamptz not null default now()
);

alter table "public"."download_attestations" enable row level security;

-- Ownership check goes through submissions (download_attestations has no
-- org_id of its own), same pattern support_messages' RLS already uses
-- for submission-scoped ownership checks. WITH CHECK additionally
-- requires attested_by to resolve to the caller's own client record (not
-- just any client_id they could otherwise supply) -- same anti-spoofing
-- shape as the submissions policy below for info_attested_by. USING
-- alone would apply to inserts too if WITH CHECK were omitted, but that
-- wouldn't catch a spoofed attested_by, hence the separate clause.
create policy "clients manage their own download_attestations"
  on "public"."download_attestations"
  for all
  using (
    exists (
      select 1 from "public"."submissions" s
      where s.id = download_attestations.submission_id
        and public.is_own_client_record(s.client_id)
    )
  )
  with check (
    exists (
      select 1 from "public"."submissions" s
      where s.id = download_attestations.submission_id
        and public.is_own_client_record(s.client_id)
    )
    and public.is_own_client_record(attested_by)
  );

create policy "admins read download_attestations"
  on "public"."download_attestations"
  for select
  using (
    exists (
      select 1 from "public"."submissions" s
      join "public"."clients" c on c.id = s.client_id
      where s.id = download_attestations.submission_id
        and public.is_admin(c.org_id)
    )
  );

-- Brief part 3's "re-validate server-side in the submit route" doesn't map
-- onto this app's actual architecture -- there is no submit route.
-- finalizeSubmission (lib/submissions.ts) writes draft=false directly from
-- the browser via the Supabase client, gated only by RLS, same as
-- client_certifications' verified flag already is. So this is the real
-- server-side backstop: extends the existing client-update policy's WITH
-- CHECK so flipping draft to false requires info_attested_at to be set
-- AND info_attested_by to actually resolve to the caller's own client
-- record (via is_own_client_record, not just any client_id they could
-- otherwise type in) -- a client can't bypass this by only editing
-- BidFileStep.tsx's disabled-button check, since Postgres itself rejects
-- the write. Any update that leaves draft = true (normal in-progress
-- editing) is unaffected.
drop policy if exists "clients update their own draft submissions" on "public"."submissions";

create policy "clients update their own draft submissions"
  on "public"."submissions"
  for update
  using (public.is_own_client_record(client_id) and draft = true)
  with check (
    public.is_own_client_record(client_id)
    and (draft = true or (info_attested_at is not null and public.is_own_client_record(info_attested_by)))
  );

-- A real gap in the policy above was found and fixed after this migration
-- had already been applied -- see
-- 20260904142743_close_submissions_broad_client_policy_gap.sql rather than
-- editing this file (already-applied migrations are immutable; Supabase
-- CLI tracks by filename, so editing this in place wouldn't have been
-- re-run anyway).

