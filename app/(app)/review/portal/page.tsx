import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";
import { LifecycleStepper } from "@/components/ui/LifecycleStepper";
import { AuthorizeReviewButton } from "../AuthorizeReviewButton";
import { ReviewPortalPanel } from "./ReviewPortalPanel";

// Converted from mockups-reference/client_review_portal_desktop/code.html
// (and _mobile). "Pages" / "Total Value" fields on the artifact cards
// aren't backed by any deliverables column, so they're dropped in favor of
// version + logged date. Per-deliverable approval and the general comment
// feed both write to the real client_reviews table (decision +
// deliverable_id null for general comments, set for a specific artifact) —
// no new table needed, matching the schema comment
// "decision: approved | changes_requested".

export default async function ReviewPortalPage({
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
      <AppShell activePath="/review/portal">
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
      .eq("stage", "client_review")
      .order("created_at", { ascending: false });

    return (
      <AppShell activePath="/review/portal">
        <h1 className="text-headline-lg text-on-surface mt-6 mb-1">Client Review Portal</h1>
        <p className="text-body-md text-on-surface-variant mb-4">Pick a bid in Stage 5 to review.</p>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
          {bids && bids.length > 0 ? (
            bids.map((bid) => (
              <Link
                key={bid.id}
                href={`/review/portal?bid=${bid.id}`}
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
            <p className="text-body-md text-on-surface-variant px-6 py-6">No bids in client review right now.</p>
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
      <AppShell activePath="/review/portal">
        <p className="text-body-md text-error mt-6">Bid not found.</p>
      </AppShell>
    );
  }

  const [{ data: deliverablesRaw }, { data: reviewsRaw }] = await Promise.all([
    supabase
      .from("deliverables")
      .select("id, artifact_type, title, file_url, version, created_at")
      .eq("bid_id", bidId)
      .order("created_at", { ascending: true }),
    supabase
      .from("client_reviews")
      .select("id, deliverable_id, decision, feedback, created_at, team_members(full_name)")
      .eq("bid_id", bidId)
      .order("created_at", { ascending: true }),
  ]);

  type Deliverable = {
    id: string;
    artifact_type: string;
    title: string;
    file_url: string | null;
    version: number;
    created_at: string;
  };
  type Review = {
    id: string;
    deliverable_id: string | null;
    decision: string | null;
    feedback: string | null;
    created_at: string;
    team_members: { full_name: string } | null;
  };
  const deliverables = (deliverablesRaw ?? []) as unknown as Deliverable[];
  const reviews = (reviewsRaw ?? []) as unknown as Review[];

  const latestDecisionByDeliverable = new Map<string, string>();
  for (const r of reviews) {
    if (r.deliverable_id && r.decision) latestDecisionByDeliverable.set(r.deliverable_id, r.decision);
  }
  const generalComments = reviews.filter((r) => !r.deliverable_id);

  const allApproved =
    deliverables.length > 0 && deliverables.every((d) => latestDecisionByDeliverable.get(d.id) === "approved");
  const approvedCount = deliverables.filter((d) => latestDecisionByDeliverable.get(d.id) === "approved").length;

  return (
    <AppShell activePath="/review/portal">
      <div className="flex items-center gap-2 text-on-surface-variant text-body-md mt-6 mb-2">
        <span>{bid.solicitation_number ?? bid.agency}</span>
        <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant text-code-sm">
          Final Review Stage
        </span>
      </div>
      <h1 className="text-headline-lg text-on-surface mb-2">{bid.title}</h1>

      <LifecycleStepper currentStage={5} />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-4">
        <div className="xl:col-span-8 flex flex-col gap-6">
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-title-lg text-on-surface mb-1">Submission Artifacts</h2>
              <p className="text-body-md text-on-surface-variant">
                Review and approve all volumes prior to final submission authorization.
              </p>
            </div>
            <Link href={`/review/feedback?bid=${bid.id}`} className="text-secondary text-label-md hover:underline shrink-0">
              Detailed Feedback
            </Link>
          </div>
          {deliverables.length > 0 ? (
            <ReviewPortalPanel
              deliverables={deliverables}
              latestDecisionByDeliverable={Object.fromEntries(latestDecisionByDeliverable)}
              generalComments={generalComments}
              bidId={bid.id}
              orgId={member.org_id}
              actorId={member.id}
            />
          ) : (
            <p className="text-body-md text-on-surface-variant bg-surface-container-lowest border border-outline-variant rounded p-6">
              No deliverables logged for this bid yet — see /assembly.
            </p>
          )}
        </div>

        <div className="xl:col-span-4 flex flex-col gap-6">
          <div className="bg-surface-container-low border border-outline-variant rounded-lg p-6 text-center">
            <div className="flex flex-col items-center">
              <span className="material-symbols-outlined text-[32px] text-on-surface-variant mb-2">
                verified_user
              </span>
              <h3 className="text-title-lg text-on-surface mb-2">Authorize Submission</h3>
              <p className="text-body-md text-on-surface-variant mb-4">
                All volumes must be approved before you can sign off and authorize submission.
              </p>
              <div className="w-full mb-4">
                <div className="flex justify-between text-code-sm text-on-surface-variant mb-1">
                  <span>Approval Status</span>
                  <span>
                    {approvedCount} / {deliverables.length} Approved
                  </span>
                </div>
                <div className="w-full h-2 bg-surface-variant rounded-full overflow-hidden">
                  <div
                    className="bg-on-tertiary-container h-full"
                    style={{ width: `${deliverables.length ? (approvedCount / deliverables.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
              {bid && (
                <AuthorizeReviewButton
                  bidId={bid.id}
                  orgId={member.org_id}
                  actorId={member.id}
                  enabled={allApproved}
                  label="Sign-Off & Authorize"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
