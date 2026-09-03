-- The rfp-documents bucket was created out-of-band (dashboard/initial
-- setup) before this project adopted tracked-migration discipline, so its
-- CREATION was never actually captured in any migration file — only later
-- changes to it (RLS policies, the public->private flip in
-- 20260831214629_make_rfp_documents_bucket_private.sql, which is an
-- UPDATE that assumes the row already exists). Replaying every migration
-- against the new production project during the dev/prod split correctly
-- recreated every public-schema table and RLS policy, but silently did
-- NOT create the bucket itself — the UPDATE above just matched zero rows
-- and moved on with no error, which is exactly why intake's file upload
-- started failing with "Failed to fetch" the moment anyone actually tried
-- it against the new project.
--
-- Confirmed directly (not assumed) before writing this: storage.buckets
-- on the new production project returned zero rows. Confirmed the exact
-- config to match here by reading the CURRENT dev project's real bucket
-- row directly, rather than the older public-bucket state schema.sql/git
-- history might suggest: id/name "rfp-documents", public = false (the
-- already-hardened state — this migration creates it correctly from the
-- start rather than replaying the original public->private history),
-- file_size_limit and allowed_mime_types both null (app-level code
-- already enforces its own size/type limits per upload route).
--
-- on conflict do nothing makes this safe to also replay against the dev
-- project, where the bucket already exists — it's a genuine no-op there.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rfp-documents', 'rfp-documents', false, null, null)
on conflict (id) do nothing;
