import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";
import { InboxBoard } from "./InboxBoard";

// This replaces the old self-serve /bids list — now shows every client's
// submissions, not just one contractor's own.

export default async function AdminInboxPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Without this check, a client account hitting this URL directly would
  // still render the page (RLS just narrows the query to their own single
  // row), mislabeled as "every client's submissions" — root already knows
  // where a client actually belongs.
  const { data: member } = await supabase
    .from("team_members")
    .select("id, full_name")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!member) redirect("/");

  // Real FIFO queue, oldest-submitted-first, so nothing sits unnoticed
  // further down the list — draft rows are excluded entirely (not yet
  // actionable, no submitted_at to queue by), and test rows sort after
  // every real one so rehearsal data never competes with real client
  // queue position (same principle as excluding is_test from reporting
  // elsewhere in the app). "Needs attention"/"Past due" stay as visual
  // badges computed below, not as a reordering signal — the point of a
  // real FIFO is that row position always matches submission order.
  const { data: rawSubmissions } = await supabase
    .from("submissions")
    .select(
      "id, agency, solicitation_number, stage, due_date, is_test, draft, submitted_at, updated_at, created_at, clients(company_name)"
    )
    .eq("draft", false)
    .order("is_test", { ascending: true })
    .order("submitted_at", { ascending: true });

  const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  // "Needs attention" — anything not already closed out, either past our
  // 48-hour turnaround promise (still stuck in submitted/in_review more
  // than 48h after the client's own submitted_at — a broken promise, not
  // just staleness) or simply untouched for 3+ days (no explicit
  // updated_at yet falls back to created_at).
  const submissions = (rawSubmissions ?? []).map((sub: any) => {
    const pastPromise =
      sub.stage !== "closed" &&
      (sub.stage === "submitted" || sub.stage === "in_review") &&
      !!sub.submitted_at &&
      now - new Date(sub.submitted_at).getTime() > FORTY_EIGHT_HOURS_MS;

    const lastTouched = sub.updated_at ?? sub.created_at;
    const isStale =
      sub.stage !== "closed" && now - new Date(lastTouched).getTime() >= THREE_DAYS_MS;

    return { ...sub, pastPromise, isStale };
  });

  const stageLabels: Record<string, string> = {
    submitted: "Submitted",
    in_review: "In review",
    deliverables_ready: "Deliverables ready",
    client_review: "Client review",
    confirmed_submitted: "Confirmed submitted",
    closed: "Closed",
  };

  const stagePillStyle: Record<string, string> = {
    submitted: "bg-surface-container-high text-on-surface-variant",
    in_review: "bg-surface-container-high text-on-surface-variant",
    deliverables_ready: "bg-secondary-container text-on-secondary-container",
    client_review: "bg-secondary-container text-on-secondary-container",
    confirmed_submitted: "bg-secondary text-on-secondary",
    closed: "bg-surface-variant text-on-surface-variant",
  };

  return (
    <AppShell activePath="/admin/inbox" role="admin" viewerName={member.full_name}>
      <div className="mt-6">
        <h1 className="text-headline-lg text-primary mb-1">Intake Inbox</h1>
        <p className="text-body-md text-on-surface-variant">
          Every client submission, across every stage.
        </p>
      </div>

      <InboxBoard submissions={submissions as any} stageLabels={stageLabels} stagePillStyle={stagePillStyle} />
    </AppShell>
  );
}
