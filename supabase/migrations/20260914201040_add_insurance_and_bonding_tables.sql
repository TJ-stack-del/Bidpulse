-- Compliance & Licensing Vault, Phase 2: structured insurance & bonding
-- tracking. clients.insurance_provider/insurance_policy_number/
-- general_liability_coverage/workers_comp_coverage/commercial_auto_coverage
-- stay exactly as they are (still read by generate-draft/generate-fit-check/
-- the admin inbox/the client dashboard) -- this is deliberately additive,
-- not a replacement. Two narrow tables rather than one wide one: a COI and
-- a bond letter carry genuinely different fields (limits+carrier vs.
-- capacity+obligee+surety), but both reuse the exact same verify/file/
-- audit pattern proven on client_certifications in the previous migration.

CREATE TABLE "public"."client_insurance_policies" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "policy_type" "text" NOT NULL,
    "carrier_name" "text",
    "policy_number" "text",
    "per_occurrence_limit" "text",
    "aggregate_limit" "text",
    "effective_date" "date",
    "expiration_date" "date",
    "file_url" "text",
    "file_name" "text",
    "verified" boolean DEFAULT false NOT NULL,
    "verified_at" timestamp with time zone,
    "verified_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "client_insurance_policies_policy_type_check"
      CHECK ("policy_type" IN ('general_liability', 'workers_comp', 'commercial_auto', 'professional_liability', 'umbrella')),
    CONSTRAINT "client_insurance_policies_verified_requires_file"
      CHECK (NOT "verified" OR "file_url" IS NOT NULL)
);
ALTER TABLE "public"."client_insurance_policies" OWNER TO "postgres";

CREATE TABLE "public"."client_bonding_capacity" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "surety_name" "text",
    "bond_number" "text",
    "aggregate_bonding_capacity" "text",
    "single_project_bonding_capacity" "text",
    "obligee" "text",
    "effective_date" "date",
    "expiration_date" "date",
    "file_url" "text",
    "file_name" "text",
    "verified" boolean DEFAULT false NOT NULL,
    "verified_at" timestamp with time zone,
    "verified_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "client_bonding_capacity_verified_requires_file"
      CHECK (NOT "verified" OR "file_url" IS NOT NULL)
);
ALTER TABLE "public"."client_bonding_capacity" OWNER TO "postgres";

ALTER TABLE ONLY "public"."client_insurance_policies"
    ADD CONSTRAINT "client_insurance_policies_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."client_bonding_capacity"
    ADD CONSTRAINT "client_bonding_capacity_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."client_insurance_policies"
    ADD CONSTRAINT "client_insurance_policies_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."client_insurance_policies"
    ADD CONSTRAINT "client_insurance_policies_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "public"."team_members"("id");

ALTER TABLE ONLY "public"."client_bonding_capacity"
    ADD CONSTRAINT "client_bonding_capacity_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."client_bonding_capacity"
    ADD CONSTRAINT "client_bonding_capacity_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "public"."team_members"("id");

ALTER TABLE "public"."client_insurance_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."client_bonding_capacity" ENABLE ROW LEVEL SECURITY;

-- Same shape as "admins manage client_certifications" / "clients manage
-- their own certifications" -- a client can insert/select/delete their own
-- rows but can never set verified = true themselves (the WITH CHECK
-- clause), an admin in the same org can do anything including verify.
CREATE POLICY "admins manage client_insurance_policies" ON "public"."client_insurance_policies" USING ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_insurance_policies"."client_id") AND "public"."is_admin"("c"."org_id")))));

CREATE POLICY "clients manage their own insurance policies" ON "public"."client_insurance_policies" USING ("public"."is_own_client_record"("client_id")) WITH CHECK (("public"."is_own_client_record"("client_id") AND ("verified" = false)));

CREATE POLICY "admins manage client_bonding_capacity" ON "public"."client_bonding_capacity" USING ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_bonding_capacity"."client_id") AND "public"."is_admin"("c"."org_id")))));

CREATE POLICY "clients manage their own bonding capacity" ON "public"."client_bonding_capacity" USING ("public"."is_own_client_record"("client_id")) WITH CHECK (("public"."is_own_client_record"("client_id") AND ("verified" = false)));

GRANT ALL ON TABLE "public"."client_insurance_policies" TO "anon";
GRANT ALL ON TABLE "public"."client_insurance_policies" TO "authenticated";
GRANT ALL ON TABLE "public"."client_insurance_policies" TO "service_role";

GRANT ALL ON TABLE "public"."client_bonding_capacity" TO "anon";
GRANT ALL ON TABLE "public"."client_bonding_capacity" TO "authenticated";
GRANT ALL ON TABLE "public"."client_bonding_capacity" TO "service_role";

COMMENT ON TABLE "public"."client_insurance_policies" IS
  'Structured insurance tracking for the Compliance Vault -- deliberately separate from clients.insurance_provider/general_liability_coverage/etc (free text), which are left untouched and still read by generate-draft/generate-fit-check until those are deliberately migrated to prefer this table.';
COMMENT ON TABLE "public"."client_bonding_capacity" IS
  'Structured surety bonding capacity tracking for the Compliance Vault. No equivalent free-text column existed on clients before this -- bonding capacity was not tracked anywhere in the app.';
