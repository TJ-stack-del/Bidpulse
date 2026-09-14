-- Compliance & Licensing Vault, Phase 4: past-performance schema additions
-- + a real, scoped verification path. The mockup labels this "Verified
-- Past Performance," but client_past_performance was deliberately built
-- self-reported with no admin gate (see 20260908130300's own comment).
-- Resolved as a hybrid rather than either extreme: real federal contract
-- awards ARE genuinely public and lookup-able (USASpending.gov has a real,
-- free, no-auth API for this), but there's no equivalent public source for
-- state/local/school-district awards, which is most of this app's actual
-- client work (Jacksonville, Austin ISD, etc. in the example RFPs this
-- app already handles) -- so verification_status defaults to
-- 'self_reported' and stays there unless a real USASpending match is
-- found, never presented as "Verified" on a guess.
ALTER TABLE "public"."client_past_performance"
  ADD COLUMN "photo_url" "text",
  ADD COLUMN "photo_file_name" "text",
  ADD COLUMN "prime_gc_name" "text",
  ADD COLUMN "on_time_percentage" numeric,
  ADD COLUMN "verification_status" "text" NOT NULL DEFAULT 'self_reported',
  ADD COLUMN "verification_source" "text",
  ADD COLUMN "verification_checked_at" timestamp with time zone;

ALTER TABLE "public"."client_past_performance"
  ADD CONSTRAINT "client_past_performance_verification_status_check"
  CHECK ("verification_status" IN ('self_reported', 'confirmed_federal_award', 'unconfirmed'));

COMMENT ON COLUMN "public"."client_past_performance"."verification_status" IS
  'self_reported (default, no check attempted or no match found -- never shown as "Verified"), confirmed_federal_award (a real USASpending.gov match was found), unconfirmed (a check was attempted against USASpending but the request itself failed, distinct from a clean no-match).';
COMMENT ON COLUMN "public"."client_past_performance"."verification_source" IS
  'e.g. "usaspending.gov" -- which public source, if any, produced a confirmed_federal_award status.';
