import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";
import { LifecycleStepper } from "@/components/ui/LifecycleStepper";
import { SubmitForm } from "./SubmitForm";

// Converted from mockups-reference/submission_execution_desktop/code.html
// (and _desktop/_mobile variants). "Total Payload (14.2 MB, 3 Files)" and
// per-file sizes aren't backed by any column, so the summary shows a real
// deliverable count instead. The SHA-256 "Cryptographic Seal" is a real
// hash (via lib/audit/export's calculateSha256) computed over the actual
// bid/deliverable/confirmation data at submit time — not a placeholder —
// and stored in the audit_log 'submission' event, since submissions has no
// checksum column. "Upload Receipt/Proof" drag-and-drop has no storage
// integration anywhere in this app, so it's a URL field like deliverables'
// file_url. The mockup's fabricated "Post-Execution Readiness" checklist
// (Audit Log Ready / Archive Generation) is dropped — the real audit_log
// timeline lives on /submit/receipt instead.

export default async function SubmitPage({
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
    .select("id, org_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!member) {
    return (
      <AppShell activePath="/submit">
        <p className="text-body-md text-error mt-6">
          No team_members record found for this account — see README step 12.
        </p>
      </AppShell>
    );
  }

  if (!bidId) {
    const { data: bids } = await supabase
      .from("bids")
      .select("id, title, agency")
      .eq("org_id", member.org_id)
      .eq("stage", "submission")
      .order("created_at", { ascending: false });

    return (
      <AppShell activePath="/submit">
        <h1 className="text-headline-lg text-on-surface mt-6 mb-1">Execution &amp; Dispatch</h1>
        <p className="text-body-md text-on-surface-variant mb-4">Pick a bid in Stage 6 to execute.</p>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
          {bids && bids.length > 0 ? (
            bids.map((bid) => (
              <Link
                key={bid.id}
                href={`/submit?bid=${bid.id}`}
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
            <p className="text-body-md text-on-surface-variant px-6 py-6">No bids ready for submission.</p>
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
      <AppShell activePath="/submit">
        <p className="text-body-md text-error mt-6">Bid not found.</p>
      </AppShell>
    );
  }

  const { data: existingSubmission } = await supabase
    .from("submissions")
    .select("id")
    .eq("bid_id", bidId)
    .maybeSingle();

  if (existingSubmission) redirect(`/submit/receipt?bid=${bidId}`);

  const { data: deliverablesRaw } = await supabase
    .from("deliverables")
    .select("id, title, artifact_type, version")
    .eq("bid_id", bidId)
    .order("created_at", { ascending: true });

  const deliverables = deliverablesRaw ?? [];

  return (
    <AppShell activePath="/submit">
      <div className="flex items-center gap-2 text-on-surface-variant text-body-md mt-6 mb-2">
        <span>My RFPs</span>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <span className="text-on-surface">{bid.solicitation_number ?? bid.agency}</span>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <span className="text-on-surface">Submission</span>
      </div>
      <h1 className="text-headline-lg text-on-surface mb-1">Execution &amp; Dispatch</h1>
      <p className="text-body-lg text-on-surface-variant mb-4">{bid.title}</p>

      <LifecycleStepper currentStage={6} />

      <SubmitForm
        bidId={bid.id}
        bidTitle={bid.title}
        bidAgency={bid.agency}
        solicitationNumber={bid.solicitation_number}
        orgId={member.org_id}
        actorId={member.id}
        deliverables={deliverables}
      />
    </AppShell>
  );
}
