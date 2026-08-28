import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";

// Converted from mockups-reference/bidpulse_dashboard_desktop/code.html —
// the mockup's own sidebar/topnav is dropped in favor of the shared
// AppShell, and every stat below is computed from real bids /
// matched_opportunities / compliance_items rows instead of the mockup's
// hardcoded numbers. The mockup's "Compliance Health" card (SAM.gov
// Registration, CMMC Level 2, etc.) has no backing table, so it's replaced
// with a real rollup of this org's compliance_items statuses.

const STAGE_SEQUENCE: { value: string; label: string }[] = [
  { value: "intake", label: "Intake" },
  { value: "compliance_review", label: "Compliance" },
  { value: "assembly_drafting", label: "Assembly" },
  { value: "admin_audit", label: "Admin Audit" },
  { value: "client_review", label: "Client Review" },
  { value: "submission", label: "Submission" },
];

const DECIDED_STATUSES = ["awarded", "lost"];
const CLOSED_STATUSES = ["submitted", "awarded", "lost", "withdrawn"];

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("team_members")
    .select("org_id, full_name, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!member) {
    return (
      <AppShell activePath="/dashboard">
        <p className="text-body-md text-error mt-6">
          No team_members record found for this account yet — sign out and finish signing up,
          or ask an admin to add you to an organization.
        </p>
      </AppShell>
    );
  }

  const [{ data: bids }, { data: opportunities }, { data: complianceItems }] = await Promise.all([
    supabase
      .from("bids")
      .select("id, title, agency, solicitation_number, due_date, stage, status, fit_score")
      .eq("org_id", member.org_id)
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("matched_opportunities")
      .select("id, source_title, source_agency, match_score, match_rationale, naics_codes")
      .eq("org_id", member.org_id)
      .eq("status", "new")
      .order("match_score", { ascending: false })
      .limit(4),
    supabase
      .from("compliance_items")
      .select("status, bids!inner(org_id)")
      .eq("bids.org_id", member.org_id),
  ]);

  const allBids = bids ?? [];
  const activePipeline = allBids.filter((b) => !CLOSED_STATUSES.includes(b.status)).slice(0, 5);
  const decidedBids = allBids.filter((b) => DECIDED_STATUSES.includes(b.status));
  const awardedBids = allBids.filter((b) => b.status === "awarded");
  const winRate = decidedBids.length
    ? Math.round((awardedBids.length / decidedBids.length) * 100)
    : null;

  const now = new Date();
  const upcomingDeadlines = allBids
    .filter((b) => b.due_date && new Date(b.due_date) >= now)
    .slice(0, 3);

  const complianceCounts = (complianceItems ?? []).reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});
  const totalComplianceItems = complianceItems?.length ?? 0;
  const failingComplianceItems = complianceCounts.failed ?? 0;

  return (
    <AppShell activePath="/dashboard">
      <div className="flex justify-between items-end gap-4 mt-6">
        <div>
          <h1 className="text-headline-lg text-on-surface mb-1">Dashboard</h1>
          <p className="text-body-md text-on-surface-variant">
            Welcome back, {member.full_name.split(" ")[0]}. You have {upcomingDeadlines.length}{" "}
            deadline{upcomingDeadlines.length === 1 ? "" : "s"} coming up.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/intake"
            className="bg-primary text-on-primary px-4 py-2 rounded text-label-md hover:bg-on-background transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Draft
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-2">
        <div className="lg:col-span-8 flex flex-col gap-6">
          <section className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="text-title-lg text-on-surface">Matched Opportunities</h2>
            </div>
            {opportunities && opportunities.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {opportunities.map((opp) => (
                  <Link
                    key={opp.id}
                    href={`/opportunities/${opp.id}`}
                    className="bg-surface-container-lowest border border-outline-variant rounded p-5 block hover:border-secondary transition-colors"
                  >
                    <span className="bg-surface-container text-on-surface-variant text-label-md px-2 py-1 rounded">
                      {opp.source_agency}
                    </span>
                    <h3 className="text-title-lg text-on-surface mt-3 mb-2 line-clamp-2">
                      {opp.source_title}
                    </h3>
                    {opp.match_rationale && (
                      <p className="text-body-md text-on-surface-variant line-clamp-2 mb-3">
                        {opp.match_rationale}
                      </p>
                    )}
                    <div className="flex items-center gap-2 pt-3 border-t border-outline-variant">
                      <span className="text-code-sm text-on-surface-variant">Match Score</span>
                      <span className="text-label-md text-on-tertiary-container">
                        {Math.round(opp.match_score)}%
                      </span>
                      <div className="flex-1 h-1 bg-surface-container rounded-full overflow-hidden">
                        <div
                          className="h-full bg-on-tertiary-container"
                          style={{ width: `${Math.min(100, Math.round(opp.match_score))}%` }}
                        />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-body-md text-on-surface-variant bg-surface-container-lowest border border-outline-variant rounded p-5">
                No new matched opportunities yet.
              </p>
            )}
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-title-lg text-on-surface">Active Pipeline</h2>
            <div className="bg-surface-container-lowest border border-outline-variant rounded overflow-hidden">
              <div className="grid grid-cols-12 gap-2 bg-surface-container-low border-b border-outline-variant px-4 py-3">
                <div className="col-span-4 text-label-md text-on-surface-variant">Solicitation</div>
                <div className="col-span-8 text-label-md text-on-surface-variant">Lifecycle Stage</div>
              </div>
              {activePipeline.length > 0 ? (
                activePipeline.map((bid) => {
                  const stageIndex = STAGE_SEQUENCE.findIndex((s) => s.value === bid.stage);
                  return (
                    <div
                      key={bid.id}
                      className="grid grid-cols-12 gap-2 border-b border-outline-variant last:border-b-0 px-4 py-4 items-center"
                    >
                      <div className="col-span-4 pr-4">
                        <p className="text-label-md text-on-surface truncate">{bid.title}</p>
                        <p className="text-code-sm text-on-surface-variant mt-1">
                          {bid.solicitation_number ?? bid.agency}
                        </p>
                        {bid.fit_score !== null && (
                          <Link
                            href={`/fit-score/${bid.id}`}
                            className="text-code-sm text-secondary hover:underline mt-1 inline-block"
                          >
                            Fit: {Math.round(bid.fit_score)}%
                          </Link>
                        )}
                        {bid.stage === "submission" && (
                          // /submit itself redirects to the receipt if this bid was already
                          // submitted (submissions.bid_id is unique), so one link covers both.
                          <Link
                            href={`/submit?bid=${bid.id}`}
                            className="text-code-sm text-secondary hover:underline mt-1 inline-block"
                          >
                            Execute Submission
                          </Link>
                        )}
                      </div>
                      <div className="col-span-8">
                        <div className="flex items-center justify-between relative w-full pt-2">
                          <div className="absolute left-0 top-3 w-full h-px bg-outline-variant -z-10" />
                          {STAGE_SEQUENCE.map((stage, i) => (
                            <div key={stage.value} className="flex flex-col items-center gap-1 bg-surface-container-lowest">
                              <div
                                className={`w-3 h-3 rounded-full border-2 ${
                                  i < stageIndex
                                    ? "bg-on-tertiary-container border-on-tertiary-container"
                                    : i === stageIndex
                                    ? "bg-surface-container-lowest border-secondary ring-2 ring-secondary/20"
                                    : "bg-surface-container-lowest border-outline-variant"
                                }`}
                              />
                              <span
                                className={`text-[10px] text-code-sm hidden md:block ${
                                  i === stageIndex ? "text-secondary font-medium" : "text-on-surface-variant"
                                }`}
                              >
                                {stage.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-body-md text-on-surface-variant px-4 py-6">
                  No active bids in the pipeline.
                </p>
              )}
            </div>
          </section>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-surface-container-lowest border border-outline-variant rounded p-5 flex flex-col gap-4">
            <h2 className="text-title-lg text-on-surface">Quick Stats</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface-container-low border border-outline-variant p-4 rounded">
                <p className="text-code-sm text-on-surface-variant mb-1">Active Bids</p>
                <p className="text-display-lg text-on-surface">{activePipeline.length}</p>
              </div>
              <div className="bg-surface-container-low border border-outline-variant p-4 rounded">
                <p className="text-code-sm text-on-surface-variant mb-1">Win Rate</p>
                <p className="text-display-lg text-on-surface">
                  {winRate === null ? "—" : winRate}
                  {winRate !== null && <span className="text-headline-md">%</span>}
                </p>
              </div>
            </div>
            <div className="mt-2">
              <p className="text-label-md text-on-surface-variant mb-2">Upcoming Deadlines</p>
              {upcomingDeadlines.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {upcomingDeadlines.map((bid) => {
                    const daysLeft = Math.ceil(
                      (new Date(bid.due_date!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                    );
                    const soon = daysLeft <= 7;
                    return (
                      <li
                        key={bid.id}
                        className={`flex justify-between items-center text-body-md p-2 rounded border-l-2 ${
                          soon ? "bg-error-container/20 border-error" : "border-outline-variant"
                        }`}
                      >
                        <span className="text-on-surface truncate mr-2">{bid.title}</span>
                        <span
                          className={`whitespace-nowrap ${soon ? "text-error font-medium" : "text-on-surface-variant"}`}
                        >
                          {new Date(bid.due_date!).toLocaleDateString()}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-body-md text-on-surface-variant">No upcoming deadlines.</p>
              )}
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded p-5 relative overflow-hidden">
            <div
              className={`absolute left-0 top-0 bottom-0 w-1 ${
                failingComplianceItems > 0 ? "bg-error" : "bg-on-tertiary-container"
              }`}
            />
            <div className="flex items-center gap-3 mb-4 pl-2">
              <span className="material-symbols-outlined text-on-tertiary-container text-[28px]">
                verified_user
              </span>
              <div>
                <h2 className="text-title-lg text-on-surface">Compliance Health</h2>
                <p className="text-code-sm text-on-surface-variant">Across all active bids</p>
              </div>
            </div>
            <div className="pl-2">
              {totalComplianceItems > 0 ? (
                <>
                  <ComplianceRow label="Passed" count={complianceCounts.passed ?? 0} tone="pass" />
                  <ComplianceRow label="In Progress" count={complianceCounts.in_progress ?? 0} tone="neutral" />
                  <ComplianceRow label="Waived" count={complianceCounts.waived ?? 0} tone="neutral" />
                  <ComplianceRow label="Failed" count={complianceCounts.failed ?? 0} tone="fail" last />
                </>
              ) : (
                <p className="text-body-md text-on-surface-variant py-2">
                  No compliance items tracked yet.
                </p>
              )}
              <Link
                href="/compliance"
                className="block w-full mt-4 bg-surface border border-outline-variant text-on-surface text-center py-2 rounded text-label-md hover:bg-surface-container-low transition-colors"
              >
                Review Compliance Matrix
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ComplianceRow({
  label,
  count,
  tone,
  last,
}: {
  label: string;
  count: number;
  tone: "pass" | "fail" | "neutral";
  last?: boolean;
}) {
  return (
    <div
      className={`flex justify-between items-center py-2 ${
        last ? "" : "border-b border-outline-variant/50"
      }`}
    >
      <span className="text-body-md text-on-surface-variant">{label}</span>
      <span
        className={`font-label-md px-2 py-0.5 rounded text-[10px] border ${
          tone === "pass"
            ? "bg-surface-container-low text-on-tertiary-container border-on-tertiary-container/20"
            : tone === "fail"
            ? "bg-error-container text-on-error-container border-on-error-container/20"
            : "bg-surface-container-low text-on-surface-variant border-outline-variant"
        }`}
      >
        {count}
      </span>
    </div>
  );
}
