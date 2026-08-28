"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { recordComplianceStatusChange } from "@/lib/compliance/record-status-change";

const STATUS_OPTIONS = ["not_started", "in_progress", "passed", "failed", "waived"];

const STATUS_LABEL: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "Working On It",
  passed: "Done",
  failed: "Problem",
  waived: "Not Needed",
};

const STATUS_STYLE: Record<string, string> = {
  passed: "bg-[#E6F4EA] text-on-tertiary-container border-on-tertiary-container/20",
  in_progress: "bg-surface-container text-secondary border-secondary/20",
  not_started: "bg-surface-container-low text-on-surface-variant border-outline-variant",
  failed: "bg-error-container text-on-error-container border-on-error-container/20",
  waived: "bg-surface-container-highest text-on-surface-variant border-outline-variant",
};

type Item = { id: string; clause_reference: string; requirement: string; status: string };

export function ComplianceChecklist({
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

  return (
    <div className="w-full overflow-x-auto">
      {error && <p className="text-body-md text-error px-6 pt-4">{error}</p>}
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-surface-container-low border-b border-outline-variant text-label-md text-on-surface-variant uppercase tracking-wider">
            <th className="px-6 py-3 font-medium">Rule</th>
            <th className="px-6 py-3 font-medium">What's Required</th>
            <th className="px-6 py-3 font-medium">Status</th>
            <th className="px-6 py-3 font-medium text-right">Check</th>
          </tr>
        </thead>
        <tbody className="text-body-md">
          {items.map((item) => (
            <tr key={item.id} className="border-b border-outline-variant last:border-b-0">
              <td className="px-6 py-3 font-code text-code-sm text-on-surface whitespace-nowrap">
                {item.clause_reference}
              </td>
              <td className="px-6 py-3 text-on-surface-variant max-w-xs truncate" title={item.requirement}>
                {item.requirement}
              </td>
              <td className="px-6 py-3">
                <select
                  value={item.status}
                  disabled={busyId === item.id}
                  onChange={(e) => handleChange(item, e.target.value)}
                  className={`text-[11px] uppercase tracking-wider font-label-md px-2 py-1 rounded-full border focus:outline-none disabled:opacity-50 ${STATUS_STYLE[item.status]}`}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-6 py-3 text-right">
                <Link
                  href={`/compliance/${item.id}?bid=${bidId}`}
                  className="text-secondary text-label-md hover:underline"
                >
                  Check
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
