"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";

// A claim, not a fact: clicking this never moves the submission's stage
// itself (there's deliberately no dedicated pipeline stage for "client says
// they submitted" — see the removal of confirmed_submitted) — it just puts
// a clearly-flagged note in front of the admin (client_reported_submitted_at
// + an audit_log row) so a human decides what to do with it, e.g. an
// admin_notes entry or moving the stage to closed. An unverified client
// click is a signal worth surfacing, not something to trust as final on its
// own.
export function ReportSubmittedButton({
  submissionId,
  orgId,
  initialReportedAt,
}: {
  submissionId: string;
  orgId: string;
  initialReportedAt: string | null;
}) {
  const [reportedAt, setReportedAt] = useState(initialReportedAt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  async function handleClick() {
    setSaving(true);
    setError(null);
    const nowIso = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("submissions")
      .update({ client_reported_submitted_at: nowIso })
      .eq("id", submissionId);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    // No .select() here — clients can INSERT into audit_log for their own
    // submission (schema.sql's "insert audit_log" policy) but can't SELECT
    // it back (that's admin-only), so asking for a returned row would just
    // fail under RLS.
    await supabase.from("audit_log").insert({
      submission_id: submissionId,
      org_id: orgId,
      event_type: "client_reported_submitted",
      event_detail: { reported_at: nowIso },
    });

    setReportedAt(nowIso);
    setSaving(false);
  }

  if (reportedAt) {
    return (
      <p className="text-body-md text-on-surface-variant mt-3">
        You reported this submitted on {new Date(reportedAt).toLocaleString()}. Our team will confirm shortly.
      </p>
    );
  }

  return (
    <div className="mt-3">
      <button
        onClick={handleClick}
        disabled={saving}
        className="px-4 py-2 bg-secondary text-on-secondary rounded text-label-md font-bold hover:bg-on-secondary-container transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center gap-2"
      >
        {saving && <Spinner />}
        {saving ? "Saving…" : "I've submitted this"}
      </button>
      {error && <p className="text-body-md text-error mt-2">{error}</p>}
    </div>
  );
}
