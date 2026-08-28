"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function IntakeActions({
  bidId,
  alreadyAttested,
}: {
  bidId: string | null;
  alreadyAttested: boolean;
}) {
  const [attested, setAttested] = useState(alreadyAttested);
  const [submitting, setSubmitting] = useState(false);
  const supabase = createClient();

  async function handleSubmit() {
    if (!bidId || !attested) return;
    setSubmitting(true);

    // 1. Record the attestation + advance the stage.
    await supabase
      .from("bids")
      .update({ pia_attested: true, pia_attested_at: new Date().toISOString(), stage: "compliance_review" })
      .eq("id", bidId);

    // 2. Write an immutable audit_log row — never update/delete this table.
    await supabase.from("audit_log").insert({
      bid_id: bidId,
      event_type: "attestation",
      event_detail: { event: "pia_attested" },
    });

    setSubmitting(false);
  }

  return (
    <>
      <label className="flex items-start gap-3 cursor-pointer group mb-6">
        <input
          type="checkbox"
          checked={attested}
          onChange={(e) => setAttested(e.target.checked)}
          className="peer appearance-none w-5 h-5 border border-outline-variant rounded bg-surface checked:bg-secondary checked:border-secondary transition-colors cursor-pointer mt-1"
        />
        <span className="text-body-md text-on-surface group-hover:text-primary transition-colors">
          I read this and agree to bid fairly and honestly on this job.{" "}
          <span className="text-error">*</span>
        </span>
      </label>

      <button
        onClick={handleSubmit}
        disabled={!attested || submitting}
        className="w-full py-3 px-4 bg-primary text-on-primary rounded text-label-md hover:bg-on-background transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <span className="material-symbols-outlined text-[18px]">send</span>
        {submitting ? "Sending…" : "Send This In"}
      </button>
    </>
  );
}
