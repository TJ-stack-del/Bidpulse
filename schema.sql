-- ============================================================================
-- BidPulse — Full Schema (Supabase / Postgres)
-- Extends the original PRD schema (bids, support_tickets) to cover the
-- 6-stage lifecycle, roles/permissions, compliance, audit trail, and
-- AI-matched opportunities shown in the mockups.
-- Run this in Supabase SQL Editor, top to bottom.
-- ============================================================================

-- ---------- Extensions ----------
create extension if not exists "uuid-ossp";

-- ---------- Enums ----------
create type user_role as enum ('platform_admin', 'contractor_owner', 'contractor_member', 'client_reviewer');
create type bid_stage as enum ('intake', 'compliance_review', 'assembly_drafting', 'admin_audit', 'client_review', 'submission');
create type bid_status as enum ('drafting', 'in_review', 'ready', 'submitted', 'awarded', 'lost', 'withdrawn');
create type compliance_status as enum ('not_started', 'in_progress', 'passed', 'failed', 'waived');
create type notification_type as enum ('new_match', 'compliance_alert', 'deadline', 'review_requested', 'ticket_update', 'audit_event');

-- ---------- Organizations & Team ----------
create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz not null default now()
);

create table team_members (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role user_role not null default 'contractor_member',
  avatar_url text,
  created_at timestamptz not null default now(),
  unique (org_id, auth_user_id)
);

create table role_permissions (
  role user_role primary key,
  can_view_admin boolean not null default false,
  can_view_margin_data boolean not null default false,
  can_sign_off boolean not null default false,
  can_manage_team boolean not null default false,
  can_export_audit_log boolean not null default false
);

insert into role_permissions (role, can_view_admin, can_view_margin_data, can_sign_off, can_manage_team, can_export_audit_log) values
  ('platform_admin', true, true, true, true, true),
  ('contractor_owner', false, true, true, true, false),
  ('contractor_member', false, false, false, false, false),
  ('client_reviewer', false, false, false, false, false);

-- ---------- Bids (extended core entity) ----------
create table bids (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  agency text not null,
  solicitation_number text,
  due_date timestamptz,
  estimated_value_low numeric,
  estimated_value_high numeric,
  scope text,
  stage bid_stage not null default 'intake',
  status bid_status not null default 'drafting',
  fit_score numeric,                    -- 0-100, from Fit Evaluator rubric
  match_score numeric,                  -- 0-100, AI-driven matched-opportunity score
  scoring_breakdown jsonb,
  document_url text,
  document_name text,
  pia_attested boolean not null default false,   -- Procurement Integrity Act attestation
  pia_attested_at timestamptz,
  pia_attested_by uuid references team_members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Matched Opportunities (AI-driven discovery) ----------
-- NOTE: per the PRD's out-of-scope constraint, matching runs against
-- manually-logged solicitations only — no external scraping bots.
create table matched_opportunities (
  id uuid primary key default uuid_generate_v4(),
  bid_id uuid references bids(id) on delete set null,
  org_id uuid not null references organizations(id) on delete cascade,
  source_title text not null,
  source_agency text not null,
  naics_codes text[],
  match_score numeric not null,          -- 0-100
  match_rationale text,                  -- short explanation of why it matched
  status text not null default 'new',    -- new | reviewed | converted_to_bid | dismissed
  created_at timestamptz not null default now()
);

-- ---------- Compliance Matrix ----------
create table compliance_items (
  id uuid primary key default uuid_generate_v4(),
  bid_id uuid not null references bids(id) on delete cascade,
  clause_reference text not null,        -- e.g. FAR 52.219-14
  requirement text not null,
  status compliance_status not null default 'not_started',
  notes text,
  reviewed_by uuid references team_members(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- Deliverables / Drafted Artifacts ----------
create table deliverables (
  id uuid primary key default uuid_generate_v4(),
  bid_id uuid not null references bids(id) on delete cascade,
  artifact_type text not null,           -- capability_statement | technical_narrative | pricing_sheet | ...
  title text not null,
  file_url text,
  version integer not null default 1,
  signed_off boolean not null default false,
  signed_off_by uuid references team_members(id),
  signed_off_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- Client Review & Feedback ----------
create table client_reviews (
  id uuid primary key default uuid_generate_v4(),
  bid_id uuid not null references bids(id) on delete cascade,
  reviewer_id uuid references team_members(id),
  deliverable_id uuid references deliverables(id),
  feedback text,
  decision text,                          -- approved | changes_requested
  created_at timestamptz not null default now()
);

-- ---------- Submission Execution ----------
create table submissions (
  id uuid primary key default uuid_generate_v4(),
  bid_id uuid not null references bids(id) on delete cascade unique,
  submitted_by uuid references team_members(id),
  submission_method text,                 -- portal | email | hand_delivery
  confirmation_number text,
  sealed_document_url text,
  submitted_at timestamptz not null default now()
);

-- ---------- Immutable Audit Log ----------
-- Append-only by design: no update/delete policy is granted below.
create table audit_log (
  id uuid primary key default uuid_generate_v4(),
  bid_id uuid references bids(id) on delete set null,
  org_id uuid not null references organizations(id) on delete cascade,
  actor_id uuid references team_members(id),
  event_type text not null,               -- stage_change, attestation, sign_off, submission, export, etc.
  event_detail jsonb,
  created_at timestamptz not null default now()
);

-- ---------- Notifications ----------
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  recipient_id uuid references team_members(id),
  type notification_type not null,
  title text not null,
  body text,
  bid_id uuid references bids(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- Support Tickets (from original PRD) ----------
create table support_tickets (
  id uuid primary key default uuid_generate_v4(),
  bid_id uuid references bids(id) on delete set null,
  org_id uuid not null references organizations(id) on delete cascade,
  type text not null,
  message text not null,
  created_at timestamptz not null default now()
);

-- ---------- API Keys (for the API Documentation / rate-limiting screens) ----------
create table api_keys (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  key_prefix text not null,
  hashed_key text not null,
  rate_limit_per_min integer not null default 60,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

-- ============================================================================
-- Row Level Security
-- Every org-scoped table is locked to members of that org. audit_log gets
-- insert-only policies (no update/delete) to keep it a true audit trail.
-- ============================================================================
alter table organizations enable row level security;
alter table team_members enable row level security;
alter table bids enable row level security;
alter table matched_opportunities enable row level security;
alter table compliance_items enable row level security;
alter table deliverables enable row level security;
alter table client_reviews enable row level security;
alter table submissions enable row level security;
alter table audit_log enable row level security;
alter table notifications enable row level security;
alter table support_tickets enable row level security;
alter table api_keys enable row level security;

-- Helper: does auth.uid() belong to this org?
create or replace function is_org_member(target_org_id uuid)
returns boolean as $$
  select exists (
    select 1 from team_members
    where org_id = target_org_id and auth_user_id = auth.uid()
  );
$$ language sql security definer stable;

-- Organizations & team_members: no policies existed here before, which
-- combined with `enable row level security` above meant every insert/select
-- was silently denied — including the signup flow's own
-- organizations/team_members inserts. is_org_member() is security definer,
-- so the team_members select policy referencing team_members itself doesn't
-- recurse into RLS.
--
-- NOTE: the team_members insert check only proves the row is self-owned
-- (auth_user_id = auth.uid()), not that auth.uid() was invited to org_id —
-- there's no invite-code table yet, so any authenticated user can currently
-- join any org_id they already know. Fine for self-serve signup (a brand
-- new org they just created), but add an invite check before opening this
-- up to joining *existing* orgs.
create policy "authenticated users can create an organization" on organizations
  for insert with check (auth.uid() is not null);
create policy "org members read own organization" on organizations
  for select using (is_org_member(id));

create policy "users can create their own team_member row" on team_members
  for insert with check (auth_user_id = auth.uid());
create policy "org members read team_members" on team_members
  for select using (is_org_member(org_id));

-- Helpers for the Phase 8 settings pages — same security-definer pattern as
-- is_org_member() above, so referencing team_members/role_permissions from
-- inside a policy on those same tables doesn't recurse.
create or replace function can_manage_team()
returns boolean as $$
  select exists (
    select 1 from team_members tm
    join role_permissions rp on rp.role = tm.role
    where tm.auth_user_id = auth.uid() and rp.can_manage_team = true
  );
$$ language sql security definer stable;

create or replace function is_platform_admin()
returns boolean as $$
  select exists (
    select 1 from team_members tm
    join role_permissions rp on rp.role = tm.role
    where tm.auth_user_id = auth.uid() and rp.can_view_admin = true
  );
$$ language sql security definer stable;

-- /settings/team lets can_manage_team members (platform_admin,
-- contractor_owner) edit another member's role within their own org, and
-- add a team_members row for a user someone already created directly in
-- Supabase Auth (README step 12's manual process, minus the Table Editor
-- step) — the self-insert policy above only lets a user add *themselves*.
create policy "team managers can update team_members" on team_members
  for update using (is_org_member(org_id) and can_manage_team());
create policy "team managers can add team members" on team_members
  for insert with check (is_org_member(org_id) and can_manage_team());

-- /profile lets any user edit their own team_members row (full_name,
-- avatar_url). A plain `auth_user_id = auth.uid()` USING clause would also
-- let someone PATCH their own `role`/`org_id`/`email` directly (RLS can't
-- restrict individual columns in a USING/CHECK clause), so a trigger
-- pins those columns back to their old value unless the updater already
-- has can_manage_team() — that's the same privilege /settings/team's role
-- editor requires, so managers editing their own row are unaffected.
create policy "users can update their own team_member row" on team_members
  for update using (auth_user_id = auth.uid());

create or replace function protect_team_member_privileged_columns()
returns trigger as $$
begin
  if not can_manage_team() then
    new.role := old.role;
    new.org_id := old.org_id;
    new.auth_user_id := old.auth_user_id;
    new.email := old.email;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists team_members_protect_privileged_columns on team_members;
create trigger team_members_protect_privileged_columns
  before update on team_members
  for each row execute function protect_team_member_privileged_columns();

-- role_permissions had no RLS at all (any table without `enable row level
-- security` is fully open) — reads were fine since every page's permission
-- check depends on it being readable, but that also meant any authenticated
-- user could rewrite the whole platform's permission matrix. Lock writes to
-- platform_admin (via /settings/roles) and keep reads open to anyone signed
-- in, since that's the access every permission check in this app already
-- assumes.
alter table role_permissions enable row level security;
create policy "authenticated users can read role_permissions" on role_permissions
  for select using (auth.uid() is not null);
create policy "platform admins can update role_permissions" on role_permissions
  for update using (is_platform_admin());

-- api_keys: reads open to any org member (metadata only — hashed_key is
-- never selected by the app), writes limited to can_manage_team since a key
-- is an org-wide integration credential, not a personal one.
create policy "org members read api_keys" on api_keys
  for select using (is_org_member(org_id));
create policy "team managers write api_keys" on api_keys
  for insert with check (is_org_member(org_id) and can_manage_team());
create policy "team managers update api_keys" on api_keys
  for update using (is_org_member(org_id) and can_manage_team());

-- notifications: select existed, but nothing let a recipient mark their own
-- notification read.
create policy "org members update notifications" on notifications
  for update using (is_org_member(org_id));

create policy "org members read own org bids" on bids
  for select using (is_org_member(org_id));
create policy "org members write own org bids" on bids
  for insert with check (is_org_member(org_id));
create policy "org members update own org bids" on bids
  for update using (is_org_member(org_id));

-- Repeat the same read/write pattern for the other org-scoped tables.
create policy "org members read matched_opportunities" on matched_opportunities for select using (is_org_member(org_id));
create policy "org members write matched_opportunities" on matched_opportunities for insert with check (is_org_member(org_id));
create policy "org members update matched_opportunities" on matched_opportunities for update using (is_org_member(org_id));

create policy "org members read notifications" on notifications for select using (is_org_member(org_id));
create policy "org members read support_tickets" on support_tickets for select using (is_org_member(org_id));
create policy "org members write support_tickets" on support_tickets for insert with check (is_org_member(org_id));

-- Audit log: insert-only, no update/delete policy exists for anyone.
create policy "org members read audit_log" on audit_log for select using (is_org_member(org_id));
create policy "org members insert audit_log" on audit_log for insert with check (is_org_member(org_id));

-- compliance_items / deliverables / client_reviews / submissions inherit
-- org scope through their parent bid — join to bids for the check.
create policy "org members read compliance_items" on compliance_items
  for select using (exists (select 1 from bids b where b.id = bid_id and is_org_member(b.org_id)));
create policy "org members write compliance_items" on compliance_items
  for all using (exists (select 1 from bids b where b.id = bid_id and is_org_member(b.org_id)));

create policy "org members read deliverables" on deliverables
  for select using (exists (select 1 from bids b where b.id = bid_id and is_org_member(b.org_id)));
create policy "org members write deliverables" on deliverables
  for all using (exists (select 1 from bids b where b.id = bid_id and is_org_member(b.org_id)));

-- client_reviews: RLS was enabled above (line ~200) with no policies, same
-- gap the organizations/team_members/matched_opportunities tables had —
-- insert-only (like audit_log) since decisions are kept as a history, not
-- overwritten in place; latest-per-deliverable is computed in app code.
create policy "org members read client_reviews" on client_reviews
  for select using (exists (select 1 from bids b where b.id = bid_id and is_org_member(b.org_id)));
create policy "org members insert client_reviews" on client_reviews
  for insert with check (exists (select 1 from bids b where b.id = bid_id and is_org_member(b.org_id)));

-- submissions: same gap as client_reviews — the comment above already
-- claimed this table "inherits org scope through their parent bid" but no
-- policy was ever written. Insert + select only: the unique(bid_id)
-- constraint already prevents re-submission, so there's nothing to update.
create policy "org members read submissions" on submissions
  for select using (exists (select 1 from bids b where b.id = bid_id and is_org_member(b.org_id)));
create policy "org members insert submissions" on submissions
  for insert with check (exists (select 1 from bids b where b.id = bid_id and is_org_member(b.org_id)));

-- ---------- Storage bucket (run once) ----------
insert into storage.buckets (id, name, public) values ('rfp-documents', 'rfp-documents', true)
on conflict (id) do nothing;
