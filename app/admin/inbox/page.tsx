import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";
import Link from "next/link";

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

  function initials(name: string) {
    return name
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  return (
    <AppShell activePath="/admin/inbox" role="admin" viewerName={member.full_name}>
      <div className="mt-6">
        <h1 className="text-headline-lg text-primary mb-1">Intake Inbox</h1>
        <p className="text-body-md text-on-surface-variant">
          Every client submission, across every stage.
        </p>
      </div>

      {/* Table — only once there's comfortably enough width for six columns
          of real content (long agency names, badges) without cutting
          anything off. Below that, a stacked card per submission instead —
          see the xl:hidden block below. */}
      <div className="hidden xl:block bg-surface-container-lowest border border-outline-variant rounded-xl mt-4">
        <table className="w-full text-body-md table-fixed">
          <thead className="bg-surface-container-low">
            <tr>
              <th className="text-left px-4 py-3 text-label-md text-on-surface-variant uppercase tracking-wider w-[26%]">Client</th>
              <th className="text-left px-4 py-3 text-label-md text-on-surface-variant uppercase tracking-wider w-[24%]">Agency</th>
              <th className="text-left px-4 py-3 text-label-md text-on-surface-variant uppercase tracking-wider w-[14%]">Stage</th>
              <th className="text-left px-4 py-3 text-label-md text-on-surface-variant uppercase tracking-wider w-[14%]">Attention</th>
              <th className="text-left px-4 py-3 text-label-md text-on-surface-variant uppercase tracking-wider w-[12%]">Due</th>
              <th className="text-left px-4 py-3 text-label-md text-on-surface-variant uppercase tracking-wider w-[10%]"></th>
            </tr>
          </thead>
          <tbody>
            {(submissions ?? []).map((sub: any) => (
              <tr key={sub.id} className="border-t border-outline-variant hover:bg-surface-container-low transition">
                <td className="px-4 py-3 text-on-surface">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center text-label-sm font-bold shrink-0">
                      {initials(sub.clients?.company_name ?? "—")}
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold break-words">{sub.clients?.company_name ?? "—"}</span>
                      {sub.is_test && (
                        <span className="ml-2 text-[10px] px-2 py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-bold uppercase">
                          Test
                        </span>
                      )}
                      {sub.draft && (
                        <span className="ml-2 text-[10px] px-2 py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-bold uppercase">
                          Draft
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-on-surface-variant break-words">{sub.agency}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex px-2.5 py-1 rounded-full text-label-sm font-medium ${
                      stagePillStyle[sub.stage] ?? "bg-surface-container-high text-on-surface-variant"
                    }`}
                  >
                    {stageLabels[sub.stage] ?? sub.stage}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {sub.pastPromise ? (
                    <span className="inline-flex px-2.5 py-1 rounded-full text-label-sm font-bold bg-error text-on-error uppercase">
                      Past due
                    </span>
                  ) : sub.isStale ? (
                    <span className="inline-flex px-2.5 py-1 rounded-full text-label-sm font-medium bg-surface-container-highest text-on-surface-variant">
                      Needs attention
                    </span>
                  ) : (
                    <span className="text-on-surface-variant">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-on-surface-variant">
                  {sub.due_date ? new Date(sub.due_date).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/inbox/${sub.id}`}
                    className="inline-flex px-3 py-1.5 rounded bg-secondary text-on-secondary text-label-md font-semibold hover:bg-on-secondary-container transition active:scale-[0.97]"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {(!submissions || submissions.length === 0) && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-on-surface-variant">
                  No submissions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Card list — narrower than xl (laptop widths with less room, and
          mobile). Same data, stacked instead of columned, so nothing is
          ever cut off or forces sideways scrolling. */}
      <div className="xl:hidden bg-surface-container-lowest border border-outline-variant rounded-xl mt-4 divide-y divide-outline-variant">
        {(submissions ?? []).map((sub: any) => (
          <Link
            key={sub.id}
            href={`/admin/inbox/${sub.id}`}
            className="flex flex-col gap-3 px-4 py-4 hover:bg-surface-container-low transition"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center text-label-sm font-bold shrink-0">
                  {initials(sub.clients?.company_name ?? "—")}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-on-surface break-words">{sub.clients?.company_name ?? "—"}</p>
                  <p className="text-label-md text-on-surface-variant break-words">{sub.agency}</p>
                </div>
              </div>
              <span className="shrink-0 inline-flex px-3 py-1.5 rounded bg-secondary text-on-secondary text-label-md font-semibold">
                Open
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex px-2.5 py-1 rounded-full text-label-sm font-medium ${
                  stagePillStyle[sub.stage] ?? "bg-surface-container-high text-on-surface-variant"
                }`}
              >
                {stageLabels[sub.stage] ?? sub.stage}
              </span>
              {sub.pastPromise ? (
                <span className="inline-flex px-2.5 py-1 rounded-full text-label-sm font-bold bg-error text-on-error uppercase">
                  Past due
                </span>
              ) : sub.isStale ? (
                <span className="inline-flex px-2.5 py-1 rounded-full text-label-sm font-medium bg-surface-container-highest text-on-surface-variant">
                  Needs attention
                </span>
              ) : null}
              {sub.is_test && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-bold uppercase">
                  Test
                </span>
              )}
              {sub.draft && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-bold uppercase">
                  Draft
                </span>
              )}
              <span className="text-label-md text-on-surface-variant ml-auto">
                {sub.due_date ? `Due ${new Date(sub.due_date).toLocaleDateString()}` : "No due date"}
              </span>
            </div>
          </Link>
        ))}
        {(!submissions || submissions.length === 0) && (
          <p className="px-4 py-6 text-center text-on-surface-variant">No submissions yet.</p>
        )}
      </div>
    </AppShell>
  );
}
