"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Submission = {
  id: string;
  agency: string;
  stage: string;
  due_date: string | null;
  is_test: boolean;
  draft: boolean;
  submitted_at: string | null;
  clients: { company_name: string } | null;
  pastPromise: boolean;
  isStale: boolean;
};

const STAGE_ORDER = [
  "submitted",
  "in_review",
  "deliverables_ready",
  "client_review",
  "confirmed_submitted",
  "closed",
] as const;

// Confirmed/closed work is done — showing those columns by default would
// make every board mostly finished work instead of what actually needs
// attention today. Reachable via the "Show closed & confirmed" toggle
// instead of an always-on 6-column board.
const ACTIVE_STAGES = new Set<string>(["submitted", "in_review", "deliverables_ready", "client_review"]);

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function InboxBoard({
  submissions,
  stageLabels,
  stagePillStyle,
}: {
  submissions: Submission[];
  stageLabels: Record<string, string>;
  stagePillStyle: Record<string, string>;
}) {
  const [view, setView] = useState<"board" | "list">("board");
  const [needsAttentionOnly, setNeedsAttentionOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"fifo" | "due">("fifo");
  const [includeTest, setIncludeTest] = useState(true);
  const [showClosedColumns, setShowClosedColumns] = useState(false);

  const filtered = useMemo(() => {
    let rows = submissions;
    if (!includeTest) rows = rows.filter((s) => !s.is_test);
    if (needsAttentionOnly) rows = rows.filter((s) => s.pastPromise || s.isStale);

    // is_test stays the primary sort key regardless of mode — a test row
    // never gets to jump ahead of real ones just because its due date or
    // submission time is earlier, same invariant the original FIFO query
    // enforced at the DB level.
    const sorted = [...rows].sort((a, b) => {
      if (a.is_test !== b.is_test) return a.is_test ? 1 : -1;
      if (sortBy === "due") {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      const aTime = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
      const bTime = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
      return aTime - bTime;
    });
    return sorted;
  }, [submissions, includeTest, needsAttentionOnly, sortBy]);

  const visibleStages = STAGE_ORDER.filter((s) => showClosedColumns || ACTIVE_STAGES.has(s));

  const controls = (
    <div className="flex flex-wrap items-center gap-3 mt-4 mb-2">
      <div className="inline-flex rounded-lg border border-outline-variant overflow-hidden">
        <button
          type="button"
          onClick={() => setView("board")}
          className={`px-3 py-1.5 text-label-md font-semibold transition active:scale-[0.97] ${
            view === "board" ? "bg-secondary text-on-secondary" : "bg-surface-container-lowest text-on-surface hover:bg-surface-container-low"
          }`}
        >
          Board
        </button>
        <button
          type="button"
          onClick={() => setView("list")}
          className={`px-3 py-1.5 text-label-md font-semibold transition active:scale-[0.97] border-l border-outline-variant ${
            view === "list" ? "bg-secondary text-on-secondary" : "bg-surface-container-lowest text-on-surface hover:bg-surface-container-low"
          }`}
        >
          List
        </button>
      </div>

      <label className="inline-flex items-center gap-2 text-label-md text-on-surface-variant cursor-pointer">
        <input
          type="checkbox"
          checked={needsAttentionOnly}
          onChange={(e) => setNeedsAttentionOnly(e.target.checked)}
          className="rounded"
        />
        Needs attention only
      </label>

      <label className="inline-flex items-center gap-2 text-label-md text-on-surface-variant cursor-pointer">
        <input type="checkbox" checked={includeTest} onChange={(e) => setIncludeTest(e.target.checked)} className="rounded" />
        Include test submissions
      </label>

      {view === "board" && (
        <label className="inline-flex items-center gap-2 text-label-md text-on-surface-variant cursor-pointer">
          <input
            type="checkbox"
            checked={showClosedColumns}
            onChange={(e) => setShowClosedColumns(e.target.checked)}
            className="rounded"
          />
          Show closed &amp; confirmed
        </label>
      )}

      <label className="inline-flex items-center gap-2 text-label-md text-on-surface-variant ml-auto">
        Sort
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "fifo" | "due")}
          className="bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 text-label-md text-on-surface"
        >
          <option value="fifo">Submission order</option>
          <option value="due">Due date</option>
        </select>
      </label>
    </div>
  );

  function AttentionBadge({ sub }: { sub: Submission }) {
    if (sub.pastPromise) {
      return (
        <span className="inline-flex px-2.5 py-1 rounded-full text-label-sm font-bold bg-error text-on-error uppercase">
          Past due
        </span>
      );
    }
    if (sub.isStale) {
      return (
        <span className="inline-flex px-2.5 py-1 rounded-full text-label-sm font-medium bg-surface-container-highest text-on-surface-variant">
          Needs attention
        </span>
      );
    }
    return null;
  }

  if (view === "board") {
    return (
      <div>
        {controls}
        <div className="flex gap-4 overflow-x-auto pb-2">
          {visibleStages.map((stage) => {
            const cards = filtered.filter((s) => s.stage === stage);
            return (
              <div key={stage} className="flex-none w-72 bg-surface-container-low border border-outline-variant rounded-xl">
                <div className="px-3 py-2.5 border-b border-outline-variant flex items-center justify-between">
                  <span className="text-label-lg font-semibold text-on-surface">{stageLabels[stage] ?? stage}</span>
                  <span className="text-label-sm text-on-surface-variant">{cards.length}</span>
                </div>
                <div className="p-2 flex flex-col gap-2 min-h-[80px]">
                  {cards.map((sub) => (
                    <Link
                      key={sub.id}
                      href={`/admin/inbox/${sub.id}`}
                      className="block bg-surface-container-lowest border border-outline-variant rounded-lg p-3 hover:bg-surface-container transition"
                    >
                      <div className="flex items-center gap-2 min-w-0 mb-1.5">
                        <div className="w-7 h-7 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center text-[10px] font-bold shrink-0">
                          {initials(sub.clients?.company_name ?? "—")}
                        </div>
                        <span className="font-semibold text-on-surface text-label-md break-words min-w-0">
                          {sub.clients?.company_name ?? "—"}
                        </span>
                      </div>
                      <p className="text-label-sm text-on-surface-variant break-words mb-1.5">{sub.agency}</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <AttentionBadge sub={sub} />
                        {sub.is_test && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-bold uppercase">
                            Test
                          </span>
                        )}
                        <span className="text-label-sm text-on-surface-variant ml-auto">
                          {sub.due_date ? new Date(sub.due_date).toLocaleDateString() : "No due date"}
                        </span>
                      </div>
                    </Link>
                  ))}
                  {cards.length === 0 && <p className="text-label-sm text-on-surface-variant px-1 py-3 text-center">Empty</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      {controls}
      {/* Table — only once there's comfortably enough width for six columns
          of real content (long agency names, badges) without cutting
          anything off. Below that, a stacked card per submission instead —
          see the xl:hidden block below. */}
      <div className="hidden xl:block bg-surface-container-lowest border border-outline-variant rounded-xl">
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
            {filtered.map((sub) => (
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
                  <AttentionBadge sub={sub} />
                  {!sub.pastPromise && !sub.isStale && <span className="text-on-surface-variant">—</span>}
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
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-on-surface-variant">
                  No submissions match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Card list — narrower than xl (laptop widths with less room, and
          mobile). Same data, stacked instead of columned, so nothing is
          ever cut off or forces sideways scrolling. */}
      <div className="xl:hidden bg-surface-container-lowest border border-outline-variant rounded-xl divide-y divide-outline-variant">
        {filtered.map((sub) => (
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
              <AttentionBadge sub={sub} />
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
        {filtered.length === 0 && (
          <p className="px-4 py-6 text-center text-on-surface-variant">No submissions match the current filters.</p>
        )}
      </div>
    </div>
  );
}
