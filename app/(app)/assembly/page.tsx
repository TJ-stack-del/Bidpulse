import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";
import { LifecycleStepper } from "@/components/ui/LifecycleStepper";
import { DeliverablesPanel } from "./DeliverablesPanel";

// Converted from mockups-reference/assembly_drafting_desktop/code.html
// (and _mobile). That mockup is an AI document editor — contenteditable
// sections, an "AI Assistant" sidebar that generates draft text from a
// prompt — with no document store or generation backend anywhere in
// schema.sql. The real table for this stage is `deliverables` (artifact
// title/type/version/sign-off), so this page manages that instead: log the
// artifacts being assembled for a bid and track sign-off on each, rather
// than fake an AI drafting surface with nothing behind it.

const ARTIFACT_TYPES = ["capability_statement", "technical_narrative", "pricing_sheet", "other"];

export default async function AssemblyPage({
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
      <AppShell activePath="/assembly">
        <p className="text-body-md text-error mt-6">
          No team_members record found for this account — see README step 12.
        </p>
      </AppShell>
    );
  }

  if (!bidId) {
    const { data: bids } = await supabase
      .from("bids")
      .select("id, title, agency, stage")
      .eq("org_id", member.org_id)
      .order("created_at", { ascending: false });

    return (
      <AppShell activePath="/assembly">
        <h1 className="text-headline-lg text-on-surface mt-6 mb-1">Assembly &amp; Drafting</h1>
        <p className="text-body-md text-on-surface-variant mb-4">Pick a bid to work on.</p>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
          {bids && bids.length > 0 ? (
            bids.map((bid) => (
              <Link
                key={bid.id}
                href={`/assembly?bid=${bid.id}`}
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
      <AppShell activePath="/assembly">
        <p className="text-body-md text-error mt-6">Bid not found.</p>
      </AppShell>
    );
  }

  const { data: deliverables } = await supabase
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
  const items = (deliverables ?? []) as unknown as Deliverable[];
  const signedOffCount = items.filter((d) => d.signed_off).length;

  return (
    <AppShell activePath="/assembly">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mt-6">
        <div>
          <p className="text-label-md text-on-surface-variant uppercase tracking-wider mb-1">
            Assembly &amp; Drafting
          </p>
          <h1 className="text-headline-lg text-on-surface">{bid.title}</h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            {bid.solicitation_number ?? bid.agency}
          </p>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3 text-right shrink-0">
          <p className="text-label-md text-on-surface-variant uppercase tracking-wider">Signed Off</p>
          <p className="text-title-lg text-on-surface">
            {signedOffCount} / {items.length}
          </p>
        </div>
      </div>

      <LifecycleStepper currentStage={3} />

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden mt-4">
        <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low">
          <h2 className="text-title-lg text-on-surface">Deliverables</h2>
        </div>
        <DeliverablesPanel
          items={items}
          bidId={bid.id}
          orgId={member.org_id}
          actorId={member.id}
          artifactTypes={ARTIFACT_TYPES}
        />
      </div>
    </AppShell>
  );
}
