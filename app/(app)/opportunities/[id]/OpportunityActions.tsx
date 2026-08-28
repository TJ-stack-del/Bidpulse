"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function OpportunityActions({
  opportunityId,
  status,
  sourceTitle,
  sourceAgency,
  orgId,
}: {
  opportunityId: string;
  status: string;
  sourceTitle: string;
  sourceAgency: string;
  orgId: string;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function setStatus(next: string) {
    setBusy(next);
    setError(null);
    const { error: updateError } = await supabase
      .from("matched_opportunities")
      .update({ status: next })
      .eq("id", opportunityId);
    setBusy(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.refresh();
  }

  async function startIntake() {
    setBusy("convert");
    setError(null);

    const { data: bid, error: bidError } = await supabase
      .from("bids")
      .insert({ org_id: orgId, title: sourceTitle, agency: sourceAgency, stage: "intake" })
      .select("id")
      .single();

    if (bidError || !bid) {
      setError(bidError?.message ?? "Unable to create a bid from this opportunity.");
      setBusy(null);
      return;
    }

    const { error: linkError } = await supabase
      .from("matched_opportunities")
      .update({ status: "converted_to_bid", bid_id: bid.id })
      .eq("id", opportunityId);

    if (linkError) {
      setError(linkError.message);
      setBusy(null);
      return;
    }

    router.push(`/intake?bid=${bid.id}`);
  }

  if (status === "converted_to_bid") {
    return <p className="text-body-md text-on-surface-variant">Already converted — see the bid above.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-body-md text-error">{error}</p>}

      <button
        onClick={startIntake}
        disabled={busy !== null}
        className="w-full py-3 px-4 bg-primary text-on-primary rounded text-label-md hover:bg-on-background transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {busy === "convert" ? "Creating bid…" : "Start Intake"}
      </button>

      {status !== "reviewed" && (
        <button
          onClick={() => setStatus("reviewed")}
          disabled={busy !== null}
          className="w-full py-2 px-4 bg-surface border border-outline-variant rounded text-label-md text-on-surface hover:bg-surface-container-low transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy === "reviewed" ? "Marking…" : "Mark Reviewed"}
        </button>
      )}

      {status === "dismissed" ? (
        <button
          onClick={() => setStatus("new")}
          disabled={busy !== null}
          className="w-full py-2 px-4 bg-surface border border-outline-variant rounded text-label-md text-on-surface hover:bg-surface-container-low transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy === "new" ? "Restoring…" : "Restore"}
        </button>
      ) : (
        <button
          onClick={() => setStatus("dismissed")}
          disabled={busy !== null}
          className="w-full py-2 px-4 bg-surface border border-outline-variant rounded text-label-md text-error hover:bg-error-container/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy === "dismissed" ? "Dismissing…" : "Dismiss"}
        </button>
      )}
    </div>
  );
}
