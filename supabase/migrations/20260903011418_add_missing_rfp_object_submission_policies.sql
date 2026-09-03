-- Real root cause of "Failed to fetch" / "new row violates row-level
-- security policy" on the new production project's intake file upload,
-- found 2026-09-02: the same "created out-of-band before tracked
-- migrations existed" gap as the missing rfp-documents bucket
-- (20260903002555), but for storage.objects RLS POLICIES instead of the
-- bucket row. Confirmed directly, not assumed:
--
-- can_access_rfp_object() (the function checking submission ownership via
-- storage.foldername(name)[1] = submissions.id) already existed on the new
-- project — it's a public-schema function, so it got swept into the
-- schema.sql dump/migration replay like everything else. But the actual
-- storage.objects POLICY rows that USE that function were never captured
-- in any migration file at all (grepped every migration — zero
-- `can_access_rfp_object`-based CREATE POLICY anywhere), because they were
-- created directly via the dashboard on the original project before this
-- discipline existed. Comparing pg_policies on both projects directly
-- confirmed it: dev has 8 rfp-documents policies (4 client-scoped + 4
-- submission-scoped), the new project only got the 4 client-scoped ones
-- that DID happen to get captured in 20260831210857_fix_rfp_documents_storage_rls.sql.
--
-- Real file uploads (IntakeWizard's "Your bid file" step, via
-- SubmissionDocuments.tsx) store under `${submissionId}/...` — exactly the
-- path shape only the missing submission-scoped policies recognize.
-- Certification/company-profile uploads use `${clientId}/...` and were
-- never actually broken, since those policies WERE captured.
--
-- DROP POLICY IF EXISTS + CREATE makes this safe to also replay against
-- the dev project, where these 4 already exist identically — a genuine
-- no-op there, not a behavior change.
drop policy if exists "access rfp-documents via the owning submission" on storage.objects;
create policy "access rfp-documents via the owning submission"
  on storage.objects for select to authenticated
  using (bucket_id = 'rfp-documents' and can_access_rfp_object(name));

drop policy if exists "upload to rfp-documents via the owning submission" on storage.objects;
create policy "upload to rfp-documents via the owning submission"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'rfp-documents' and can_access_rfp_object(name));

drop policy if exists "update rfp-documents via the owning submission" on storage.objects;
create policy "update rfp-documents via the owning submission"
  on storage.objects for update to authenticated
  using (bucket_id = 'rfp-documents' and can_access_rfp_object(name));

drop policy if exists "delete rfp-documents via the owning submission" on storage.objects;
create policy "delete rfp-documents via the owning submission"
  on storage.objects for delete to authenticated
  using (bucket_id = 'rfp-documents' and can_access_rfp_object(name));
