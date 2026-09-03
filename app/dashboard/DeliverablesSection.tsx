"use client";

import { PacketButtons } from "@/components/ui/PacketButtons";

type Deliverable = {
  id: string;
  deliverable_type: string;
  file_url: string | null;
  content: string | null;
  created_at: string;
};

// Simplified per Mike's ask: one Preview/Download pair for the complete
// packet (PacketButtons), not a separate Preview/Download row per
// deliverable type plus a combined packet below it -- that read as
// redundant, since PacketButtons' own preview modal already breaks out
// every deliverable type with its own heading in one place, and its
// download already produces the full combined PDF. The one real
// capability this drops: downloading a single deliverable type on its
// own as a raw .txt file (the old per-row Download did that) -- only the
// full packet can be downloaded now.
export function DeliverablesSection({
  submissionId,
  orgId,
  deliverables,
}: {
  submissionId: string;
  orgId: string;
  deliverables: Deliverable[];
}) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low">
        <h2 className="text-title-lg text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary text-[20px]">download</span>
          Your deliverables
        </h2>
      </div>

      {deliverables.length > 0 ? (
        <div className="px-6 py-4">
          <PacketButtons submissionId={submissionId} orgId={orgId} viewerRole="client" />
        </div>
      ) : (
        <p className="text-body-md text-on-surface-variant px-6 py-6">Being prepared.</p>
      )}
    </div>
  );
}
