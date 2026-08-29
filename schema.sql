-- ============================================================================
-- Open SpecWright — Schema
-- Replaces the old self-serve BidPulse schema entirely. This is a clean
-- restart per the migration decision: drop everything old, run this fresh.
-- ============================================================================

-- ---------- Reset (only if migrating from old BidPulse — skip on a brand new project) ----------
drop table if exists submission_documents, deliverables, checklist_items, admin_notes,
  matched_opportunities, submissions, packages, clients, audit_log, notifications,
  support_tickets, api_keys, team_members, organizations cascade;

create extension if not exists "uuid-ossp";

-- ---------- Roles ----------
-- Only two roles now: admin (you/your team, sees every client) and
-- client (a contractor, sees only their own submission).
create type user_role as enum ('admin', 'client');

-- ---------- Pilot timeline stages ----------
create type submission_stage as enum (
  'submitted',           -- client finished intake
  'in_review',           -- admin reviewing the RFP
  'deliverables_ready',  -- capability statement / compliance matrix / narrative prepared
  'client_review',       -- client reviewing the deliverables
  'confirmed_submitted', -- admin confirmed the bid was actually submitted to the agency
  'closed'                -- review/credit decision made
);

create type checklist_status as enum ('not_started', 'in_progress', 'done', 'waived');

-- ---------- Your business (single row, but kept as a table for future team growth) ----------
create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz not null default now()
);

-- ---------- Your team (admin/staff who work the intake inbox) ----------
create table team_members (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role user_role not null default 'admin',
  created_at timestamptz not null default now(),
  unique (org_id, auth_user_id)
);

-- ---------- Clients (each contractor who submits intake) ----------
create table clients (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete cascade, -- null until they create a login
  company_name text not null,
  contact_name text not null,
  email text not null,
  phone text,
  naics_codes text[] default '{}',
  small_business_statuses text[] default '{}', -- e.g. 'WOSB', 'SDVOSB', '8(a)'
  set_asides text[] default '{}',
  trade_keywords text[] default '{}', -- for matching scraped opportunities to this client
  created_at timestamptz not null default now()
);

-- ---------- Packages (what a client purchased or is piloting) ----------
create table packages (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  package_type text not null default 'pilot', -- 'one_off' | 'retainer' | 'pilot' | 'test'
  price_note text,                             -- manual invoicing for now, just a note/amount
  is_test boolean not null default false,      -- internal rehearsal, excluded from revenue reporting
  created_at timestamptz not null default now()
);

-- ---------- Submissions (one RFP intake — the core record) ----------
create table submissions (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  package_id uuid references packages(id) on delete set null,
  agency text not null,
  solicitation_number text,
  due_date timestamptz,
  scope text,
  stage submission_stage not null default 'submitted',
  is_test boolean not null default false,
  draft boolean not null default true,        -- true until client locks/submits
  draft_saved_at timestamptz,
  submitted_at timestamptz,
  confirmation_sent_at timestamptz, -- Step 9: post-submission confirmation email,
                                     -- marked manually until real email sending is wired up
  created_at timestamptz not null default now()
);

-- ---------- Submission documents (the client's uploaded RFP file, etc.) ----------
create table submission_documents (
  id uuid primary key default uuid_generate_v4(),
  submission_id uuid not null references submissions(id) on delete cascade,
  document_type text not null,   -- 'rfp_file' | 'other'
  file_name text not null,
  file_url text not null,
  created_at timestamptz not null default now()
);

-- ---------- Deliverables (what admin prepares for the client) ----------
create table deliverables (
  id uuid primary key default uuid_generate_v4(),
  submission_id uuid not null references submissions(id) on delete cascade,
  deliverable_type text not null, -- 'capability_statement' | 'compliance_matrix' | 'technical_narrative'
  file_url text,
  content text,                   -- for deliverables generated/edited as text rather than a file
  prepared_by uuid references team_members(id),
  created_at timestamptz not null default now()
);

-- ---------- Compliance-readiness checklist (per submission) ----------
create table checklist_items (
  id uuid primary key default uuid_generate_v4(),
  submission_id uuid not null references submissions(id) on delete cascade,
  label text not null,
  status checklist_status not null default 'not_started',
  notes text,
  updated_at timestamptz not null default now()
);

-- ---------- Admin's internal notes (never shown to the client) ----------
create table admin_notes (
  id uuid primary key default uuid_generate_v4(),
  submission_id uuid not null references submissions(id) on delete cascade,
  author_id uuid references team_members(id),
  note text not null,
  created_at timestamptz not null default now()
);

-- ---------- Matched opportunities (scraper output — admin-curated, not client-facing directly) ----------
create table matched_opportunities (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  assigned_client_id uuid references clients(id) on delete set null, -- null until admin assigns it
  source_title text not null,
  source_agency text not null,
  source_url text, -- link back to the original listing, for admin review before assigning
  due_date timestamptz,
  match_score numeric,
  status text not null default 'new', -- 'new' | 'assigned' | 'dismissed'
  created_at timestamptz not null default now()
);

-- ---------- Immutable audit log ----------
create table audit_log (
  id uuid primary key default uuid_generate_v4(),
  submission_id uuid references submissions(id) on delete set null,
  org_id uuid not null references organizations(id) on delete cascade,
  actor_id uuid references team_members(id),
  event_type text not null,
  event_detail jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Row Level Security
-- Admins see everything in their org. Clients see only their own submissions.
-- ============================================================================
alter table organizations enable row level security;
alter table team_members enable row level security;
alter table clients enable row level security;
alter table packages enable row level security;
alter table submissions enable row level security;
alter table submission_documents enable row level security;
alter table deliverables enable row level security;
alter table checklist_items enable row level security;
alter table admin_notes enable row level security;
alter table matched_opportunities enable row level security;
alter table audit_log enable row level security;

create or replace function is_admin(target_org_id uuid)
returns boolean as $$
  select exists (
    select 1 from team_members
    where org_id = target_org_id and auth_user_id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable set search_path = public;

create or replace function is_own_client_record(target_client_id uuid)
returns boolean as $$
  select exists (
    select 1 from clients
    where id = target_client_id and auth_user_id = auth.uid()
  );
$$ language sql security definer stable set search_path = public;

-- security definer so this existence check bypasses team_members' own SELECT
-- policy (is_admin-gated) — otherwise a non-admin querying it would see zero
-- rows regardless of the org's real state, defeating the check below.
create or replace function org_has_admin(target_org_id uuid)
returns boolean as $$
  select exists (select 1 from team_members where org_id = target_org_id);
$$ language sql security definer stable set search_path = public;

-- organizations / team_members: same bootstrap pattern as before
create policy "any authenticated user can create an organization" on organizations
  for insert with check (auth.uid() is not null);
create policy "admins can read their organization" on organizations
  for select using (is_admin(id));
-- Any authenticated user can also just read organizations (not only admins):
-- the client intake wizard looks up "the" org id before a clients row (and
-- therefore is_own_client_record) exists yet, so it can't be admin-gated.
-- Safe in this single-tenant model — id/name of your own business, nothing
-- sensitive, and no other org's data is reachable through it.
create policy "authenticated users can read organizations" on organizations
  for select using (auth.uid() is not null);
-- Only allows creating the FIRST team_members row for a given org (the
-- legitimate admin-signup bootstrap, before is_admin() has anything to
-- check yet) — without org_has_admin(), any authenticated user (including
-- a client) could insert {org_id: <your org>, role: 'admin'} for themselves
-- and gain full admin access to your organization.
create policy "a user can bootstrap the first team_members row for a new org" on team_members
  for insert with check (auth_user_id = auth.uid() and not org_has_admin(org_id));
create policy "admins can read team_members in their org" on team_members
  for select using (is_admin(org_id));

-- clients: admins see all clients in their org; a client sees only their own row
create policy "admins read all clients" on clients
  for select using (is_admin(org_id));
create policy "admins manage clients" on clients
  for all using (is_admin(org_id));
-- Direct column comparison, not is_own_client_record(id) — that function's
-- subquery selects from clients itself, and a same-table self-referencing
-- RLS check evaluated as the RETURNING-visibility step right after an
-- INSERT into that same table is a known Postgres/PostgREST rough edge
-- (confirmed live: the identical insert succeeds with Prefer: return=minimal,
-- and is_own_client_record() returns true when called standalone via RPC for
-- the same row — it only fails embedded in the INSERT...RETURNING path).
-- auth_user_id is a plain column on this row, so no subquery is needed here
-- at all — is_own_client_record() stays as-is for every OTHER table, which
-- call it cross-table (checking clients from a different table's policy).
create policy "clients read their own record" on clients
  for select using (auth_user_id = auth.uid());
-- Without this, the intake wizard's "About you" step (a brand-new client
-- inserting their own row) fails RLS every time — is_own_client_record()
-- can't authorize an insert of the very row it would check against.
create policy "a client can insert their own record" on clients
  for insert with check (auth_user_id = auth.uid());

-- packages: admin-write, client read-only on their own (had RLS enabled
-- above but no policies, which meant every query returned zero rows for
-- everyone — needed for the client dashboard's package-info card)
create policy "admins manage packages" on packages
  for all using (exists (select 1 from clients c where c.id = client_id and is_admin(c.org_id)));
create policy "clients read their own packages" on packages
  for select using (is_own_client_record(client_id));

-- submissions: admins see all in their org (via client); client sees only their own
create policy "admins read all submissions" on submissions
  for select using (exists (select 1 from clients c where c.id = client_id and is_admin(c.org_id)));
create policy "admins manage submissions" on submissions
  for all using (exists (select 1 from clients c where c.id = client_id and is_admin(c.org_id)));
-- Clients get three narrower policies instead of one FOR ALL: MIGRATION-
-- TO-SPECWRIGHT.md is explicit that the client side is a "read-only status
-- view" once submitted — a single unrestricted FOR ALL would let a client
-- call the API directly to rewrite stage, confirmation_sent_at, is_test,
-- etc. at any time, not just during their own intake.
create policy "clients read their own submissions" on submissions
  for select using (is_own_client_record(client_id));
create policy "clients insert their own submissions" on submissions
  for insert with check (is_own_client_record(client_id));
-- USING is checked against the row's state *before* the update, so this
-- still allows the exact transition intake needs (draft: true -> false on
-- final submit) but permanently locks the row from further client writes
-- the moment it's no longer a draft — no DELETE policy for clients at all.
create policy "clients update their own draft submissions" on submissions
  for update using (is_own_client_record(client_id) and draft = true)
  with check (is_own_client_record(client_id));

-- submission_documents: inherits access through the submission's client
create policy "access submission_documents via submission" on submission_documents
  for all using (
    exists (
      select 1 from submissions s join clients c on c.id = s.client_id
      where s.id = submission_id and (is_admin(c.org_id) or is_own_client_record(c.id))
    )
  );

-- deliverables: clients can READ (not write) their own; admins do everything
create policy "admins manage deliverables" on deliverables
  for all using (
    exists (select 1 from submissions s join clients c on c.id = s.client_id
            where s.id = submission_id and is_admin(c.org_id))
  );
create policy "clients read their own deliverables" on deliverables
  for select using (
    exists (select 1 from submissions s where s.id = submission_id and is_own_client_record(s.client_id))
  );

-- checklist_items: same admin-write / client-read split
create policy "admins manage checklist_items" on checklist_items
  for all using (
    exists (select 1 from submissions s join clients c on c.id = s.client_id
            where s.id = submission_id and is_admin(c.org_id))
  );
create policy "clients read their own checklist_items" on checklist_items
  for select using (
    exists (select 1 from submissions s where s.id = submission_id and is_own_client_record(s.client_id))
  );

-- admin_notes: admin-only, never visible to clients
create policy "admins only on admin_notes" on admin_notes
  for all using (
    exists (select 1 from submissions s join clients c on c.id = s.client_id
            where s.id = submission_id and is_admin(c.org_id))
  );

-- matched_opportunities: admin-only (clients see their assigned ones through
-- their own submissions once converted, not through this table directly)
create policy "admins manage matched_opportunities" on matched_opportunities
  for all using (is_admin(org_id));

-- audit_log: insert-only, admin-read. Clients are restricted to the one
-- event_type the app actually has them log (submission_locked, from the
-- intake wizard's final submit) — without this, a client could insert
-- arbitrary event_type/event_detail rows against their own submission_id
-- (harmless to real state, since audit_log doesn't drive anything, but
-- still forged entries in what's supposed to be a trustworthy log).
create policy "admins read audit_log" on audit_log
  for select using (is_admin(org_id));
create policy "insert audit_log" on audit_log
  for insert with check (
    is_admin(org_id) or (
      event_type = 'submission_locked'
      and exists (
        select 1 from submissions s where s.id = submission_id and is_own_client_record(s.client_id)
      )
    )
  );

-- ---------- Storage bucket ----------
insert into storage.buckets (id, name, public) values ('rfp-documents', 'rfp-documents', true)
on conflict (id) do nothing;

-- storage.objects has RLS enabled by default with no policies, which
-- blocked every upload (submission_documents' RFP file, and deliverables'
-- prepared files) even though the bucket itself is public. "Public" only
-- lets a *known* object URL bypass auth for GET — it says nothing about
-- who can list the bucket's contents or upload/overwrite/delete objects,
-- both of which still need explicit policies here.
--
-- Every upload path in the app (SubmissionDocuments.tsx, DeliverablesPanel)
-- names objects as "<submissionId>/...", so storage.foldername(name)[1] is
-- always that submission's id — scoping on it mirrors the same admin-or-
-- owning-client check used on the deliverables/submission_documents tables,
-- instead of granting any authenticated user (i.e. any client) blanket
-- read/write over every other client's files.
create or replace function can_access_rfp_object(object_name text)
returns boolean as $$
  select exists (
    select 1 from submissions s join clients c on c.id = s.client_id
    where s.id::text = (storage.foldername(object_name))[1]
      and (is_admin(c.org_id) or is_own_client_record(c.id))
  );
$$ language sql security definer stable set search_path = public;

create policy "access rfp-documents via the owning submission" on storage.objects
  for select to authenticated using (bucket_id = 'rfp-documents' and can_access_rfp_object(name));
create policy "upload to rfp-documents via the owning submission" on storage.objects
  for insert to authenticated with check (bucket_id = 'rfp-documents' and can_access_rfp_object(name));
create policy "update rfp-documents via the owning submission" on storage.objects
  for update to authenticated using (bucket_id = 'rfp-documents' and can_access_rfp_object(name));
create policy "delete rfp-documents via the owning submission" on storage.objects
  for delete to authenticated using (bucket_id = 'rfp-documents' and can_access_rfp_object(name));
