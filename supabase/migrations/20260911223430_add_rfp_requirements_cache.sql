-- Caches the result of extracting compliance-relevant requirements from a
-- submission's uploaded RFP document(s) (submission_documents rows with
-- document_type = 'rfp_file'), so generate-draft/route.ts's compliance
-- matrix can include real RFP-sourced rows without re-running a ~60s LLM
-- extraction on every single draft regeneration. jsonb array of
-- {requirement, detail} objects, same never-fabricate rule as every other
-- generated field in this app: extracted only from what the RFP document
-- itself actually states.
--
-- rfp_requirements_extracted_at is compared against the newest rfp_file
-- submission_documents.created_at at read time to invalidate the cache when
-- a new/replacement RFP file is uploaded after the last extraction.
alter table "public"."submissions"
  add column "rfp_requirements" jsonb,
  add column "rfp_requirements_extracted_at" timestamp with time zone;
