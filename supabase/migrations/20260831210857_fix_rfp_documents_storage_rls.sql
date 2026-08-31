-- Storage RLS fix for the rfp-documents bucket, found during the
-- 2026-08-31 schema reconciliation.
--
-- Four legacy policies granted broad, ownership-blind access: any
-- authenticated user could upload/update/delete ANY file in this bucket
-- (not just their own), and anyone (role "public", no auth required) could
-- read any file via the storage.objects RLS path. The submission-scoped
-- policies added later (using can_access_rfp_object, keyed on submission
-- id) never replaced these broad ones, so they sat side by side —
-- Postgres OR's RLS policies together, so the broad grant fully overrode
-- the scoped one.
--
-- The certifications upload flow (app/dashboard/profile/CertificationsSection.tsx)
-- stores files under `${clientId}/certifications/...`, not a submission id,
-- so it was relying entirely on the broad policies — none of the
-- submission-scoped ones recognize a client-id-prefixed path. This
-- migration adds that missing client-scoped coverage before dropping the
-- broad policies, so certification uploads keep working.

create or replace function public.can_access_client_object(object_name text)
returns boolean
language sql stable security definer
set search_path = 'public'
as $$
  select exists (
    select 1 from clients c
    where c.id::text = (storage.foldername(object_name))[1]
      and (is_admin(c.org_id) or is_own_client_record(c.id))
  );
$$;

create policy "access rfp-documents via the owning client"
  on storage.objects for select to authenticated
  using (bucket_id = 'rfp-documents' and can_access_client_object(name));

create policy "upload rfp-documents via the owning client"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'rfp-documents' and can_access_client_object(name));

create policy "update rfp-documents via the owning client"
  on storage.objects for update to authenticated
  using (bucket_id = 'rfp-documents' and can_access_client_object(name));

create policy "delete rfp-documents via the owning client"
  on storage.objects for delete to authenticated
  using (bucket_id = 'rfp-documents' and can_access_client_object(name));

drop policy if exists "anyone can read rfp-documents" on storage.objects;
drop policy if exists "authenticated users can delete rfp-documents" on storage.objects;
drop policy if exists "authenticated users can update rfp-documents" on storage.objects;
drop policy if exists "authenticated users can upload to rfp-documents" on storage.objects;
