import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";
import { LifecycleStepper } from "@/components/ui/LifecycleStepper";
import { ComplianceChecklist } from "@/app/(app)/compliance/ComplianceChecklist";
import { AdminNotes } from "./AdminNotes";

// Converted from mockups-reference/admin_review_audit/code.html. The
// "Audit Evidence Logs" table is the bid's real compliance_items (reusing
// ComplianceChecklist from the compliance pages instead of a second
// fabricated "document verification" list); "Reviewer Notes" reuses the
// append-only audit_log as a real note thread (event_type = 'note') rather
// than a new notes table. "Audit Checkpoints" from the mockup are 3
// unbacked manual checkboxes — replaced with the same 2 gates
// /admin/sign-off computes for real (compliance passed, deliverables
// signed off).
//
// Gated by role_permissions.can_view_admin, per README section 5.

export default async function AdminReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ bid?: string }>;
}) {
  const { bid: bidId } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("team_members")
    .select("id, org_id, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!member) {
    return (
      <AppShell activePath="/admin">
        <p className="text-body-md text-error mt-6">
          No team_members record found for this account — see README step 12.
        </p>
      </AppShell>
    );
  }

  const { data: permissions } = await supabase
    .from("role_permissions")
    .select("can_view_admin")
    .eq("role", member.role)
    .single();

  if (!permissions?.can_view_admin) {
    return (
      <AppShell activePath="/admin">
        <p className="text-body-md text-error mt-6">
          Your role ({member.role}) doesn't have admin portal access.
        </p>
      </AppShell>
    );
  }

  if (!bidId) {
    const { data: bids } = await supabase
      .from("bids")
      .select("id, title, agency")
      .eq("org_id", member.org_id)
      .eq("stage", "admin_audit")
      .order("created_at", { ascending: false });

    return (
      <AppShell activePath="/admin">
        <h1 className="text-headline-lg text-on-surface mt-6 mb-1">Admin Review &amp; Audit</h1>
        <p className="text-body-md text-on-surface-variant mb-4">Pick a bid in Stage 4 to review.</p>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
          {bids && bids.length > 0 ? (
            bids.map((bid) => (
              <Link
                key={bid.id}
                href={`/admin/review?bid=${bid.id}`}
                className="flex items-center justify-between px-6 py-4 border-b border-outline-variant last:border-b-0 hover:bg-surface-container-low transition-colors"
              >
                <div>
                  <p className="text-label-md text-on-surface">{bid.title}</p>
                  <p className="text-code-sm text-on-surface-variant mt-1">{bid.agency}</p>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
              </Link>
            ))
          ) : (
            <p className="text-body-md text-on-surface-variant px-6 py-6">No bids in admin audit right now.</p>
          )}
        </div>
      </AppShell>
    );
  }

  const { data: bid } = await supabase
    .from("bids")
    .select("id, title, agency, solicitation_number")
    .eq("id", bidId)
    .single();

  if (!bid) {
    return (
      <AppShell activePath="/admin">
        <p className="text-body-md text-error mt-6">Bid not found.</p>
      </AppShell>
    );
  }

  const { data: items } = await supabase
    .from("compliance_items")
    .select("id, clause_reference, requirement, status, notes")
    .eq("bid_id", bidId)
    .order("clause_reference", { ascending: true });

  const complianceItems = items ?? [];
  const total = complianceItems.length;
  const passed = complianceItems.filter((i) => i.status === "passed" || i.status === "waived").length;
  const failed = complianceItems.filter((i) => i.status === "failed");
  const completion = total > 0 ? Math.round((passed / total) * 100) : 0;

  const { data: notesRaw } = await supabase
    .from("audit_log")
    .select("id, event_detail, created_at, team_members(full_name)")
    .eq("bid_id", bidId)
    .eq("event_type", "note")
    .order("created_at", { ascending: false });

  type NoteRow = { id: string; event_detail: { text?: string } | null; created_at: string; team_members: { full_name: string } | null };
  const notes = (notesRaw ?? []) as unknown as NoteRow[];

  return (
    <AppShell activePath="/admin">
      <div className="flex items-center gap-2 text-on-surface-variant text-body-md mt-6 mb-2">
        <Link href="/admin" className="hover:text-primary transition-colors">
          Admin
        </Link>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <span className="text-on-surface font-bold">Review</span>
      </div>
      <h1 className="text-headline-lg text-on-surface mb-1">{bid.title}</h1>
      <p className="text-body-md text-on-surface-variant mb-4">
        {bid.solicitation_number ?? bid.agency}
      </p>

      <LifecycleStepper currentStage={4} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low">
              <h2 className="text-title-lg text-on-surface">Audit Evidence Logs</h2>
            </div>
            {complianceItems.length > 0 ? (
              <ComplianceChecklist items={complianceItems} bidId={bid.id} orgId={member.org_id} actorId={member.id} />
            ) : (
              <p className="text-body-md text-on-surface-variant px-6 py-6">No compliance items logged.</p>
            )}
            {failed.length > 0 && (
              <div className="bg-error-container/10 border-t border-error/20 p-4 flex flex-col gap-3">
                {failed.map((item) => (
                  <div key={item.id} className="flex gap-3 items-start">
                    <span className="material-symbols-outlined text-error mt-0.5 text-[20px]">error</span>
                    <div>
                      <h4 className="text-label-md text-on-error-container mb-1">
                        Flagged: {item.clause_reference}
                      </h4>
                      <p className="text-body-md text-on-surface-variant">
                        {item.notes || "No reviewer notes recorded for this failure yet."}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
            <h2 className="text-title-lg text-on-surface mb-4">Reviewer Notes</h2>
            <AdminNotes bidId={bid.id} orgId={member.org_id} actorId={member.id} notes={notes} />
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 sticky top-[88px]">
            <div className="flex items-center justify-between text-label-md mb-2">
              <span className="text-on-surface-variant">Audit Completion</span>
              <span className="text-on-surface font-bold">{completion}%</span>
            </div>
            <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
              <div className="bg-secondary h-full rounded-full" style={{ width: `${completion}%` }} />
            </div>
            <p className="mt-2 text-center text-code-sm text-on-surface-variant">
              {failed.length} blocking issue{failed.length === 1 ? "" : "s"} remaining
            </p>
            <Link
              href={`/admin/sign-off?bid=${bid.id}`}
              className="block w-full mt-4 text-center py-3 px-4 bg-primary text-on-primary rounded text-label-md hover:bg-on-background transition-colors"
            >
              Proceed to Sign-Off
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
