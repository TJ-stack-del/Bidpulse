"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";
import { FadeMessage } from "@/components/ui/FadeMessage";

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
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  async function handleSave() {
    setError(null);
    setSaved(false);

    const trimmed = value.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
      setError("Enter a valid dollar amount, or leave blank.");
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase
      .from("submissions")
      .update({ estimated_value: parsed })
      .eq("id", submissionId);
    setSaving(false);

    if (updateError) {
      setError(updateError.message);
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
          className="px-2 py-1 rounded border border-outline-variant bg-surface text-body-md text-on-surface focus:border-secondary outline-none w-32"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1 rounded border border-outline-variant text-label-md hover:bg-surface-container-high transition disabled:opacity-40 flex items-center gap-1"
        >
          {saving && <Spinner />}
          {saving ? "Saving…" : "Save"}
        </button>
        <FadeMessage show={saved} className="text-label-md text-secondary">
          Saved
        </FadeMessage>
      </div>
      {error && <p className="text-label-md text-error mt-1">{error}</p>}
    </div>
  );
}
