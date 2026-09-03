-- Build order item #5: a certification claim can now be saved with no
-- document attached (app-side validation removed in CertificationsSection.tsx),
-- but it must never be markable "verified" without one -- that's the whole
-- point of the verified gate (only verified rows are ever treated as fact
-- in generated paperwork). ClientCertifications.tsx's admin toggle already
-- guards this in the UI with a clear message; this is the DB-level
-- backstop so the rule holds regardless of which code path writes the row,
-- matching the RLS policy just above it that already blocks a client from
-- setting verified = true on their own row.
ALTER TABLE "public"."client_certifications"
  ADD CONSTRAINT "client_certifications_verified_requires_file"
  CHECK (NOT "verified" OR "file_url" IS NOT NULL);
