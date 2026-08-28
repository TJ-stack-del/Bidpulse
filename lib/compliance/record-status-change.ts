import type { SupabaseClient } from "@supabase/supabase-js";

// Shared by the checklist, matrix, and single-item review pages so every
// status change goes through the same update + audit_log write — per
// README section 2 step 7, compliance verification is exactly the kind of
// compliance-relevant action that must land in the (append-only) audit_log.
export async function recordComplianceStatusChange(
  supabase: SupabaseClient,
  args: {
    itemId: string;
    bidId: string;
    orgId: string;
    actorId: string | null;
    clauseReference: string;
    fromStatus: string;
    toStatus: string;
    notes?: string;
  }
) {
  const { error: updateError } = await supabase
    .from("compliance_items")
    .update({
      status: args.toStatus,
      notes: args.notes,
      reviewed_by: args.actorId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", args.itemId);

  if (updateError) throw new Error(updateError.message);

  const { error: auditError } = await supabase.from("audit_log").insert({
    bid_id: args.bidId,
    org_id: args.orgId,
    actor_id: args.actorId,
    event_type: "compliance_check",
    event_detail: {
      clause_reference: args.clauseReference,
      from: args.fromStatus,
      to: args.toStatus,
    },
  });

  if (auditError) throw new Error(auditError.message);
}
