-- Compliance & Licensing Vault, Phase 1: split client_certifications into
-- categories so the client-facing UI can group "State Licensing & Trade
-- Boards" (a Master Electrician license, a Low Voltage Contractor license)
-- separately from "Small Business & Field Certifications" (8(a), WOSB,
-- etc.) without inventing a second table -- the existing cert_type/
-- certification_number/expiration_date/file_url/verified* columns and the
-- whole admin verify workflow (ClientCertifications.tsx) already cover both
-- shapes; only the grouping key and two license-specific fields are new.
--
-- DEFAULT 'small_business_cert' on record_type backfills every existing row
-- correctly: every cert_type on file today (8(a), WOSB, EDWOSB, HUBZone,
-- SDVOSB, VOSB, JSEB, DBE/SDB, Other) is a small-business/socioeconomic
-- certification, never a trade license -- there is nothing to migrate.
ALTER TABLE "public"."client_certifications"
  ADD COLUMN "record_type" "text" NOT NULL DEFAULT 'small_business_cert',
  ADD COLUMN "jurisdiction_state" "text",
  ADD COLUMN "licensing_board" "text";

ALTER TABLE "public"."client_certifications"
  ADD CONSTRAINT "client_certifications_record_type_check"
  CHECK ("record_type" IN ('trade_license', 'small_business_cert', 'field_certification'));

COMMENT ON COLUMN "public"."client_certifications"."record_type" IS
  'Groups rows for the client-facing Compliance Vault UI: trade_license (a state-issued trade license like Master Electrician), small_business_cert (8(a)/WOSB/etc.), or field_certification (e.g. OSHA 30, EPA 608). Does not change the verify workflow, which applies uniformly across all three.';
COMMENT ON COLUMN "public"."client_certifications"."jurisdiction_state" IS
  'State that issued the license, only meaningful when record_type = trade_license.';
COMMENT ON COLUMN "public"."client_certifications"."licensing_board" IS
  'Issuing board/authority (e.g. "State DBPR Div. 4"), only meaningful when record_type = trade_license.';
