"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { generateDeliverablesPacket } from "@/lib/pdf/deliverables-packet";

const DELIVERABLE_LABELS: Record<string, string> = {
  capability_statement: "Capability Statement",
  compliance_matrix: "Compliance Matrix",
  technical_narrative: "Technical Narrative",
  rate_sheet: "Rate Sheet",
  executive_cover: "Executive Cover",
  certificate_of_insurance: "Certificate of Insurance",
};
const FULL_ORDER = ["capability_statement", "compliance_matrix", "technical_narrative"];
const LEAN_ORDER = ["rate_sheet", "executive_cover", "certificate_of_insurance"];

// Drop this on both the admin submission detail page and the client
// dashboard: <PacketButtons submissionId={...} orgId={...} viewerRole="admin" | "client" />
//
// IMPORTANT: Preview never generates a real PDF file. Opening an actual
// PDF in a new tab uses the browser's own built-in viewer, which has its
// own download/print buttons — that would bypass the paywall entirely,
// since that's the browser's UI, not ours. Preview instead shows the
// same content as plain read-only text in an in-app modal, with no
// native save/print controls at all. Only Download produces a real file,
// and stays gated the same way the individual deliverable downloads are.
export function PacketButtons({
  submissionId,
  orgId,
  viewerRole,
}: {
  submissionId: string;
  orgId: string;
  viewerRole: "admin" | "client";
}) {
  const [generating, setGenerating] = useState<"preview" | "download" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{
    submission: any;
    deliverables: any[];
  } | null>(null);
  const supabase = createClient();

  // Admin viewing their own work-in-progress isn't a signal worth
  // recording — only the client's own view/download tells the admin
  // "they actually looked at this." No .select() on the insert: clients
  // can write to audit_log for their own submission but can't read it
  // back (admin-only per schema.sql), so asking for a returned row would
  // fail under RLS.
  async function logClientEvent(eventType: "client_viewed_packet" | "client_downloaded_packet") {
    if (viewerRole !== "client") return;
    await supabase.from("audit_log").insert({
      submission_id: submissionId,
      org_id: orgId,
      event_type: eventType,
    });
  }

  async function buildDoc() {
    const { data: submission, error: subError } = await supabase
      .from("submissions")
      .select(
        "agency, solicitation_number, due_date, scope, package_id, clients(company_name, contact_name, email, phone, naics_codes, set_asides, license_number, years_in_business, business_address, business_phone, insurance_provider, insurance_policy_number, general_liability_coverage, workers_comp_coverage, client_certifications(cert_type, other_label, verified))"
      )
      .eq("id", submissionId)
      .single();

    if (subError || !submission) throw new Error("Couldn't load this bid's details.");

    const { data: deliverables } = await supabase
      .from("deliverables")
      .select("deliverable_type, content, file_url")
      .eq("submission_id", submissionId);

    return { submission, deliverables: deliverables ?? [] };
  }

  async function isPaidOrPilot(packageId: string | null): Promise<boolean> {
    if (!packageId) return false;
    const { data: pkg } = await supabase
      .from("packages")
      .select("paid, package_type")
      .eq("id", packageId)
      .single();
    return !!pkg && (pkg.paid || pkg.package_type === "pilot");
  }

  async function handlePreview() {
    setGenerating("preview");
    setError(null);
    try {
      const { submission, deliverables } = await buildDoc();
      setPreviewData({ submission, deliverables });
      await logClientEvent("client_viewed_packet");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the preview.");
    } finally {
      setGenerating(null);
    }
  }

  async function handleDownload() {
    setGenerating("download");
    setError(null);
    try {
      const { submission, deliverables } = await buildDoc();
      // Admin is the one producing this packet in the first place — the
      // payment gate exists to stop a CLIENT getting the finished file
      // before they've paid, not to stop staff pulling their own work
      // product to QC it or send it manually.
      const canDownload = viewerRole === "admin" || (await isPaidOrPilot(submission.package_id));
      if (!canDownload) {
        setError("Available once payment is confirmed.");
        return;
      }
      const doc = generateDeliverablesPacket(submission as any, deliverables);
      doc.save(`bid-package-${submission.agency.replace(/\s+/g, "-").toLowerCase()}.pdf`);
      await logClientEvent("client_downloaded_packet");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't build the download.");
    } finally {
      setGenerating(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3">
        <button
          onClick={handlePreview}
          disabled={generating !== null}
          className="px-4 py-2 rounded border border-secondary text-secondary text-label-md font-bold hover:bg-surface-container-low transition-colors disabled:opacity-40"
        >
          {generating === "preview" ? "Loading…" : "Preview packet"}
        </button>
        <button
          onClick={handleDownload}
          disabled={generating !== null}
          className="px-4 py-2 rounded bg-primary text-on-primary text-label-md font-bold hover:bg-on-background transition-colors disabled:opacity-40"
        >
          {generating === "download" ? "Building…" : "Download packet"}
        </button>
      </div>
      {error && <p className="text-body-md text-error">{error}</p>}

      {previewData && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6"
          onClick={() => setPreviewData(null)}
        >
          <div
            className="bg-surface-container-lowest rounded-xl max-w-2xl w-full max-h-[80vh] relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Watermark only — never appears in the actual downloaded PDF,
                which stays client-branded. Just a visual reminder that this
                in-app modal is a preview, not the deliverable itself. */}
            <Image
              src="/logo.png"
              alt=""
              aria-hidden="true"
              width={134}
              height={40}
              className="absolute bottom-4 right-4 h-6 w-auto opacity-10 pointer-events-none select-none"
            />

            <div className="max-h-[80vh] overflow-y-auto p-8">
              <button
                onClick={() => setPreviewData(null)}
                className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface text-label-md font-bold"
              >
                Close
              </button>
              <p className="text-label-md text-error font-bold mb-4 uppercase tracking-wide">
                Preview only — not for distribution
              </p>
              <h2 className="text-headline-md text-on-surface mb-1">
                {previewData.submission.clients?.company_name}
              </h2>
              <p className="text-body-md text-on-surface-variant mb-6">
                {previewData.submission.agency}
              </p>
              {(previewData.deliverables.some((d) => LEAN_ORDER.includes(d.deliverable_type))
                ? LEAN_ORDER
                : FULL_ORDER
              ).map((type) => {
                const d = previewData.deliverables.find((x) => x.deliverable_type === type);
                return (
                  <div key={type} className="mb-6">
                    <h3 className="text-title-lg text-on-surface font-bold mb-2">
                      {DELIVERABLE_LABELS[type]}
                    </h3>
                    <p className="text-body-md text-on-surface-variant whitespace-pre-wrap select-none">
                      {d?.content || "Not yet prepared."}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
