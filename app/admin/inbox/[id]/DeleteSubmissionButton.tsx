"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDeleteDialog } from "@/components/ui/ConfirmDeleteDialog";
import { useToast } from "@/components/Toast";

// Single-record delete, admin-only, real confirmation required — not a
// bulk "clean up test data" tool. is_test can't be trusted to safely
// bulk-delete by itself (it's already been found wrong on at least one
// real-looking row), so this stays a deliberate one-at-a-time action.
//
// The audit_log row is written BEFORE the delete, not after: submissions
// cascades deliverables/checklist_items/admin_notes on delete, but
// audit_log.submission_id is ON DELETE SET NULL specifically so this
// record survives — event_detail keeps the identifying info (agency,
// client, submission id) even once submission_id itself goes null.
export function DeleteSubmissionButton({
  submissionId,
  orgId,
  actorId,
  agency,
  companyName,
}: {
  submissionId: string;
  orgId: string;
  actorId: string;
  agency: string;
  companyName: string;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const supabase = createClient();
  const router = useRouter();
  const { showToast } = useToast();

  async function handleConfirm() {
    setDeleting(true);

    await supabase.from("audit_log").insert({
      submission_id: submissionId,
      org_id: orgId,
      actor_id: actorId,
      event_type: "submission_deleted",
      event_detail: { agency, company_name: companyName, submission_id: submissionId },
    });

    const { error } = await supabase.from("submissions").delete().eq("id", submissionId);

    if (error) {
      showToast(error.message, "error");
      setDeleting(false);
      return;
    }

    router.push("/admin/inbox");
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full py-2 px-4 rounded border border-error text-error text-label-md font-bold hover:bg-error-container/20 transition active:scale-[0.97]"
      >
        Delete submission
      </button>
      <ConfirmDeleteDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        confirmText={agency}
        title="Delete this submission?"
        description={`This permanently deletes the ${agency} submission for ${companyName}, along with its deliverables, checklist items, and internal notes. This cannot be undone.`}
        busy={deleting}
      />
    </>
  );
}
