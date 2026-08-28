"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ApprovePackageButton({
  bidId,
  orgId,
  actorId,
  deliverables,
  enabled,
}: {
  bidId: string;
  orgId: string;
  actorId: string;
  deliverables: { id: string; title: string }[];
  enabled: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleApprove() {
    setBusy(true);
    setError(null);

    const { error: auditError } = await supabase.from("audit_log").insert({
      bid_id: bidId,
      org_id: orgId,
      actor_id: actorId,
      event_type: "package_approved",
      event_detail: { deliverables: deliverables.map((d) => ({ id: d.id, title: d.title })) },
    });

    setBusy(false);
    if (auditError) {
      setError(auditError.message);
      return;
    }
    setApproved(true);
    router.refresh();
  }

  return (
    <div className="border-t border-outline-variant pt-6">
      {error && <p className="text-body-md text-error mb-3">{error}</p>}
      <button
        onClick={handleApprove}
        disabled={!enabled || busy}
        className="w-full bg-primary text-on-primary text-label-md py-3 rounded transition-colors flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-on-background"
      >
        <span className="material-symbols-outlined text-[18px]">task_alt</span>
        {busy ? "Approving…" : approved ? "Approved" : "Approve Package"}
      </button>
    </div>
  );
}
