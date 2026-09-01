"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "./Spinner";
import { FadeMessage } from "./FadeMessage";
import { SubmissionDocuments } from "./SubmissionDocuments";
import { finalizeSubmission, type FitCheckResult } from "@/lib/submissions";

// The "Your bid file" step — upload the RFP, then either save for later or
// lock the submission. Shared by the intake wizard (a brand-new client's
// last step) and the dashboard's "complete your bid" card (an existing
// client finishing a submission an admin pre-filled from a matched
// opportunity) so both stay in sync on what "done" actually means.
export function BidFileStep({
  submissionId,
  onSubmitted,
  onFitCheck,
}: {
  submissionId: string;
  onSubmitted?: () => void;
  onFitCheck?: (result: FitCheckResult | null) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  async function handleSaveDraft() {
    setSaving(true);
    setError(null);
    await supabase
      .from("submissions")
      .update({ draft_saved_at: new Date().toISOString() })
      .eq("id", submissionId);
    setSaving(false);
    setSaved(true);
  }

  async function handleFinalSubmit() {
    setSaving(true);
    setError(null);
    try {
      await finalizeSubmission(supabase, submissionId, onFitCheck);
      onSubmitted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't submit.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SubmissionDocuments submissionId={submissionId} />

      {error && <p className="text-body-md text-error">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={handleSaveDraft}
          disabled={saving}
          className="flex-1 py-3 px-4 bg-surface border border-outline-variant rounded text-label-md hover:bg-surface-container-high transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center justify-center gap-2"
        >
          {saving && <Spinner />}
          {saving ? "Saving…" : "Save & finish later"}
        </button>
        <button
          onClick={handleFinalSubmit}
          disabled={saving}
          className="flex-1 py-3 px-4 bg-secondary text-on-secondary rounded text-label-md hover:bg-on-secondary-container transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center justify-center gap-2"
        >
          {saving && <Spinner />}
          {saving ? "Sending…" : "Send it to us"}
          {!saving && <span className="material-symbols-outlined text-[18px]">arrow_forward</span>}
        </button>
      </div>
      <FadeMessage show={saved} className="text-body-md text-secondary block">
        Saved — you can come back anytime.
      </FadeMessage>
    </div>
  );
}
