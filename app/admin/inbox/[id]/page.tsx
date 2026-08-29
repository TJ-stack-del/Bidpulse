import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";
import { AdminSubmissionActions } from "./AdminSubmissionActions";
import { DeliverablesPanel } from "./DeliverablesPanel";

// The actual review workspace: full intake info, stage editing, internal
// notes, checklist, deliverables. This is where the "admin does the real
// work" part of the done-for-you model happens.

export default async function AdminSubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // org_id/actor_id are needed for correct audit_log writes below (see
  // AdminSubmissionActions/DeliverablesPanel) — RLS only lets this resolve
  // for an actual admin's own org, same as the rest of /admin/inbox.
  const { data: member } = await supabase
    .from("team_members")
    .select("id, org_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!member) redirect("/");

  const { data: submission } = await supabase
    .from("submissions")
    .select("*, clients(company_name, contact_name, email, phone, naics_codes)")
    .eq("id", id)
    .single();

  if (!submission) {
    return (
      <AppShell activePath="/admin/inbox" role="admin">
        <p className="text-body-md text-error mt-6">Submission not found.</p>
      </AppShell>
    );
  }

  const { data: notes } = await supabase
    .from("admin_notes")
    .select("id, note, created_at")
    .eq("submission_id", id)
    .order("created_at", { ascending: false });

  const { data: checklist } = await supabase
    .from("checklist_items")
    .select("id, label, status, notes")
    .eq("submission_id", id);

  const { data: deliverables } = await supabase
    .from("deliverables")
    .select("id, deliverable_type, file_url, content, created_at")
    .eq("submission_id", id);

  const client = submission.clients as any;

  return (
    <AppShell activePath="/admin/inbox" role="admin">
      <div className="mt-6">
        <p className="text-label-md text-on-surface-variant uppercase tracking-wider mb-1">
          {client?.company_name}
        </p>
        <h1 className="text-headline-lg text-on-surface">{submission.agency}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
            <h2 className="text-title-lg text-on-surface mb-4">Bid details</h2>
            <div className="grid grid-cols-2 gap-4 text-body-md">
              <div>
                <span className="text-label-md text-on-surface-variant block">Solicitation #</span>
                {submission.solicitation_number ?? "—"}
              </div>
              <div>
                <span className="text-label-md text-on-surface-variant block">Due date</span>
                {submission.due_date ? new Date(submission.due_date).toLocaleDateString() : "—"}
              </div>
              <div className="col-span-2">
                <span className="text-label-md text-on-surface-variant block">Scope</span>
                {submission.scope ?? "—"}
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
            <h2 className="text-title-lg text-on-surface mb-4">Client info</h2>
            <div className="grid grid-cols-2 gap-4 text-body-md">
              <div>
                <span className="text-label-md text-on-surface-variant block">Contact</span>
                {client?.contact_name}
              </div>
              <div>
                <span className="text-label-md text-on-surface-variant block">Email</span>
                {client?.email}
              </div>
              <div>
                <span className="text-label-md text-on-surface-variant block">Phone</span>
                {client?.phone ?? "—"}
              </div>
              <div>
                <span className="text-label-md text-on-surface-variant block">NAICS codes</span>
                {(client?.naics_codes ?? []).join(", ") || "—"}
              </div>
            </div>
          </div>

          <AdminSubmissionActions
            submissionId={submission.id}
            orgId={member.org_id}
            currentStage={submission.stage}
            checklist={checklist ?? []}
            notes={notes ?? []}
            confirmationSentAt={submission.confirmation_sent_at}
          />

          <DeliverablesPanel
            submissionId={submission.id}
            orgId={member.org_id}
            actorId={member.id}
            initialDeliverables={deliverables ?? []}
          />
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
            <h3 className="text-title-lg text-on-surface mb-4">Status</h3>
            <p className="text-body-md text-on-surface-variant">
              Stage: <span className="font-bold text-on-surface">{submission.stage}</span>
            </p>
            {submission.is_test && (
              <p className="text-label-md text-error mt-2">TEST — excluded from revenue reporting</p>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
