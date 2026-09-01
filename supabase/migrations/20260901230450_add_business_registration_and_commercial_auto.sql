-- Two Company Profile fields that document extraction currently has nowhere
-- to put: the state business-registration number (Florida Sunbiz Document
-- Number), distinct from clients.license_number (trade/occupational license
-- — a bid can require proof of both, and a client can have one without the
-- other), and Commercial Auto insurance coverage, alongside the existing
-- general_liability_coverage/workers_comp_coverage free-text columns.

ALTER TABLE "public"."clients"
  ADD COLUMN IF NOT EXISTS "business_registration_number" "text",
  ADD COLUMN IF NOT EXISTS "commercial_auto_coverage" "text";
