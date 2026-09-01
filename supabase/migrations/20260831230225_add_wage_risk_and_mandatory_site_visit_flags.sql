-- Deferred item #2 (PROJECT-STATUS.md): bid-specific variable detection.
-- Same pattern as fit_eligibility_concern/fit_eligibility_explanation —
-- computed once by generate-fit-check right after client submit, from the
-- bid's own scope text, never a confirmed fact, always framed as something
-- to verify.
alter table "public"."submissions"
  add column "wage_risk_concern" boolean,
  add column "wage_risk_explanation" text,
  add column "mandatory_site_visit_concern" boolean,
  add column "mandatory_site_visit_explanation" text;
