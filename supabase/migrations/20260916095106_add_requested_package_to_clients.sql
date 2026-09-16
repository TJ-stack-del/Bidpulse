-- Captures which pricing tier (pilot/one_off/retainer) a prospect clicked
-- before landing in the intake wizard, set the moment their `clients` row
-- is created (IntakeWizard.tsx's handleAboutYouNext) -- not waiting on a
-- submissions row to exist, unlike the audit_log-based tracking added
-- earlier the same day. That approach loses the signal entirely for
-- anyone who signs up and quits before finishing "About the bid" --
-- exactly the most likely drop-off point for a prospect with no specific
-- bid in hand yet (e.g. someone who clicked Retainer for ongoing
-- coverage). This column is the durable version of that signal: it
-- survives even if no submission is ever created, and is what lets the
-- daily digest's ghost-signups section (app/api/daily-digest/route.ts)
-- show which package a signed-up-but-never-submitted client actually
-- wanted, instead of nothing.
--
-- Plain nullable text, no CHECK constraint -- mirrors packages.package_type
-- (also unconstrained text) rather than inventing a stricter convention
-- this codebase doesn't otherwise use.
alter table "public"."clients"
  add column if not exists "requested_package" text;
