"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";
import { FadeMessage } from "@/components/ui/FadeMessage";
import { useToast } from "@/components/Toast";

// Admin-entered only — never asked of the client at intake, and often not
// known yet at that point anyway. Feeds the lean-package suggestion in
// DeliverablesPanel once both this and the org's threshold are on file —
// refreshing the (server-rendered) page after save is what gets the new
// value to that sibling component, rather than lifting state up.
export function EstimatedValueInput({
  submissionId,
  initialValue,
}: {
  submissionId: string;
  initialValue: number | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue != null ? String(initialValue) : "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const supabase = createClient();
  const { showToast } = useToast();

  // Fills the field with a real, agency-stated contract ceiling pulled from
  // the uploaded RFP, when there is one -- never writes it, and never
  // invents a number when the RFP doesn't state one. See
  // lib/bid-estimation.ts for why this can't yet fall back to a
  // benchmark-derived guess (no verified rate-table data exists).
  async function handleEstimateFromRfp() {
    setEstimating(true);
    setSaved(false);
    try {
      const res = await fetch("/api/estimate-bid-value", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Couldn't estimate a value.");

      if (data.estimatedValue != null) {
        setValue(String(data.estimatedValue));
        showToast("Filled in from the RFP's stated contract ceiling. Review, then Save.", "success");
      } else if (data.reason === "no_rfp_document") {
        showToast("No RFP document uploaded yet to estimate from.", "error");
      } else {
        showToast("The RFP doesn't state a contract ceiling. Enter a value manually if you have one.", "error");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't estimate a value.", "error");
    } finally {
      setEstimating(false);
    }
  }

  async function handleSave() {
    setSaved(false);

    const trimmed = value.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
      showToast("Enter a valid dollar amount, or leave blank.", "error");
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase
      .from("submissions")
      .update({ estimated_value: parsed })
      .eq("id", submissionId);
    setSaving(false);

    if (updateError) {
      showToast(updateError.message, "error");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div>
      <span className="text-label-md text-on-surface-variant block">Estimated value</span>
      <div className="flex items-center gap-2 mt-1">
        <input
          type="number"
          min="0"
          step="1000"
          placeholder="Not set"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="px-2 py-1 rounded border border-outline-variant bg-surface text-body-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary w-32"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1 rounded border border-outline-variant text-label-md hover:bg-surface-container-high transition disabled:opacity-40 flex items-center gap-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {saving && <Spinner />}
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={handleEstimateFromRfp}
          disabled={estimating}
          className="px-3 py-1 rounded border border-outline-variant text-label-md text-on-surface-variant hover:bg-surface-container-high transition disabled:opacity-40 flex items-center gap-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {estimating && <Spinner />}
          {estimating ? "Checking RFP…" : "Estimate from RFP"}
        </button>
        <FadeMessage show={saved} className="text-label-md text-primary">
          Saved
        </FadeMessage>
      </div>
    </div>
  );
}
