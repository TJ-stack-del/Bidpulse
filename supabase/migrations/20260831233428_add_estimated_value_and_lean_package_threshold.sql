-- Deferred item #4 (PROJECT-STATUS.md), Part A: dollar-value threshold ->
-- lean package.
--
-- estimated_value is nullable — not every bid has this known at intake,
-- and it's admin-entered later during review, never client-supplied.
--
-- lean_package_threshold lives on organizations (single row today) rather
-- than a constant in code, since local bodies (JEA, JAA, City of
-- Jacksonville, Duval Schools) may set their own threshold above/below the
-- FL Statute 287.017 Category Two STATE default of $35,000 — Mike needs to
-- be able to change this without a code deploy.
alter table "public"."submissions"
  add column "estimated_value" numeric;

alter table "public"."organizations"
  add column "lean_package_threshold" numeric not null default 35000;

-- No UPDATE policy existed on organizations at all — needed now so an
-- admin can actually save a changed threshold from the settings page.
create policy "admins manage their organization"
  on "public"."organizations" for update
  using (is_admin(id))
  with check (is_admin(id));
