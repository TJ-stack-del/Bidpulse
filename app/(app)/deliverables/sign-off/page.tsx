import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";
import { LifecycleStepper } from "@/components/ui/LifecycleStepper";
import { DeliverablesPanel } from "@/app/(app)/assembly/DeliverablesPanel";
import { ApprovePackageButton } from "./ApprovePackageButton";

// Converted from mockups-reference/deliverables_sign_off/code.html. Reuses
// the same DeliverablesPanel as /assembly and /admin/sign-off for the
// artifact list — this is the contractor-side equivalent (gated by
// role_permissions.can_sign_off, which contractor_owner has even though
// they don't have can_view_admin, so this route sits outside /admin/*).
// The mockup's 3 fixed "Client Sign-Off" checkboxes (legal/technical/
// pricing) aren't backed by any column, so "Approve Package" is gated on
// the real, per-deliverable signed_off flags instead — true "all
// checkboxes checked" equivalent.

const ARTIFACT_TYPES = ["capability_statement", "technical_narrative", "pricing_sheet", "other"];

export default async function DeliverablesSignOffPage({
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
      <AppShell activePath="/deliverables/sign-off">
        <p className="text-body-md text-error mt-6">
          No team_members record found for this account — see README step 12.
        </p>
      </AppShell>
    );
  }

  const { data: permissions } = await supabase
    .from("role_permissions")
    .select("can_sign_off")
    .eq("role", member.role)
    .single();

  if (!permissions?.can_sign_off) {
    return (
      <AppShell activePath="/deliverables/sign-off">
        <p className="text-body-md text-error mt-6">
          Your role ({member.role}) doesn't have sign-off access.
        </p>
      </AppShell>
    );
  }

  if (!bidId) {
    const { data: bids } = await supabase
      .from("bids")
      .select("id, title, agency")
      .eq("org_id", member.org_id)
      .order("created_at", { ascending: false });

    return (
      <AppShell activePath="/deliverables/sign-off">
        <h1 className="text-headline-lg text-on-surface mt-6 mb-1">Deliverables Sign-Off</h1>
        <p className="text-body-md text-on-surface-variant mb-4">Pick a bid.</p>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
          {bids && bids.length > 0 ? (
            bids.map((bid) => (
              <Link
                key={bid.id}
                href={`/deliverables/sign-off?bid=${bid.id}`}
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
            <p className="text-body-md text-on-surface-variant px-6 py-6">No bids yet.</p>
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
      <AppShell activePath="/deliverables/sign-off">
        <p className="text-body-md text-error mt-6">Bid not found.</p>
      </AppShell>
    );
  }

  const { data: deliverablesRaw } = await supabase
    .from("deliverables")
    .select("id, artifact_type, title, file_url, version, signed_off, signed_off_at, signed_off_by, team_members(full_name)")
    .eq("bid_id", bidId)
    .order("created_at", { ascending: true });

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
  const allSignedOff = deliverables.length > 0 && deliverables.every((d) => d.signed_off);

  return (
    <AppShell activePath="/deliverables/sign-off">
      <div className="mb-2 mt-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-headline-lg text-on-surface mb-1">Proposal Assembly</h1>
          <p className="text-body-md text-on-surface-variant">
            {bid.solicitation_number ?? bid.agency}: {bid.title}
          </p>
        </div>
      </div>

      <LifecycleStepper currentStage={3} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
        <div className="lg:col-span-2">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant bg-surface">
              <h2 className="text-title-lg text-on-surface">Generated Artifacts</h2>
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
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6">
            <h2 className="text-title-lg text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-on-surface-variant">signature</span>
              Package Sign-Off
            </h2>
            <p className="text-body-md text-on-surface-variant mb-4">
              {deliverables.filter((d) => d.signed_off).length} / {deliverables.length} deliverables signed off.
            </p>
            <ApprovePackageButton
              bidId={bid.id}
              orgId={member.org_id}
              actorId={member.id}
              deliverables={deliverables.map((d) => ({ id: d.id, title: d.title }))}
              enabled={allSignedOff}
            />
            {!allSignedOff && (
              <p className="text-center text-code-sm text-on-surface-variant mt-3">
                Every deliverable must be signed off to approve the package.
              </p>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
