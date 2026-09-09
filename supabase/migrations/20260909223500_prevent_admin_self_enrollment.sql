-- BidPulse is a single-tenant service. Admin accounts and organization
-- memberships must be provisioned through a trusted service-role process,
-- never directly by an authenticated browser session.
--
-- The original policies allowed any signed-in user to:
--   1. read the existing organization id,
--   2. insert their own team_members row for that organization, and
--   3. receive the table's default `admin` role.
--
-- Because permissive RLS policies are ORed, the broad self-insert policy
-- also bypassed the narrower "first member only" bootstrap policy.

begin;

drop policy if exists
  "a user can insert their own team_members row"
  on public.team_members;

drop policy if exists
  "a user can bootstrap the first team_members row for a new org"
  on public.team_members;

drop policy if exists
  "any authenticated user can create an organization"
  on public.organizations;

-- Defense in depth: even if a permissive policy is accidentally introduced
-- later, the public API roles still cannot insert these security-sensitive
-- rows. The service_role retains its existing privileges for trusted
-- provisioning and recovery.
revoke insert on table public.team_members from anon, authenticated;
revoke insert on table public.organizations from anon, authenticated;

commit;
