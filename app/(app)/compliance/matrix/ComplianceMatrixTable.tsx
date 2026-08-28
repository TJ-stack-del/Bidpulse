"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { recordComplianceStatusChange } from "@/lib/compliance/record-status-change";
import { triggerDownload } from "@/lib/audit/export";

const STATUS_OPTIONS = ["not_started", "in_progress", "passed", "failed", "waived"];

const STATUS_STYLE: Record<string, string> = {
  passed: "bg-[#E6F4EA] text-on-tertiary-container border-on-tertiary-container/20",
  in_progress: "bg-surface-container text-secondary border-secondary/20",
  not_started: "bg-surface-container-low text-on-surface-variant border-outline-variant",
  failed: "bg-error-container text-on-error-container border-on-error-container/20",
  waived: "bg-surface-container-highest text-on-surface-variant border-outline-variant",
};

type Item = {
  id: string;
  clause_reference: string;
  requirement: string;
  status: string;
  team_members: { full_name: string } | null;
};

export function ComplianceMatrixTable({
  items,
  bidId,
  orgId,
  actorId,
}: {
  items: Item[];
  bidId: string;
  orgId: string;
  actorId: string;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleChange(item: Item, nextStatus: string) {
    setBusyId(item.id);
    setError(null);
    try {
      await recordComplianceStatusChange(supabase, {
        itemId: item.id,
        bidId,
        orgId,
        actorId,
        clauseReference: item.clause_reference,
        fromStatus: item.status,
        toStatus: nextStatus,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update status.");
    } finally {
      setBusyId(null);
    }
  }

  function handleExport() {
    const header = ["Clause", "Requirement", "Status", "Owner"];
    const rows = items.map((item) => [
      item.clause_reference,
      item.requirement.replace(/"/g, '""'),
      item.status,
      item.team_members?.full_name ?? "Unassigned",
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    triggerDownload(csv, `compliance-matrix-${bidId}.csv`, "text/csv");
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex justify-end px-4 pt-3">
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-3 py-1.5 border border-outline-variant text-on-surface text-label-md rounded hover:bg-surface-container-low transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">download</span>
          Export CSV
        </button>
      </div>
      {error && <p className="text-body-md text-error px-6 pt-2">{error}</p>}
      <table className="w-full text-left border-collapse mt-2">
        <thead>
          <tr className="bg-surface-container-low border-b border-outline-variant text-label-md text-on-surface-variant uppercase tracking-wider">
            <th className="px-4 py-3 font-medium w-[15%]">Clause ID</th>
            <th className="px-4 py-3 font-medium w-[40%]">Requirement</th>
            <th className="px-4 py-3 font-medium w-[15%]">Status</th>
            <th className="px-4 py-3 font-medium w-[15%]">Owner</th>
            <th className="px-4 py-3 font-medium text-right w-[15%]">Actions</th>
          </tr>
        </thead>
        <tbody className="text-body-md divide-y divide-outline-variant/40">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-surface-container-low transition-colors">
              <td className="px-4 py-3 align-top font-code text-code-sm text-on-surface whitespace-nowrap">
                {item.clause_reference}
              </td>
              <td className="px-4 py-3 align-top text-on-surface-variant line-clamp-2" title={item.requirement}>
                {item.requirement}
              </td>
              <td className="px-4 py-3 align-top">
                <select
                  value={item.status}
                  disabled={busyId === item.id}
                  onChange={(e) => handleChange(item, e.target.value)}
                  className={`text-[11px] uppercase tracking-wider font-label-md px-2 py-1 rounded-full border focus:outline-none disabled:opacity-50 ${STATUS_STYLE[item.status]}`}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3 align-top text-on-surface-variant text-body-md">
                {item.team_members?.full_name ?? "Unassigned"}
              </td>
              <td className="px-4 py-3 align-top text-right">
                <Link
                  href={`/compliance/${item.id}?bid=${bidId}`}
                  className="text-secondary text-label-md hover:underline"
                >
                  Review
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
