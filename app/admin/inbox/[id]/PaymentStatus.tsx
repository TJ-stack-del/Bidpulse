"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";

// Payment gate for deliverable downloads: toggles packages.paid for the
// submission's linked package_id. A submission with no package_id yet has
// nothing to toggle — the client dashboard already treats that as unpaid.
export function PaymentStatus({
  submissionId,
  orgId,
  actorId,
  packageId,
  packageType,
  initialPaid,
  initialPaidAt,
}: {
  submissionId: string;
  orgId: string;
  actorId: string;
  packageId: string | null;
  packageType: string | null;
  initialPaid: boolean;
  initialPaidAt: string | null;
}) {
  const [paid, setPaid] = useState(initialPaid);
  const [paidAt, setPaidAt] = useState(initialPaidAt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  // Pilot packages are never paywalled ("on us to prove the process") — the
  // client dashboard unlocks their downloads regardless of this flag. Kept
  // in sync with the isPaid check in dashboard/page.tsx.
  const isPilot = packageType === "pilot";

  async function handleToggle() {
    if (!packageId) return;
    setSaving(true);
    setError(null);

    const nextPaid = !paid;
    const nextPaidAt = nextPaid ? new Date().toISOString() : null;

    const { error: updateError } = await supabase
      .from("packages")
      .update({ paid: nextPaid, paid_at: nextPaidAt })
      .eq("id", packageId);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    await supabase.from("audit_log").insert({
      submission_id: submissionId,
      org_id: orgId,
      actor_id: actorId,
      event_type: nextPaid ? "payment_marked_paid" : "payment_marked_unpaid",
      event_detail: { package_id: packageId },
    });

    setPaid(nextPaid);
    setPaidAt(nextPaidAt);
    setSaving(false);
  }

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
      <h2 className="text-title-lg text-primary mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-secondary text-[20px]">payments</span>
        Payment
      </h2>

      {!packageId ? (
        <p className="text-body-md text-on-surface-variant">
          No package linked to this submission yet — link one before payment can be tracked.
          Deliverable downloads stay locked for the client until then.
        </p>
      ) : (
        <>
          {isPilot && (
            <p className="text-label-md text-secondary mb-2 uppercase tracking-wider font-bold">
              Pilot package — downloads are unlocked for the client regardless of this flag
            </p>
          )}
          <p className="text-body-md text-on-surface-variant mb-3">
            {paid ? (
              <>
                Paid{paidAt ? ` ${new Date(paidAt).toLocaleString()}` : ""}. Deliverable
                downloads are unlocked for the client.
              </>
            ) : isPilot ? (
              "Not marked paid. Downloads are still unlocked since this is a pilot package."
            ) : (
              "Not paid yet. Deliverable downloads stay locked for the client until marked paid."
            )}
          </p>
          <button
            onClick={handleToggle}
            disabled={saving}
            className={`px-4 py-2 rounded text-label-md font-bold transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center gap-2 ${
              paid
                ? "border border-outline-variant text-on-surface hover:bg-surface-container-high"
                : "bg-secondary text-on-secondary hover:bg-on-secondary-container"
            }`}
          >
            {saving && <Spinner />}
            {saving ? "Saving…" : paid ? "Mark as unpaid" : "Mark as paid"}
          </button>
          {error && <p className="text-body-md text-error mt-2">{error}</p>}
        </>
      )}
    </div>
  );
}
