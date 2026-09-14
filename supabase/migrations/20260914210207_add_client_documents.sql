-- Compliance & Licensing Vault, Phase 3: a reusable RFP-boilerplate
-- document library (W-9, non-collusion affidavit, capability statement,
-- custom riders) a client keeps current themselves -- self-supplied
-- paperwork, not something needing admin sign-off, so deliberately no
-- verified/verified_at/verified_by/audit_log workflow here (unlike
-- client_certifications / client_insurance_policies / client_bonding_capacity).
-- The mockup's "synced" badge needs no dedicated column -- a row's presence
-- with a file_url IS "synced" in the UI, nothing else to track.
CREATE TABLE "public"."client_documents" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "doc_type" "text" NOT NULL,
    "label" "text",
    "file_url" "text" NOT NULL,
    "file_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "client_documents_doc_type_check"
      CHECK ("doc_type" IN ('w9', 'non_collusion_affidavit', 'capability_statement', 'custom_rider', 'other'))
);
ALTER TABLE "public"."client_documents" OWNER TO "postgres";

ALTER TABLE ONLY "public"."client_documents"
    ADD CONSTRAINT "client_documents_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."client_documents"
    ADD CONSTRAINT "client_documents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;

ALTER TABLE "public"."client_documents" ENABLE ROW LEVEL SECURITY;

-- No "verified=false" clause in the client WITH CHECK (unlike
-- client_certifications/client_insurance_policies/client_bonding_capacity)
-- -- there's no verified concept on this table at all, so a client can
-- freely manage their own boilerplate documents end to end.
CREATE POLICY "admins manage client_documents" ON "public"."client_documents" USING ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_documents"."client_id") AND "public"."is_admin"("c"."org_id")))));

CREATE POLICY "clients manage their own documents" ON "public"."client_documents" USING ("public"."is_own_client_record"("client_id")) WITH CHECK ("public"."is_own_client_record"("client_id"));

GRANT ALL ON TABLE "public"."client_documents" TO "anon";
GRANT ALL ON TABLE "public"."client_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."client_documents" TO "service_role";

COMMENT ON TABLE "public"."client_documents" IS
  'Reusable RFP boilerplate a client keeps current themselves (W-9, non-collusion affidavit, capability statement, custom riders) -- distinct from client_certifications/client_insurance_policies/client_bonding_capacity, which are admin-verified facts. No verified gate here by design.';
