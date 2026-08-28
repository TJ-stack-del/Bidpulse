"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AuthorizeButton({
  bidId,
  orgId,
  actorId,
  canAuthorize,
}: {
  bidId: string;
  orgId: string;
  actorId: string;
  canAuthorize: boolean;
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
      .update({ stage: "client_review" })
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
      event_detail: { action: "admin_audit_signoff", from_stage: "admin_audit", to_stage: "client_review" },
    });

    setBusy(false);
    if (auditError) {
      setError(auditError.message);
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <div>
      {error && <p className="text-body-md text-error mb-3">{error}</p>}
      <button
        onClick={handleAuthorize}
        disabled={!canAuthorize || busy}
        className="w-full bg-primary text-on-primary text-headline-md py-4 rounded border border-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-on-background"
      >
        {busy ? "Authorizing…" : "Authorize for Client Review"}
      </button>
    </div>
  );
}
