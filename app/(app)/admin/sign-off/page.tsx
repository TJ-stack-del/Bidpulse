import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";
import { DeliverablesPanel } from "@/app/(app)/assembly/DeliverablesPanel";
import { AuthorizeButton } from "./AuthorizeButton";

// Converted from mockups-reference/admin_audit_sign_off_desktop/code.html
// (and _mobile). "Artifact Verification" reuses the real DeliverablesPanel
// from /assembly instead of a second fabricated artifact list. The
// mockup's 3 manual "Audit Checkpoints" checkboxes aren't backed by any
// column, so they're replaced with 2 gates computed from real data
// (compliance passed/waived, deliverables signed off) — "Authorize for
// Client Review" only enables when both are true.
//
// Gated by role_permissions.can_view_admin (page view, per README section
// 5) and can_sign_off (the authorize action itself).

const ARTIFACT_TYPES = ["capability_statement", "technical_narrative", "pricing_sheet", "other"];

export default async function AdminSignOffPage({
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
    .select("can_view_admin, can_sign_off")
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

  if (!bidId) redirect("/admin/review");

  const { data: bid } = await supabase
    .from("bids")
    .select("id, title, agency, solicitation_number, stage")
    .eq("id", bidId)
    .single();

  if (!bid) {
    return (
      <AppShell activePath="/admin">
        <p className="text-body-md text-error mt-6">Bid not found.</p>
      </AppShell>
    );
  }

  const [{ data: complianceItems }, { data: deliverablesRaw }] = await Promise.all([
    supabase.from("compliance_items").select("status").eq("bid_id", bidId),
    supabase
      .from("deliverables")
      .select("id, artifact_type, title, file_url, version, signed_off, signed_off_at, signed_off_by, team_members(full_name)")
      .eq("bid_id", bidId)
      .order("created_at", { ascending: true }),
  ]);

  type Deliverable = {
    id: string;
    artifact_type: string;
    title: string;
    file_url: string | null;
    version: number;
    signed_off: boolean;
    signed_off_at: string | null;
    team_members: { full_name: string } | null;
  };
  const deliverables = (deliverablesRaw ?? []) as unknown as Deliverable[];

  const items = complianceItems ?? [];
  const complianceConfirmed =
    items.length > 0 && items.every((i) => i.status === "passed" || i.status === "waived");
  const deliverablesSignedOff = deliverables.length > 0 && deliverables.every((d) => d.signed_off);
  const canAuthorize = complianceConfirmed && deliverablesSignedOff && !!permissions.can_sign_off;

  return (
    <AppShell activePath="/admin">
      <div className="flex items-center gap-2 text-on-surface-variant text-body-md mt-6 mb-2">
        <Link href={`/admin/review?bid=${bid.id}`} className="hover:text-primary transition-colors">
          Review
        </Link>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <span className="text-on-surface font-bold">Sign-Off</span>
      </div>
      <h1 className="text-display-lg text-on-surface mb-2">Stage 4 of 6: Quality &amp; Admin Audit</h1>
      <p className="text-body-lg text-on-surface-variant mb-4">
        Review and sign-off for {bid.solicitation_number ?? bid.agency}: {bid.title}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-surface-container-lowest border border-outline-variant rounded overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant">
              <h2 className="text-title-lg text-on-surface">Artifact Verification</h2>
            </div>
            <DeliverablesPanel
              items={deliverables}
              bidId={bid.id}
              orgId={member.org_id}
              actorId={member.id}
              artifactTypes={ARTIFACT_TYPES}
            />
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-surface-container-lowest border border-outline-variant rounded p-6">
            <h2 className="text-title-lg text-on-surface mb-4 border-b border-outline-variant pb-2">
              Audit Checkpoints
            </h2>
            <div className="flex flex-col gap-4">
              <Checkpoint
                label="Compliance Confirmed"
                detail="All compliance items passed or waived."
                met={complianceConfirmed}
              />
              <Checkpoint
                label="Deliverables Signed Off"
                detail="Every logged artifact has been signed off."
                met={deliverablesSignedOff}
              />
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded p-6 text-center">
            <h2 className="text-title-lg text-on-surface mb-2">Final Authorization</h2>
            <p className="text-body-md text-on-surface-variant mb-6">
              Both checkpoints must be met before proceeding.
            </p>
            {bid.stage === "client_review" || bid.stage === "submission" ? (
              <p className="text-body-md text-on-tertiary-container">
                Already authorized for client review.
              </p>
            ) : (
              <AuthorizeButton
                bidId={bid.id}
                orgId={member.org_id}
                actorId={member.id}
                canAuthorize={canAuthorize}
              />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Checkpoint({ label, detail, met }: { label: string; detail: string; met: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`material-symbols-outlined mt-0.5 ${met ? "text-on-tertiary-container" : "text-outline"}`}
      >
        {met ? "check_circle" : "radio_button_unchecked"}
      </span>
      <div>
        <span className="text-body-md font-bold text-on-surface block">{label}</span>
        <span className="text-label-md text-on-surface-variant block">{detail}</span>
      </div>
    </div>
  );
}
