-- Supabase's own security linter (function_search_path_mutable) flagged
-- is_org_member as the one function missing a pinned search_path, out of
-- six near-identical SECURITY DEFINER helpers (can_access_client_object,
-- can_access_rfp_object, is_admin, is_own_client_record, org_has_admin
-- all already have `SET "search_path" TO 'public'`; confirmed by reading
-- every one of their real definitions in schema.sql before writing this).
-- A SECURITY DEFINER function runs with its owner's privileges but
-- resolves any unqualified identifier using the CALLER's search_path
-- unless pinned -- a caller with a writable schema earlier in their own
-- search_path could otherwise get this function to resolve `team_members`
-- to an attacker-controlled table/view of the same unqualified name
-- instead of the real public.team_members. Pinning it here closes that
-- for real, matching every sibling function's own existing definition.
create or replace function public.is_org_member(target_org_id uuid) returns boolean
    language sql stable security definer
    set search_path to 'public'
    as $$
  select exists (
    select 1 from team_members
    where org_id = target_org_id and auth_user_id = auth.uid()
  );
$$;
