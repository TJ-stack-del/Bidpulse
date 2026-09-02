-- confirmed_submitted assumed *admin* confirms a client's bid was submitted
-- to the agency, but the client is the one who actually submits — meaning
-- this stage could only ever be set via an out-of-band report from the
-- client that nothing in the app prompted for. A pipeline field that's
-- usually stale is worse than no field: it invites false conclusions
-- ("clients aren't submitting") when really no one ever reported back. If
-- a "client told us they submitted" signal is wanted later, it belongs in
-- admin_notes as an informal note when it comes up, not a formal pipeline
-- gate.
--
-- Confirmed via a direct query before writing this migration: zero rows
-- currently sit in confirmed_submitted, so no remap target is needed. The
-- plain ::text:: cast below still fails loudly (rather than silently
-- corrupting data) if that's ever untrue by the time this runs.
--
-- Postgres has no ALTER TYPE ... DROP VALUE — removing an enum value means
-- swapping in a new type.
ALTER TYPE "public"."submission_stage" RENAME TO "submission_stage_old";

CREATE TYPE "public"."submission_stage" AS ENUM (
    'submitted',
    'in_review',
    'deliverables_ready',
    'client_review',
    'closed'
);

ALTER TABLE "public"."submissions"
  ALTER COLUMN "stage" DROP DEFAULT,
  ALTER COLUMN "stage" TYPE "public"."submission_stage"
    USING ("stage"::text::"public"."submission_stage"),
  ALTER COLUMN "stage" SET DEFAULT 'submitted'::"public"."submission_stage";

DROP TYPE "public"."submission_stage_old";
