import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";
import { AuthorizeReviewButton } from "../AuthorizeReviewButton";
import { FeedbackThread } from "./FeedbackThread";

// Converted from mockups-reference/client_review_feedback_desktop/code.html
// (and client_review_feedback/_mobile). Companion to /review/portal: that
// page is the fast-approve overview, this one is the deep per-artifact
// discussion — pick a deliverable on the left, see/post its threaded
// client_reviews history (comments and decisions interleaved by
// created_at) on the right.

const STATUS_STYLE: Record<string, string> = {
  approved: "bg-[#e6f4ea] text-[#1e8e3e] border-[#1e8e3e]/20",
  changes_requested: "bg-error-container text-on-error-container border-on-error-container/20",
};

export default async function ReviewFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ bid?: string; deliverable?: string }>;
}) {
  const { bid: bidId, deliverable: deliverableId } = await searchParams;
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
      <AppShell activePath="/review/feedback">
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
      <AppShell activePath="/review/feedback">
        <h1 className="text-headline-lg text-on-surface mt-6 mb-1">Client Review Feedback</h1>
        <p className="text-body-md text-on-surface-variant mb-4">Pick a bid in Stage 5 to review.</p>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
          {bids && bids.length > 0 ? (
            bids.map((bid) => (
              <Link
                key={bid.id}
                href={`/review/feedback?bid=${bid.id}`}
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
      <AppShell activePath="/review/feedback">
        <p className="text-body-md text-error mt-6">Bid not found.</p>
      </AppShell>
    );
  }

  const [{ data: deliverablesRaw }, { data: reviewsRaw }] = await Promise.all([
    supabase
      .from("deliverables")
      .select("id, artifact_type, title, version, created_at")
      .eq("bid_id", bidId)
      .order("created_at", { ascending: true }),
    supabase
      .from("client_reviews")
      .select("id, deliverable_id, decision, feedback, created_at, team_members(full_name)")
      .eq("bid_id", bidId)
      .order("created_at", { ascending: true }),
  ]);

  type Deliverable = { id: string; artifact_type: string; title: string; version: number; created_at: string };
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
  const allApproved =
    deliverables.length > 0 && deliverables.every((d) => latestDecisionByDeliverable.get(d.id) === "approved");

  const selectedId = deliverableId ?? deliverables[0]?.id;
  const selected = deliverables.find((d) => d.id === selectedId);
  const thread = reviews.filter((r) => r.deliverable_id === selectedId);

  return (
    <AppShell activePath="/review/feedback">
      <div className="flex items-center gap-2 text-on-surface-variant text-body-md mt-6 mb-4">
        <span>My RFPs</span>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <span className="text-on-surface font-bold">{bid.solicitation_number ?? bid.title}</span>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-1/2 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h2 className="text-headline-md text-on-surface">Deliverables for Review</h2>
          </div>
          {deliverables.length > 0 ? (
            <div className="flex flex-col gap-3">
              {deliverables.map((d) => {
                const decision = latestDecisionByDeliverable.get(d.id);
                const active = d.id === selectedId;
                return (
                  <Link
                    key={d.id}
                    href={`/review/feedback?bid=${bidId}&deliverable=${d.id}`}
                    className={`bg-surface-container-lowest border rounded p-4 flex flex-col gap-3 transition-colors ${
                      active ? "border-secondary shadow-sm" : "border-outline-variant hover:bg-surface-container-low"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-title-lg text-on-surface leading-tight">{d.title}</h4>
                        <p className="text-body-md text-on-surface-variant mt-1">
                          Version {d.version} · Logged {new Date(d.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 font-label-md text-label-md rounded-full border ${
                          decision
                            ? STATUS_STYLE[decision]
                            : "bg-surface-container text-on-surface-variant border-outline-variant"
                        }`}
                      >
                        {decision === "approved" ? "Approved" : decision === "changes_requested" ? "Changes Req." : "Requires Review"}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-body-md text-on-surface-variant bg-surface-container-lowest border border-outline-variant rounded p-6">
              No deliverables logged for this bid yet — see /assembly.
            </p>
          )}
        </div>

        <div className="w-full lg:w-1/2 bg-surface-container-lowest border border-outline-variant rounded flex flex-col">
          {selected ? (
            <>
              <div className="p-4 border-b border-outline-variant flex items-center gap-2 bg-surface-bright">
                <span className="material-symbols-outlined text-secondary">forum</span>
                <h3 className="text-title-lg text-on-surface">Feedback Log ({selected.title})</h3>
              </div>
              <FeedbackThread
                thread={thread}
                deliverableTitle={selected.title}
                deliverableId={selected.id}
                bidId={bid.id}
                orgId={member.org_id}
                actorId={member.id}
              />
            </>
          ) : (
            <p className="text-body-md text-on-surface-variant p-6">Select a deliverable to see its feedback.</p>
          )}
        </div>
      </div>

      <div className="mt-6 border-t border-outline-variant pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h4 className="text-title-lg text-on-surface">Ready to Complete Review?</h4>
          <p className="text-body-md text-on-surface-variant">
            Ensure every deliverable is approved before proceeding to submission.
          </p>
        </div>
        <div className="w-full sm:w-64">
          <AuthorizeReviewButton
            bidId={bid.id}
            orgId={member.org_id}
            actorId={member.id}
            enabled={allApproved}
            label="Complete Review Phase"
          />
        </div>
      </div>
    </AppShell>
  );
}
