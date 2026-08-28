"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Shared by /review/portal ("Sign-Off & Authorize") and /review/feedback
// ("Complete Review Phase") — both do the same thing: advance the bid from
// client_review to submission once every deliverable has been approved.
export function AuthorizeReviewButton({
  bidId,
  orgId,
  actorId,
  enabled,
  label,
}: {
  bidId: string;
  orgId: string;
  actorId: string;
  enabled: boolean;
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleAuthorize() {
    setBusy(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("bids")
      .update({ stage: "submission" })
      .eq("id", bidId);

    if (updateError) {
      setError(updateError.message);
      setBusy(false);
      return;
    }

    const { error: auditError } = await supabase.from("audit_log").insert({
      bid_id: bidId,
      org_id: orgId,
      actor_id: actorId,
      event_type: "sign_off",
      event_detail: { action: "client_review_authorization", from_stage: "client_review", to_stage: "submission" },
    });

    setBusy(false);
    if (auditError) {
      setError(auditError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      {error && <p className="text-body-md text-error mb-2">{error}</p>}
      <button
        onClick={handleAuthorize}
        disabled={!enabled || busy}
        className="w-full bg-primary text-on-primary font-label-md text-label-md py-3 rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-on-background"
      >
        <span className="material-symbols-outlined text-[18px]">{enabled ? "lock_open" : "lock"}</span>
        {busy ? "Authorizing…" : label}
      </button>
    </div>
  );
}
