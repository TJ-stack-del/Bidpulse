-- Correction to 20260912110038: revoking EXECUTE from anon/authenticated
-- alone did NOT actually close off these two functions -- verified via a
-- real RPC call against production (both still returned a normal `false`
-- response instead of a permission error). Root cause: PostgreSQL grants
-- EXECUTE on a newly created function to the PUBLIC pseudo-role by
-- default, and the original baseline migration never revoked that. Every
-- real role (including anon/authenticated) inherits PUBLIC's grants
-- regardless of any role-specific revoke, so the previous migration only
-- ever removed a redundant, second grant path while the PUBLIC one stayed
-- fully open the whole time.
revoke execute on function public.is_org_member(uuid) from public;
revoke execute on function public.org_has_admin(uuid) from public;
