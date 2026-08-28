import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";

// Converted from mockups-reference/analytics_insights_desktop/code.html
// (and _mobile). Every KPI here is computed from real bids/compliance_items
// rows. Dropped: "+12.4% vs Q2" / "-3 vs Q2" period-over-period deltas (no
// historical snapshot table to compare against) and the placeholder bar
// chart's fake per-bar values (replaced with a real Win/Loss count and the
// same real Pipeline Distribution the /admin dashboard uses).

const STAGE_SEQUENCE: { value: string; label: string }[] = [
  { value: "intake", label: "Discovery" },
  { value: "compliance_review", label: "Compliance" },
  { value: "assembly_drafting", label: "Assembly" },
  { value: "admin_audit", label: "Audit" },
  { value: "client_review", label: "Review" },
  { value: "submission", label: "Submission" },
];

const CLOSED_STATUSES = ["submitted", "awarded", "lost", "withdrawn"];

export default async function AnalyticsPage() {
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
      <AppShell activePath="/analytics">
        <p className="text-body-md text-error mt-6">
          No team_members record found for this account — see README step 12.
        </p>
      </AppShell>
    );
  }

  const [{ data: bids }, { data: complianceItems }] = await Promise.all([
    supabase.from("bids").select("id, stage, status, estimated_value_high").eq("org_id", member.org_id),
    supabase
      .from("compliance_items")
      .select("status, bids!inner(org_id)")
      .eq("bids.org_id", member.org_id),
  ]);

  const allBids = bids ?? [];
  const activeBids = allBids.filter((b) => !CLOSED_STATUSES.includes(b.status));
  const awarded = allBids.filter((b) => b.status === "awarded");
  const lost = allBids.filter((b) => b.status === "lost");
  const winRate = awarded.length + lost.length > 0 ? Math.round((awarded.length / (awarded.length + lost.length)) * 100) : null;
  const pipelineValue = activeBids.reduce((sum, b) => sum + Number(b.estimated_value_high ?? 0), 0);

  const items = complianceItems ?? [];
  const compliancePassed = items.filter((i) => i.status === "passed" || i.status === "waived").length;
  const complianceScore = items.length > 0 ? Math.round((compliancePassed / items.length) * 100) : null;

  const stageCounts = STAGE_SEQUENCE.map((s) => ({
    ...s,
    count: allBids.filter((b) => b.stage === s.value).length,
  }));
  const maxStageCount = Math.max(1, ...stageCounts.map((s) => s.count));
  const maxWinLoss = Math.max(1, awarded.length, lost.length);

  return (
    <AppShell activePath="/analytics">
      <h1 className="text-headline-lg text-on-surface mt-6 mb-1">Analytics &amp; Insights</h1>
      <p className="text-body-lg text-on-surface-variant mb-4">Real-time performance metrics and pipeline health.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Open Pipeline Value" value={`$${(pipelineValue / 1_000_000).toFixed(1)}M`} icon="account_balance_wallet" />
        <KpiCard label="Win Rate" value={winRate === null ? "—" : `${winRate}%`} icon="emoji_events" />
        <KpiCard label="Active Bids" value={activeBids.length} icon="assignment" />
        <KpiCard
          label="Compliance Score"
          value={complianceScore === null ? "—" : `${complianceScore}%`}
          icon="security"
          tone="pass"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
          <h3 className="text-title-lg text-on-surface mb-6">Win / Loss</h3>
          <div className="h-48 flex items-end justify-around gap-8 px-4">
            <div className="flex flex-col items-center gap-2">
              <span className="text-label-md text-on-surface">{awarded.length}</span>
              <div
                className="w-16 bg-on-tertiary-container rounded-t"
                style={{ height: `${Math.max(6, (awarded.length / maxWinLoss) * 140)}px` }}
              />
              <span className="text-label-md text-on-surface-variant">Won</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-label-md text-on-surface">{lost.length}</span>
              <div
                className="w-16 bg-outline-variant rounded-t"
                style={{ height: `${Math.max(6, (lost.length / maxWinLoss) * 140)}px` }}
              />
              <span className="text-label-md text-on-surface-variant">Lost</span>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
          <h3 className="text-title-lg text-on-surface mb-6">Pipeline Distribution</h3>
          <div className="flex flex-col gap-4">
            {stageCounts.map((s) => (
              <div key={s.value} className="flex items-center gap-4">
                <div className="w-20 text-label-md text-on-surface-variant text-right shrink-0">{s.label}</div>
                <div className="flex-1 h-3 bg-surface-variant rounded-full overflow-hidden">
                  <div
                    className="h-full bg-secondary-container"
                    style={{ width: `${(s.count / maxStageCount) * 100}%` }}
                  />
                </div>
                <div className="w-6 text-code-sm text-on-surface text-right shrink-0">{s.count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function KpiCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: string;
  tone?: "pass";
}) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <span className="text-label-md text-on-surface-variant uppercase tracking-wider">{label}</span>
        <span className={`material-symbols-outlined ${tone === "pass" ? "text-on-tertiary-container" : "text-secondary-container"}`}>
          {icon}
        </span>
      </div>
      <span className="text-display-lg text-on-surface">{value}</span>
    </div>
  );
}
