-- ============================================================================
-- BidPulse — Schema
-- Replaces the old self-serve BidPulse schema entirely. This is a clean
-- restart per the migration decision: drop everything old, run this fresh.
-- ============================================================================

-- ---------- Reset (only if migrating from old BidPulse — skip on a brand new project) ----------
drop table if exists submission_documents, deliverables, checklist_items, admin_notes,
  matched_opportunities, submissions, packages, clients, audit_log, notifications,
  support_tickets, api_keys, team_members, organizations cascade;

-- Custom types survive a DROP TABLE, so they have to be dropped
-- separately — covers both the old BidPulse types and this schema's own
-- types, so this whole file can be safely re-run.
drop type if exists user_role cascade;
drop type if exists bid_stage cascade;
drop type if exists bid_status cascade;
drop type if exists compliance_status cascade;
drop type if exists notification_type cascade;
drop type if exists submission_stage cascade;
drop type if exists checklist_status cascade;

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
  -- Company Profile fields (app/dashboard/profile) — filled in once by the
  -- client, reused as facts across every future bid instead of re-asking.
  license_number text,
  years_in_business integer,
  business_address text,
  business_phone text,
  insurance_provider text,
  insurance_policy_number text,
  general_liability_coverage text, -- free text: coverage amounts are commonly written as "$1M/$2M" pairs, not a single number
  workers_comp_coverage text,
  differentiators text, -- free text: "what sets us apart" / notable past projects
  created_at timestamptz not null default now()
);

-- ---------- Client certifications (structured, per-cert — supersedes the
-- old clients.small_business_statuses text[] for anything that needs to
-- know WHICH cert, its number/expiration, the actual document, and
-- whether an admin has actually verified it) ----------
create table client_certifications (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  cert_type text not null, -- '8(a)' | 'WOSB' | 'EDWOSB' | 'HUBZone' | 'SDVOSB' | 'VOSB' | 'Other'
  other_label text,        -- only set when cert_type = 'Other', e.g. 'MBE', 'DBE' (state/local certs)
  certification_number text,
  expiration_date date,
  file_url text,
  file_name text,
  verified boolean not null default false, -- admin must actually look at the document — never client-set
  verified_at timestamptz,
  verified_by uuid references team_members(id),
  created_at timestamptz not null default now()
);

-- ---------- Packages (what a client purchased or is piloting) ----------
create table packages (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  package_type text not null default 'pilot', -- 'one_off' | 'retainer' | 'pilot' | 'test'
  price_note text,                             -- manual invoicing for now, just a note/amount
  is_test boolean not null default false,      -- internal rehearsal, excluded from revenue reporting
  paid boolean not null default false,         -- gates deliverable downloads; set manually by admin for now
  paid_at timestamptz,
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), -- bumped explicitly on stage change; no auto-update trigger
  fit_alignment text,     -- 'strong' | 'moderate' | 'weak' — set once by /api/generate-fit-check right after client submit
  fit_explanation text,
  client_reported_submitted_at timestamptz -- client's own "I've submitted this" click; a claim to verify, never
                                            -- auto-trusted — admin still moves the stage to confirmed_submitted by hand
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
alter table client_certifications enable row level security;
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
$$ language sql security definer stable;

create or replace function is_own_client_record(target_client_id uuid)
returns boolean as $$
  select exists (
    select 1 from clients
    where id = target_client_id and auth_user_id = auth.uid()
  );
$$ language sql security definer stable;

-- organizations / team_members: same bootstrap pattern as before
create policy "any authenticated user can create an organization" on organizations
  for insert with check (auth.uid() is not null);
create policy "admins can read their organization" on organizations
  for select using (is_admin(id));
create policy "a user can insert their own team_members row" on team_members
  for insert with check (auth_user_id = auth.uid());
create policy "admins can read team_members in their org" on team_members
  for select using (is_admin(org_id));

-- clients: admins see all clients in their org; a client sees only their own row
create policy "admins read all clients" on clients
  for select using (is_admin(org_id));
create policy "admins manage clients" on clients
  for all using (is_admin(org_id));
create policy "clients read their own record" on clients
  for select using (is_own_client_record(id));
-- Previously read-only for a client — the new Company Profile page needs
-- them to actually be able to save their own profile fields.
create policy "clients update their own record" on clients
  for update using (is_own_client_record(id)) with check (is_own_client_record(id));

-- client_certifications: admin can do anything (including marking
-- verified); a client can manage their own certs (add/edit/delete/upload)
-- but the with check on their policy forces verified = false on any row
-- they write — the only way a row becomes verified is the separate admin
-- policy, i.e. an admin actually doing it. This is enforced at the data
-- layer, not just hidden in the UI: a client crafting a raw API call
-- can't set their own cert to verified.
create policy "admins manage client_certifications" on client_certifications
  for all using (
    exists (select 1 from clients c where c.id = client_id and is_admin(c.org_id))
  );
create policy "clients manage their own certifications" on client_certifications
  for all using (is_own_client_record(client_id))
  with check (is_own_client_record(client_id) and verified = false);

-- packages: admin-write (marking paid), client can only read their own —
-- same split as deliverables/checklist_items. RLS was enabled on this table
-- with no policies ever added, which under Postgres RLS means "nobody can
-- see any row, including admins" — PaymentStatus's toggle and the client
-- dashboard's paid check would both silently no-op/read-null the moment a
-- real package row exists, with no error to say why.
create policy "admins manage packages" on packages
  for all using (
    exists (select 1 from clients c where c.id = client_id and is_admin(c.org_id))
  );
create policy "clients read their own packages" on packages
  for select using (is_own_client_record(client_id));

-- submissions: admins see all in their org (via client); client sees only their own
create policy "admins read all submissions" on submissions
  for select using (exists (select 1 from clients c where c.id = client_id and is_admin(c.org_id)));
create policy "admins manage submissions" on submissions
  for all using (exists (select 1 from clients c where c.id = client_id and is_admin(c.org_id)));
create policy "clients manage their own submissions" on submissions
  for all using (is_own_client_record(client_id));

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

-- audit_log: insert-only, admin-read
create policy "admins read audit_log" on audit_log
  for select using (is_admin(org_id));
create policy "insert audit_log" on audit_log
  for insert with check (
    is_admin(org_id) or exists (
      select 1 from submissions s where s.id = submission_id and is_own_client_record(s.client_id)
    )
  );

-- ---------- Storage bucket ----------
insert into storage.buckets (id, name, public) values ('rfp-documents', 'rfp-documents', true)
on conflict (id) do nothing;
