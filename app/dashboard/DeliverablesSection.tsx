"use client";

import { useState } from "react";
import { PacketButtons } from "@/components/ui/PacketButtons";

type Deliverable = {
  id: string;
  deliverable_type: string;
  file_url: string | null;
  content: string | null;
  created_at: string;
};

const DELIVERABLE_TYPE_LABELS: Record<string, string> = {
  capability_statement: "Capability statement",
  compliance_matrix: "Compliance matrix",
  technical_narrative: "Technical narrative",
  rate_sheet: "Rate sheet",
  executive_cover: "Executive cover",
  certificate_of_insurance: "Certificate of insurance",
};

function triggerTextDownload(deliverableType: string, content: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${deliverableType}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// Preview is always available (read-only, non-selectable — a look at
// quality/format, not a way to lift the content wholesale); Download only
// unlocks once the linked package's paid flag is true. A submission with no
// package_id yet (or a package the paid lookup came back empty for) is
// handled upstream in page.tsx by treating `paid` as false here.
export function DeliverablesSection({
  submissionId,
  orgId,
  deliverables,
  paid,
}: {
  submissionId: string;
  orgId: string;
  deliverables: Deliverable[];
  paid: boolean;
}) {
  const [previewing, setPreviewing] = useState<Deliverable | null>(null);

  function handleDownload(d: Deliverable) {
    if (!paid) return;
    if (d.file_url) {
      window.open(d.file_url, "_blank", "noopener,noreferrer");
    } else if (d.content) {
      triggerTextDownload(d.deliverable_type, d.content);
    }
  }

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low">
        <h2 className="text-title-lg text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary text-[20px]">download</span>
          Your deliverables
        </h2>
      </div>

      {deliverables.length > 0 ? (
        <div className="flex flex-col">
          {deliverables.map((d) => {
            const hasContent = !!(d.file_url || d.content);
            return (
              <div key={d.id} className="px-6 py-4 border-b border-outline-variant last:border-b-0">
                <p className="text-label-md text-on-surface-variant uppercase tracking-wider mb-2">
                  {DELIVERABLE_TYPE_LABELS[d.deliverable_type] ?? d.deliverable_type}
                </p>

                {hasContent ? (
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={() => setPreviewing(d)}
                      className="px-4 py-2 rounded border border-secondary text-secondary text-label-md font-bold hover:bg-surface-container-low transition active:scale-[0.97]"
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => handleDownload(d)}
                      disabled={!paid}
                      title={paid ? undefined : "Available once payment is confirmed"}
                      className="px-4 py-2 rounded bg-secondary text-on-secondary text-label-md font-bold hover:bg-on-secondary-container transition active:scale-[0.97] disabled:opacity-40 disabled:hover:bg-secondary disabled:active:scale-100 disabled:cursor-not-allowed"
                    >
                      Download
                    </button>
                    {!paid && (
                      <span className="text-label-md text-on-surface-variant">
                        Available once payment is confirmed
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-body-md text-on-surface-variant">Being prepared.</p>
                )}
              </div>
            );
          })}
          <div className="px-6 py-4">
            <p className="text-label-md text-on-surface-variant uppercase tracking-wider mb-2">
              Complete bid package
            </p>
            <PacketButtons submissionId={submissionId} orgId={orgId} viewerRole="client" />
          </div>
        </div>
      ) : (
        <p className="text-body-md text-on-surface-variant px-6 py-6">Being prepared.</p>
      )}

      {previewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setPreviewing(null)}
        >
          <div
            className="bg-surface-container-lowest rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between">
              <h3 className="text-title-lg text-primary">
                {DELIVERABLE_TYPE_LABELS[previewing.deliverable_type] ?? previewing.deliverable_type}
              </h3>
              <button
                onClick={() => setPreviewing(null)}
                className="text-on-surface-variant hover:text-on-surface"
                aria-label="Close preview"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="px-6 py-4 overflow-y-auto">
              <p className="text-label-md text-on-surface-variant mb-3">
                Preview only — enough to see quality and format.
              </p>
              {previewing.content ? (
                <p
                  className="text-body-md text-on-surface whitespace-pre-wrap select-none"
                  onContextMenu={(e) => e.preventDefault()}
                  onCopy={(e) => e.preventDefault()}
                >
                  {previewing.content}
                </p>
              ) : previewing.file_url ? (
                <iframe
                  src={previewing.file_url}
                  className="w-full h-[60vh] border border-outline-variant rounded"
                  title="Deliverable preview"
                />
              ) : (
                <p className="text-body-md text-on-surface-variant">Being prepared.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
