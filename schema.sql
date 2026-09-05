-- ============================================================================
-- BidPulse — Schema (generated reference, do not run by hand)
-- ============================================================================
-- This file is a snapshot of the live Supabase schema, generated via
-- `npx supabase db dump --schema public`. It documents current structure for
-- reference (code comments across the app point here for RLS policies, enum
-- values, etc.) — it is NOT the mechanism for changing the schema.
--
-- Schema changes go through supabase/migrations/ (`npx supabase migration new
-- <name>`, then `npx supabase db push`). After applying migrations, regenerate
-- this file with the same dump command and commit the diff so it stays
-- accurate.
-- ============================================================================




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."checklist_status" AS ENUM (
    'not_started',
    'in_progress',
    'done',
    'waived'
);


ALTER TYPE "public"."checklist_status" OWNER TO "postgres";


CREATE TYPE "public"."submission_stage" AS ENUM (
    'submitted',
    'in_review',
    'deliverables_ready',
    'client_review',
    'closed'
);


ALTER TYPE "public"."submission_stage" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'admin',
    'client'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access_client_object"("object_name" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from clients c
    where c.id::text = (storage.foldername(object_name))[1]
      and (is_admin(c.org_id) or is_own_client_record(c.id))
  );
$$;


ALTER FUNCTION "public"."can_access_client_object"("object_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access_rfp_object"("object_name" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from submissions s join clients c on c.id = s.client_id
    where s.id::text = (storage.foldername(object_name))[1]
      and (is_admin(c.org_id) or is_own_client_record(c.id))
  );
$$;


ALTER FUNCTION "public"."can_access_rfp_object"("object_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"("target_org_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from team_members
    where org_id = target_org_id and auth_user_id = auth.uid() and role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_admin"("target_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_org_member"("target_org_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  select exists (
    select 1 from team_members
    where org_id = target_org_id and auth_user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_org_member"("target_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_own_client_record"("target_client_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from clients
    where id = target_client_id and auth_user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_own_client_record"("target_client_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."org_has_admin"("target_org_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (select 1 from team_members where org_id = target_org_id);
$$;


ALTER FUNCTION "public"."org_has_admin"("target_org_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_notes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "submission_id" "uuid" NOT NULL,
    "author_id" "uuid",
    "note" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "submission_id" "uuid",
    "org_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "event_type" "text" NOT NULL,
    "event_detail" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."checklist_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "submission_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "status" "public"."checklist_status" DEFAULT 'not_started'::"public"."checklist_status" NOT NULL,
    "notes" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."checklist_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_certifications" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "cert_type" "text" NOT NULL,
    "other_label" "text",
    "certification_number" "text",
    "expiration_date" "date",
    "file_url" "text",
    "file_name" "text",
    "verified" boolean DEFAULT false NOT NULL,
    "verified_at" timestamp with time zone,
    "verified_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "client_certifications_verified_requires_file" CHECK (((NOT "verified") OR ("file_url" IS NOT NULL)))
);


ALTER TABLE "public"."client_certifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "auth_user_id" "uuid",
    "company_name" "text" NOT NULL,
    "contact_name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "naics_codes" "text"[] DEFAULT '{}'::"text"[],
    "small_business_statuses" "text"[] DEFAULT '{}'::"text"[],
    "set_asides" "text"[] DEFAULT '{}'::"text"[],
    "trade_keywords" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "license_number" "text",
    "years_in_business" integer,
    "business_address" "text",
    "business_phone" "text",
    "insurance_provider" "text",
    "insurance_policy_number" "text",
    "general_liability_coverage" "text",
    "workers_comp_coverage" "text",
    "differentiators" "text",
    "business_registration_number" "text",
    "commercial_auto_coverage" "text",
    CONSTRAINT "clients_has_a_contact_method" CHECK ((("email" IS NOT NULL) OR ("phone" IS NOT NULL)))
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deliverables" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "submission_id" "uuid" NOT NULL,
    "deliverable_type" "text" NOT NULL,
    "file_url" "text",
    "content" "text",
    "prepared_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."deliverables" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."download_attestations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "submission_id" "uuid" NOT NULL,
    "deliverable_type" "text" NOT NULL,
    "attested_by" "uuid" NOT NULL,
    "attested_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."download_attestations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."matched_opportunities" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "assigned_client_id" "uuid",
    "source_title" "text" NOT NULL,
    "source_agency" "text" NOT NULL,
    "due_date" timestamp with time zone,
    "match_score" numeric,
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source_url" "text",
    "scope" "text",
    "solicitation_number" "text"
);


ALTER TABLE "public"."matched_opportunities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "lean_package_threshold" numeric DEFAULT 35000 NOT NULL
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."packages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "package_type" "text" DEFAULT 'pilot'::"text" NOT NULL,
    "price_note" "text",
    "is_test" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "paid" boolean DEFAULT false NOT NULL,
    "paid_at" timestamp with time zone
);


ALTER TABLE "public"."packages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."submission_documents" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "submission_id" "uuid" NOT NULL,
    "document_type" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_url" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."submission_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."submissions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "package_id" "uuid",
    "agency" "text" NOT NULL,
    "solicitation_number" "text",
    "due_date" timestamp with time zone,
    "scope" "text",
    "stage" "public"."submission_stage" DEFAULT 'submitted'::"public"."submission_stage" NOT NULL,
    "is_test" boolean DEFAULT false NOT NULL,
    "draft" boolean DEFAULT true NOT NULL,
    "draft_saved_at" timestamp with time zone,
    "submitted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fit_alignment" "text",
    "fit_explanation" "text",
    "client_reported_submitted_at" timestamp with time zone,
    "fit_eligibility_concern" boolean,
    "fit_eligibility_explanation" "text",
    "wage_risk_concern" boolean,
    "wage_risk_explanation" "text",
    "mandatory_site_visit_concern" boolean,
    "mandatory_site_visit_explanation" "text",
    "estimated_value" numeric,
    "info_attested_at" timestamp with time zone,
    "info_attested_by" "uuid"
);


ALTER TABLE "public"."submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."support_messages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "submission_id" "uuid",
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "message" "text" NOT NULL,
    "read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sent_by_admin_id" "uuid"
);


ALTER TABLE "public"."support_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_members" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "auth_user_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "role" "public"."user_role" DEFAULT 'admin'::"public"."user_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."team_members" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_notes"
    ADD CONSTRAINT "admin_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."checklist_items"
    ADD CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_certifications"
    ADD CONSTRAINT "client_certifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deliverables"
    ADD CONSTRAINT "deliverables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."download_attestations"
    ADD CONSTRAINT "download_attestations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matched_opportunities"
    ADD CONSTRAINT "matched_opportunities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."packages"
    ADD CONSTRAINT "packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."submission_documents"
    ADD CONSTRAINT "submission_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_messages"
    ADD CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_org_id_auth_user_id_key" UNIQUE ("org_id", "auth_user_id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_notes"
    ADD CONSTRAINT "admin_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."team_members"("id");



ALTER TABLE ONLY "public"."admin_notes"
    ADD CONSTRAINT "admin_notes_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."team_members"("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."checklist_items"
    ADD CONSTRAINT "checklist_items_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_certifications"
    ADD CONSTRAINT "client_certifications_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_certifications"
    ADD CONSTRAINT "client_certifications_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "public"."team_members"("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deliverables"
    ADD CONSTRAINT "deliverables_prepared_by_fkey" FOREIGN KEY ("prepared_by") REFERENCES "public"."team_members"("id");



ALTER TABLE ONLY "public"."deliverables"
    ADD CONSTRAINT "deliverables_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."download_attestations"
    ADD CONSTRAINT "download_attestations_attested_by_fkey" FOREIGN KEY ("attested_by") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."download_attestations"
    ADD CONSTRAINT "download_attestations_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matched_opportunities"
    ADD CONSTRAINT "matched_opportunities_assigned_client_id_fkey" FOREIGN KEY ("assigned_client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."matched_opportunities"
    ADD CONSTRAINT "matched_opportunities_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."packages"
    ADD CONSTRAINT "packages_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."submission_documents"
    ADD CONSTRAINT "submission_documents_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_info_attested_by_fkey" FOREIGN KEY ("info_attested_by") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."support_messages"
    ADD CONSTRAINT "support_messages_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."support_messages"
    ADD CONSTRAINT "support_messages_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_messages"
    ADD CONSTRAINT "support_messages_sent_by_admin_id_fkey" FOREIGN KEY ("sent_by_admin_id") REFERENCES "public"."team_members"("id");



ALTER TABLE ONLY "public"."support_messages"
    ADD CONSTRAINT "support_messages_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



CREATE POLICY "a client can insert their own record" ON "public"."clients" FOR INSERT WITH CHECK (("auth_user_id" = "auth"."uid"()));



CREATE POLICY "a user can bootstrap the first team_members row for a new org" ON "public"."team_members" FOR INSERT WITH CHECK ((("auth_user_id" = "auth"."uid"()) AND (NOT "public"."org_has_admin"("org_id"))));



CREATE POLICY "a user can insert their own team_members row" ON "public"."team_members" FOR INSERT WITH CHECK (("auth_user_id" = "auth"."uid"()));



CREATE POLICY "access submission_documents via submission" ON "public"."submission_documents" USING ((EXISTS ( SELECT 1
   FROM ("public"."submissions" "s"
     JOIN "public"."clients" "c" ON (("c"."id" = "s"."client_id")))
  WHERE (("s"."id" = "submission_documents"."submission_id") AND ("public"."is_admin"("c"."org_id") OR "public"."is_own_client_record"("c"."id"))))));



ALTER TABLE "public"."admin_notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admins can read team_members in their org" ON "public"."team_members" FOR SELECT USING ("public"."is_admin"("org_id"));



CREATE POLICY "admins can read their organization" ON "public"."organizations" FOR SELECT USING ("public"."is_admin"("id"));



CREATE POLICY "admins manage certifications in their org" ON "public"."client_certifications" USING ((EXISTS ( SELECT 1
   FROM ("public"."clients" "c"
     JOIN "public"."team_members" "tm" ON (("tm"."org_id" = "c"."org_id")))
  WHERE (("c"."id" = "client_certifications"."client_id") AND ("tm"."auth_user_id" = "auth"."uid"()) AND ("tm"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "admins manage checklist_items" ON "public"."checklist_items" USING ((EXISTS ( SELECT 1
   FROM ("public"."submissions" "s"
     JOIN "public"."clients" "c" ON (("c"."id" = "s"."client_id")))
  WHERE (("s"."id" = "checklist_items"."submission_id") AND "public"."is_admin"("c"."org_id")))));



CREATE POLICY "admins manage client_certifications" ON "public"."client_certifications" USING ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_certifications"."client_id") AND "public"."is_admin"("c"."org_id")))));



CREATE POLICY "admins manage clients" ON "public"."clients" USING ("public"."is_admin"("org_id"));



CREATE POLICY "admins manage deliverables" ON "public"."deliverables" USING ((EXISTS ( SELECT 1
   FROM ("public"."submissions" "s"
     JOIN "public"."clients" "c" ON (("c"."id" = "s"."client_id")))
  WHERE (("s"."id" = "deliverables"."submission_id") AND "public"."is_admin"("c"."org_id")))));



CREATE POLICY "admins manage matched_opportunities" ON "public"."matched_opportunities" USING ("public"."is_admin"("org_id"));



CREATE POLICY "admins manage packages" ON "public"."packages" USING ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "packages"."client_id") AND "public"."is_admin"("c"."org_id")))));



CREATE POLICY "admins manage submissions" ON "public"."submissions" USING ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "submissions"."client_id") AND "public"."is_admin"("c"."org_id")))));



CREATE POLICY "admins manage their organization" ON "public"."organizations" FOR UPDATE USING ("public"."is_admin"("id")) WITH CHECK ("public"."is_admin"("id"));



CREATE POLICY "admins only on admin_notes" ON "public"."admin_notes" USING ((EXISTS ( SELECT 1
   FROM ("public"."submissions" "s"
     JOIN "public"."clients" "c" ON (("c"."id" = "s"."client_id")))
  WHERE (("s"."id" = "admin_notes"."submission_id") AND "public"."is_admin"("c"."org_id")))));



CREATE POLICY "admins read all clients" ON "public"."clients" FOR SELECT USING ("public"."is_admin"("org_id"));



CREATE POLICY "admins read all submissions" ON "public"."submissions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "submissions"."client_id") AND "public"."is_admin"("c"."org_id")))));



CREATE POLICY "admins read audit_log" ON "public"."audit_log" FOR SELECT USING ("public"."is_admin"("org_id"));



CREATE POLICY "admins read download_attestations" ON "public"."download_attestations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."submissions" "s"
     JOIN "public"."clients" "c" ON (("c"."id" = "s"."client_id")))
  WHERE (("s"."id" = "download_attestations"."submission_id") AND "public"."is_admin"("c"."org_id")))));



CREATE POLICY "admins read support messages in their org" ON "public"."support_messages" FOR SELECT USING ("public"."is_admin"("org_id"));



CREATE POLICY "admins update support messages in their org" ON "public"."support_messages" FOR UPDATE USING ("public"."is_admin"("org_id"));



CREATE POLICY "any authenticated user can create an organization" ON "public"."organizations" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "anyone signed in can look up the organization id" ON "public"."organizations" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "authenticated users can read organizations" ON "public"."organizations" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



ALTER TABLE "public"."checklist_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_certifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clients insert their own submissions" ON "public"."submissions" FOR INSERT WITH CHECK ("public"."is_own_client_record"("client_id"));



CREATE POLICY "clients manage their own certifications" ON "public"."client_certifications" USING ("public"."is_own_client_record"("client_id")) WITH CHECK (("public"."is_own_client_record"("client_id") AND ("verified" = false)));



CREATE POLICY "clients manage their own download_attestations" ON "public"."download_attestations" USING ((EXISTS ( SELECT 1
   FROM "public"."submissions" "s"
  WHERE (("s"."id" = "download_attestations"."submission_id") AND "public"."is_own_client_record"("s"."client_id"))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."submissions" "s"
  WHERE (("s"."id" = "download_attestations"."submission_id") AND "public"."is_own_client_record"("s"."client_id")))) AND "public"."is_own_client_record"("attested_by")));



CREATE POLICY "clients read their own checklist_items" ON "public"."checklist_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."submissions" "s"
  WHERE (("s"."id" = "checklist_items"."submission_id") AND "public"."is_own_client_record"("s"."client_id")))));



CREATE POLICY "clients read their own deliverables" ON "public"."deliverables" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."submissions" "s"
  WHERE (("s"."id" = "deliverables"."submission_id") AND "public"."is_own_client_record"("s"."client_id")))));



CREATE POLICY "clients read their own packages" ON "public"."packages" FOR SELECT USING ("public"."is_own_client_record"("client_id"));



CREATE POLICY "clients read their own record" ON "public"."clients" FOR SELECT USING (("auth_user_id" = "auth"."uid"()));



CREATE POLICY "clients read their own submission messages" ON "public"."support_messages" FOR SELECT USING ((("client_id" IS NOT NULL) AND ("submission_id" IS NOT NULL) AND "public"."is_own_client_record"("client_id")));



CREATE POLICY "clients read their own submissions" ON "public"."submissions" FOR SELECT USING ("public"."is_own_client_record"("client_id"));



CREATE POLICY "clients update their own draft submissions" ON "public"."submissions" FOR UPDATE USING (("public"."is_own_client_record"("client_id") AND ("draft" = true))) WITH CHECK (("public"."is_own_client_record"("client_id") AND (("draft" = true) OR (("info_attested_at" IS NOT NULL) AND "public"."is_own_client_record"("info_attested_by")))));



CREATE POLICY "clients update their own record" ON "public"."clients" FOR UPDATE USING ("public"."is_own_client_record"("id")) WITH CHECK ("public"."is_own_client_record"("id"));



ALTER TABLE "public"."deliverables" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."download_attestations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insert audit_log" ON "public"."audit_log" FOR INSERT WITH CHECK (("public"."is_admin"("org_id") OR (EXISTS ( SELECT 1
   FROM "public"."submissions" "s"
  WHERE (("s"."id" = "audit_log"."submission_id") AND "public"."is_own_client_record"("s"."client_id"))))));



CREATE POLICY "insert support_messages" ON "public"."support_messages" FOR INSERT WITH CHECK (((("client_id" IS NULL) AND ("submission_id" IS NULL) AND ("sent_by_admin_id" IS NULL)) OR (("sent_by_admin_id" IS NULL) AND ("client_id" IS NOT NULL) AND ("submission_id" IS NOT NULL) AND "public"."is_own_client_record"("client_id") AND (EXISTS ( SELECT 1
   FROM "public"."submissions" "s"
  WHERE (("s"."id" = "support_messages"."submission_id") AND ("s"."client_id" = "support_messages"."client_id"))))) OR (("sent_by_admin_id" IS NOT NULL) AND "public"."is_admin"("org_id"))));



ALTER TABLE "public"."matched_opportunities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."packages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."submission_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."support_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_members" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_client_object"("object_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_client_object"("object_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_client_object"("object_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_rfp_object"("object_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_rfp_object"("object_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_rfp_object"("object_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"("target_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"("target_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"("target_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_org_member"("target_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_org_member"("target_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_org_member"("target_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_own_client_record"("target_client_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_own_client_record"("target_client_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_own_client_record"("target_client_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."org_has_admin"("target_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."org_has_admin"("target_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."org_has_admin"("target_org_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."admin_notes" TO "anon";
GRANT ALL ON TABLE "public"."admin_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_notes" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log" TO "anon";
GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."checklist_items" TO "anon";
GRANT ALL ON TABLE "public"."checklist_items" TO "authenticated";
GRANT ALL ON TABLE "public"."checklist_items" TO "service_role";



GRANT ALL ON TABLE "public"."client_certifications" TO "anon";
GRANT ALL ON TABLE "public"."client_certifications" TO "authenticated";
GRANT ALL ON TABLE "public"."client_certifications" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."deliverables" TO "anon";
GRANT ALL ON TABLE "public"."deliverables" TO "authenticated";
GRANT ALL ON TABLE "public"."deliverables" TO "service_role";



GRANT ALL ON TABLE "public"."download_attestations" TO "anon";
GRANT ALL ON TABLE "public"."download_attestations" TO "authenticated";
GRANT ALL ON TABLE "public"."download_attestations" TO "service_role";



GRANT ALL ON TABLE "public"."matched_opportunities" TO "anon";
GRANT ALL ON TABLE "public"."matched_opportunities" TO "authenticated";
GRANT ALL ON TABLE "public"."matched_opportunities" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."packages" TO "anon";
GRANT ALL ON TABLE "public"."packages" TO "authenticated";
GRANT ALL ON TABLE "public"."packages" TO "service_role";



GRANT ALL ON TABLE "public"."submission_documents" TO "anon";
GRANT ALL ON TABLE "public"."submission_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."submission_documents" TO "service_role";



GRANT ALL ON TABLE "public"."submissions" TO "anon";
GRANT ALL ON TABLE "public"."submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."submissions" TO "service_role";



GRANT ALL ON TABLE "public"."support_messages" TO "anon";
GRANT ALL ON TABLE "public"."support_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."support_messages" TO "service_role";



GRANT ALL ON TABLE "public"."team_members" TO "anon";
GRANT ALL ON TABLE "public"."team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."team_members" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







