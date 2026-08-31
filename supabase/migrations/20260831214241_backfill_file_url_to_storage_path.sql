-- Part of the rfp-documents storage-privacy migration (2026-08-31).
-- file_url columns previously stored a full public URL
-- (".../storage/v1/object/public/rfp-documents/<path>"); app code has been
-- switched to store and expect the bare path instead, generating a signed
-- URL at read time. This backfills existing rows so old uploads still
-- resolve once the bucket goes private.
--
-- Safe to run more than once: the WHERE clause only matches rows still in
-- the old public-URL format, so an already-backfilled (bare-path) row is a
-- no-op on a second run, and a NULL file_url is skipped entirely (NULL LIKE
-- ... is NULL, not true).

update "public"."submission_documents"
set file_url = regexp_replace(file_url, '^.*/storage/v1/object/public/rfp-documents/', '')
where file_url like '%/storage/v1/object/public/rfp-documents/%';

update "public"."deliverables"
set file_url = regexp_replace(file_url, '^.*/storage/v1/object/public/rfp-documents/', '')
where file_url like '%/storage/v1/object/public/rfp-documents/%';

update "public"."client_certifications"
set file_url = regexp_replace(file_url, '^.*/storage/v1/object/public/rfp-documents/', '')
where file_url like '%/storage/v1/object/public/rfp-documents/%';
