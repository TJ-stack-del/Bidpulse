"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { recordComplianceStatusChange } from "@/lib/compliance/record-status-change";

const STATUS_LABEL: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "Working On It",
  passed: "Done",
  failed: "Problem",
  waived: "Not Needed",
};

export function ComplianceItemActions({
  itemId,
  bidId,
  orgId,
  actorId,
  clauseReference,
  currentStatus,
  currentNotes,
  statusOptions,
}: {
  itemId: string;
  bidId: string;
  orgId: string;
  actorId: string;
  clauseReference: string;
  currentStatus: string;
  currentNotes: string;
  statusOptions: string[];
}) {
  const [status, setStatus] = useState(currentStatus);
  const [notes, setNotes] = useState(currentNotes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await recordComplianceStatusChange(supabase, {
        itemId,
        bidId,
        orgId,
        actorId,
        clauseReference,
        fromStatus: currentStatus,
        toStatus: status,
        notes,
      });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-body-md text-error">{error}</p>}
      {saved && !error && <p className="text-body-md text-on-tertiary-container">Saved.</p>}

      <label className="flex flex-col gap-1">
        <span className="text-label-md text-on-surface-variant uppercase tracking-wider">Status</span>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="bg-surface border border-outline-variant rounded px-3 py-2 text-body-md text-on-surface focus:outline-none focus:border-secondary transition-colors"
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s] ?? s.replace("_", " ")}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-label-md text-on-surface-variant uppercase tracking-wider">Notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          placeholder="Write what you checked and what's still left to do..."
          className="bg-surface border border-outline-variant rounded px-3 py-2 text-body-md text-on-surface focus:outline-none focus:border-secondary transition-colors resize-none"
        />
      </label>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 px-4 bg-primary text-on-primary rounded text-label-md hover:bg-on-background transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
