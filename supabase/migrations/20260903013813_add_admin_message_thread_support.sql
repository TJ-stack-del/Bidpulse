-- "Message admin" UI: a genuine two-way thread on a submission, kept
-- separate from the existing "Request info from client" feature (which
-- stays as-is for formal one-way requests with a checklist item
-- attached). Reuses support_messages rather than a new table -- same
-- shape (name/email/message/org_id/client_id/submission_id), just now
-- also used for a real conversation instead of only the anonymous
-- contact form.
--
-- Direction is inferred from which actor field is set: sent_by_admin_id
-- null + client_id set = a client message; sent_by_admin_id set = an
-- admin message. No new enum needed for that.
alter table "public"."support_messages"
  add column if not exists "sent_by_admin_id" uuid references "public"."team_members"("id");

-- The existing "anyone can submit a support message" policy (with check
-- (true)) is too permissive for a real per-submission thread -- replaced
-- with one unified policy covering all three real insert shapes:
--   1. The anonymous contact form (no client_id/submission_id/admin_id at
--      all) -- must keep working unmodified, it has no session to check
--      ownership against.
--   2. A client's own message on their own submission.
--   3. An admin's own message, scoped to their org.
drop policy if exists "anyone can submit a support message" on "public"."support_messages";

create policy "insert support_messages"
  on "public"."support_messages"
  for insert
  with check (
    (client_id is null and submission_id is null and sent_by_admin_id is null)
    or (
      sent_by_admin_id is null
      and client_id is not null
      and submission_id is not null
      and public.is_own_client_record(client_id)
      and exists (
        select 1 from public.submissions s
        where s.id = support_messages.submission_id and s.client_id = support_messages.client_id
      )
    )
    or (sent_by_admin_id is not null and public.is_admin(org_id))
  );

-- No SELECT policy let a client read their own submission's messages at
-- all before this -- admins-only per the existing "admins read support
-- messages in their org" policy.
create policy "clients read their own submission messages"
  on "public"."support_messages"
  for select
  using (
    client_id is not null
    and submission_id is not null
    and public.is_own_client_record(client_id)
  );
