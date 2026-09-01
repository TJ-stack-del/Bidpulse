"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";
import { FadeMessage } from "@/components/ui/FadeMessage";

export function ThresholdSettingsForm({ orgId, initialThreshold }: { orgId: string; initialThreshold: number }) {
  const [value, setValue] = useState(String(initialThreshold));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Enter a valid dollar amount.");
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase
      .from("organizations")
      .update({ lean_package_threshold: parsed })
      .eq("id", orgId);
    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSaved(true);
  }

  return (
    <form onSubmit={handleSave} className="flex items-end gap-3 flex-wrap">
      <div>
        <label className="text-label-md text-on-surface-variant block mb-1">Threshold (USD)</label>
        <input
          type="number"
          min="0"
          step="1000"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface focus:border-secondary outline-none w-40"
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="py-2 px-4 bg-secondary text-on-secondary rounded text-label-md font-semibold hover:bg-on-secondary-container transition active:scale-[0.97] disabled:opacity-40 flex items-center gap-2"
      >
        {saving && <Spinner />}
        {saving ? "Saving…" : "Save"}
      </button>
      <FadeMessage show={saved} className="text-body-md text-secondary">
        Saved
      </FadeMessage>
      {error && <p className="text-body-md text-error w-full">{error}</p>}
    </form>
  );
}
