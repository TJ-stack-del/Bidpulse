-- New auto-trigger: submitted -> in_review the moment an admin first opens
-- a submission's detail page, completing the pipeline automation (the
-- other two transitions already auto-advance; this was the one remaining
-- manual-only step with no natural trigger event proposed before now).
--
-- This column is purely a record of when it happened, not the gate itself
-- -- the actual auto-advance in app/admin/inbox/[id]/page.tsx gates on
-- `stage = 'submitted'` directly, so it can only ever fire once per
-- submission regardless of how many times this column gets read.
alter table "public"."submissions"
  add column if not exists "first_viewed_by_admin_at" timestamptz;
