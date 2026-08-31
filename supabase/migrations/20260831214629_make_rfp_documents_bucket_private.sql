-- Final step of the rfp-documents storage-privacy migration (2026-08-31).
-- Run only after the backfill (20260831214241) and the corresponding app
-- code (path-based file_url + createSignedUrl at read time) are both live —
-- app code that still expects a public URL breaks the moment this runs.
--
-- Closes the last piece of the residual risk documented after the
-- 2026-08-31 storage RLS fix: with the bucket public, any file's direct URL
-- was fetchable by anyone who obtained it, independent of RLS. Every real
-- read path now goes through a signed URL generated per-request.
update storage.buckets set public = false where id = 'rfp-documents';
