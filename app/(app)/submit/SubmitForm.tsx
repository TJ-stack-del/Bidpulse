"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { calculateSha256 } from "@/lib/audit/export";

type Deliverable = { id: string; title: string; artifact_type: string; version: number };

export function SubmitForm({
  bidId,
  bidTitle,
  bidAgency,
  solicitationNumber,
  orgId,
  actorId,
  deliverables,
}: {
  bidId: string;
  bidTitle: string;
  bidAgency: string;
  solicitationNumber: string | null;
  orgId: string;
  actorId: string;
  deliverables: Deliverable[];
}) {
  const [method, setMethod] = useState("sam");
  const [confirmationNumber, setConfirmationNumber] = useState("");
  const [sealedDocumentUrl, setSealedDocumentUrl] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleExecute() {
    if (!acknowledged) return;
    setSubmitting(true);
    setError(null);

    const submittedAt = new Date().toISOString();
    const checksum = await calculateSha256(
      JSON.stringify({
        bidId,
        bidTitle,
        bidAgency,
        solicitationNumber,
        deliverables: deliverables.map((d) => ({ id: d.id, title: d.title, version: d.version })),
        method,
        confirmationNumber,
        submittedAt,
      })
    );

    const { error: insertError } = await supabase.from("submissions").insert({
      bid_id: bidId,
      submitted_by: actorId,
      submission_method: method,
      confirmation_number: confirmationNumber || null,
      sealed_document_url: sealedDocumentUrl || null,
      submitted_at: submittedAt,
    });

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    const { error: bidError } = await supabase.from("bids").update({ status: "submitted" }).eq("id", bidId);
    if (bidError) {
      setError(bidError.message);
      setSubmitting(false);
      return;
    }

    const { error: auditError } = await supabase.from("audit_log").insert({
      bid_id: bidId,
      org_id: orgId,
      actor_id: actorId,
      event_type: "submission",
      event_detail: {
        method,
        confirmation_number: confirmationNumber || null,
        checksum,
        deliverable_count: deliverables.length,
      },
    });

    setSubmitting(false);
    if (auditError) {
      setError(auditError.message);
      return;
    }

    router.push(`/submit/receipt?bid=${bidId}`);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4">
      {error && <p className="lg:col-span-12 text-body-md text-error">{error}</p>}

      <div className="lg:col-span-7 flex flex-col gap-6">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3 border-b border-outline-variant pb-4">
            <span className="material-symbols-outlined text-secondary text-2xl">verified_user</span>
            <h3 className="text-title-lg text-on-surface">What You're Sending</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-label-md text-on-surface-variant uppercase tracking-wider">Files</span>
              <span className="text-body-lg text-on-surface font-medium">
                {deliverables.length} file{deliverables.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-label-md text-on-surface-variant uppercase tracking-wider">Job Number</span>
              <span className="text-body-lg text-on-surface font-medium">{solicitationNumber ?? bidAgency}</span>
            </div>
          </div>
          {deliverables.length > 0 && (
            <ul className="flex flex-col gap-1 mt-2">
              {deliverables.map((d) => (
                <li key={d.id} className="text-body-md text-on-surface-variant">
                  · {d.title} (v{d.version})
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 flex flex-col gap-6">
          <div className="flex items-center gap-3 border-b border-outline-variant pb-4">
            <span className="material-symbols-outlined text-on-surface-variant text-2xl">upload_file</span>
            <h3 className="text-title-lg text-on-surface">Proof You Sent It</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <label className="flex flex-col gap-2">
              <span className="text-label-md text-on-surface-variant">How You Sent It</span>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full h-10 px-3 rounded border border-outline-variant bg-surface text-body-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
              >
                <option value="sam">SAM.gov Website</option>
                <option value="email">Email</option>
                <option value="portal">Agency's Website</option>
                <option value="hand_delivery">Hand Delivery</option>
              </select>
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-label-md text-on-surface-variant">Confirmation Number</span>
              <input
                type="text"
                value={confirmationNumber}
                onChange={(e) => setConfirmationNumber(e.target.value)}
                placeholder="e.g. SUB-992-XYZ"
                className="w-full h-10 px-3 rounded border border-outline-variant bg-surface text-body-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
              />
            </label>
          </div>
          <label className="flex flex-col gap-2">
            <span className="text-label-md text-on-surface-variant">Link to Your Receipt</span>
            <input
              type="url"
              value={sealedDocumentUrl}
              onChange={(e) => setSealedDocumentUrl(e.target.value)}
              placeholder="Paste a link to your confirmation"
              className="w-full h-10 px-3 rounded border border-outline-variant bg-surface text-body-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
            />
          </label>
        </div>
      </div>

      <div className="lg:col-span-5 flex flex-col gap-6">
        <div className="bg-primary-container text-on-primary rounded-lg p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-tertiary-fixed text-2xl">gavel</span>
              <h3 className="text-title-lg font-bold text-on-primary">Last Step</h3>
            </div>
            <p className="text-body-md text-primary-fixed-dim mb-6 leading-relaxed">
              By clicking the button below, you're legally promising that everything here is true,
              complete, and follows the job's rules. You can't undo this once you click it — it gets
              saved in our records for good.
            </p>
            <label className="flex items-start gap-3 cursor-pointer mb-8">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-1"
              />
              <span className="text-body-md text-on-primary">
                I understand this is final, and I'm ready to send it in.
              </span>
            </label>
          </div>
          <button
            onClick={handleExecute}
            disabled={!acknowledged || submitting}
            className="w-full py-4 px-6 bg-secondary hover:bg-on-secondary-fixed-variant text-on-secondary text-title-lg rounded flex items-center justify-center gap-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined">lock_open</span>
            {submitting ? "Sending…" : "Send It In"}
          </button>
        </div>
      </div>
    </div>
  );
}
