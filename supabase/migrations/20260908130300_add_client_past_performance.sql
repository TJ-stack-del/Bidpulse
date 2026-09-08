-- Real place for the two "Past Performance" bracket rows every capability
-- statement auto-draft leaves unfilled (see generate-draft/route.ts's own
-- comment: "this app doesn't collect past-project data anywhere yet").
-- Client-name, scope, contract value, and outcome are facts about the
-- CLIENT (reusable across every future bid), not this one bid -- same
-- reasoning that put differentiators on clients rather than submissions.
--
-- Self-reported, used as-is, no "verified" gate the way client_certifications
-- has: a certification is a specific official credential whose misuse
-- carries real weight, but a past-performance reference is closer to how
-- differentiators already works (free text taken at face value) -- normal
-- capability-statement practice, and the agency can always call the
-- reference themselves if they want to confirm it. contract_value is text,
-- not numeric, matching every other money-shaped field in this schema
-- (general_liability_coverage, workers_comp_coverage, price_note) --
-- clients write "$185,000" or "$1.2M/yr, ongoing" in their own words, this
-- app never does arithmetic on it.
create table "public"."client_past_performance" (
  "id" uuid primary key default "extensions"."uuid_generate_v4"(),
  "client_id" uuid not null references "public"."clients"("id") on delete cascade,
  "reference_client_name" text not null,
  "scope_of_work" text not null,
  "contract_value" text,
  "outcome" text,
  "created_at" timestamptz not null default now()
);

alter table "public"."client_past_performance" enable row level security;

create policy "clients manage their own past performance"
  on "public"."client_past_performance"
  for all
  using (public.is_own_client_record(client_id))
  with check (public.is_own_client_record(client_id));

create policy "admins read client_past_performance"
  on "public"."client_past_performance"
  for select
  using (
    exists (
      select 1 from "public"."clients" c
      where c.id = client_past_performance.client_id
        and public.is_admin(c.org_id)
    )
  );

grant all on table "public"."client_past_performance" to "anon";
grant all on table "public"."client_past_performance" to "authenticated";
grant all on table "public"."client_past_performance" to "service_role";
