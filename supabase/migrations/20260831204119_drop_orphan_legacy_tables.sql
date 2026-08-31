-- Drops four legacy tables never included in the "clean restart" schema.sql:
-- bids, compliance_items, client_reviews, role_permissions.
-- All had RLS enabled with no policies (confirmed empty via anon-key REST checks)
-- and are not queried anywhere in the app. role_permissions held 4 orphaned rows
-- with no identifying column; the rest were empty.
drop table if exists "public"."bids" cascade;
drop table if exists "public"."compliance_items" cascade;
drop table if exists "public"."client_reviews" cascade;
drop table if exists "public"."role_permissions" cascade;
