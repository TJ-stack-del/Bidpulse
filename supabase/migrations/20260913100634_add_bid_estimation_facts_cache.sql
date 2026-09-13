-- Caches the result of extracting structured bid-sizing facts (trade
-- category, cleanable sqft, facility count/type, term length, any
-- agency-stated contract ceiling, detected service line items) from a
-- submission's uploaded RFP document(s) -- same pattern and same cache-
-- invalidation rule as rfp_requirements_cache. Deliberately never fabricates
-- a dollar figure: stated_ceiling is only ever a real ceiling the RFP itself
-- states, or null. Any future benchmark-formula estimate derived from these
-- facts (sqft x trade-rate multiplier) is computed in application code from
-- this cached JSON, never re-guessed by the LLM on every read.
alter table "public"."submissions"
  add column "bid_estimation_facts" jsonb,
  add column "bid_estimation_facts_extracted_at" timestamp with time zone;
