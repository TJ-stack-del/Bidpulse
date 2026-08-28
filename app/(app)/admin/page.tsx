import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";

// Converted from mockups-reference/admin_operations_dashboard/code.html.
// Dropped "System Alerts" (fabricated margin-threshold detection — no
// pricing-margin data anywhere) and "Team Capacity" (per-person active-bid
// counts — bids has no assignee column, so there's no way to attribute
// workload to a person). Replaced with a real Stage Distribution
// (bid_stage counts), a Needs Attention list (bids with failed compliance
// items), and a plain team roster.
//
// Gated by role_permissions.can_view_admin, per README section 5: "Gate
// /admin/* routes server-side... don't rely on hiding nav links alone."

const STAGES: { value: string; label: string }[] = [
  { value: "intake", label: "S1" },
  { value: "compliance_review", label: "S2" },
  { value: "assembly_drafting", label: "S3" },
  { value: "admin_audit", label: "S4" },
  { value: "client_review", label: "S5" },
  { value: "submission", label: "S6" },
];

export default async function AdminDashboardPage() {
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

  const [{ data: bids }, { data: deliverables }, { data: complianceItems }, { data: submissions }, { data: team }] =
    await Promise.all([
      supabase
        .from("bids")
        .select("id, title, agency, solicitation_number, estimated_value_high, stage, status, created_at")
        .eq("org_id", member.org_id),
      supabase
        .from("deliverables")
        .select("id, signed_off, bids!inner(org_id)")
        .eq("bids.org_id", member.org_id),
      supabase
        .from("compliance_items")
        .select("id, status, bid_id, bids!inner(org_id, title)")
        .eq("bids.org_id", member.org_id),
      supabase
        .from("submissions")
        .select("bid_id, submitted_at, bids!inner(org_id, created_at)")
        .eq("bids.org_id", member.org_id),
      supabase.from("team_members").select("id, full_name, role").eq("org_id", member.org_id),
    ]);

  const allBids = bids ?? [];
  const auditQueue = allBids.filter((b) => b.stage === "admin_audit");
  const pendingSignOff = (deliverables ?? []).filter((d) => !d.signed_off).length;
  const openValue = allBids
    .filter((b) => !["submitted", "awarded", "lost", "withdrawn"].includes(b.status))
    .reduce((sum, b) => sum + Number(b.estimated_value_high ?? 0), 0);

  type SubmissionRow = { bid_id: string; submitted_at: string; bids: { created_at: string } | null };
  const subs = (submissions ?? []) as unknown as SubmissionRow[];
  const cycleDays = subs
    .filter((s) => s.bids)
    .map((s) => (new Date(s.submitted_at).getTime() - new Date(s.bids!.created_at).getTime()) / 86400000);
  const avgCycleDays = cycleDays.length ? Math.round(cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length) : null;

  const stageCounts = STAGES.map((s) => ({
    ...s,
    count: allBids.filter((b) => b.stage === s.value).length,
  }));
  const maxStageCount = Math.max(1, ...stageCounts.map((s) => s.count));

  type ComplianceRow = { id: string; status: string; bid_id: string; bids: { title: string } | null };
  const complianceRows = (complianceItems ?? []) as unknown as ComplianceRow[];
  const failedByBid = complianceRows
    .filter((c) => c.status === "failed")
    .reduce<Record<string, { title: string; count: number }>>((acc, c) => {
      const title = c.bids?.title ?? "Untitled bid";
      if (!acc[c.bid_id]) acc[c.bid_id] = { title, count: 0 };
      acc[c.bid_id].count += 1;
      return acc;
    }, {});
  const needsAttention = Object.entries(failedByBid);

  return (
    <AppShell activePath="/admin">
      <h1 className="text-headline-lg text-on-surface mt-6 mb-1">Admin Operations</h1>
      <p className="text-body-md text-on-surface-variant mb-4">
        Executive summary of active audits and queue health.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard label="Active Audits" value={auditQueue.length} icon="analytics" />
        <MetricCard label="Pending Sign-Off" value={pendingSignOff} icon="pending_actions" />
        <MetricCard
          label="Open Pipeline Value"
          value={`$${(openValue / 1_000_000).toFixed(1)}M`}
          icon="payments"
        />
        <MetricCard label="Avg Cycle Time" value={avgCycleDays !== null ? `${avgCycleDays}d` : "—"} icon="timer" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4">
        <div className="lg:col-span-8 flex flex-col gap-6">
          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-title-lg text-on-surface">Priority Audit Queue (Stage 4)</h2>
            </div>
            {auditQueue.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant text-label-md text-on-surface-variant">
                      <th className="py-2 px-3 font-medium">Agency</th>
                      <th className="py-2 px-3 font-medium">Solicitation #</th>
                      <th className="py-2 px-3 font-medium">Value</th>
                      <th className="py-2 px-3 font-medium text-right">Review</th>
                    </tr>
                  </thead>
                  <tbody className="text-body-md">
                    {auditQueue.map((bid) => (
                      <tr key={bid.id} className="border-b border-outline-variant last:border-b-0">
                        <td className="py-3 px-3 text-on-surface font-bold">{bid.agency}</td>
                        <td className="py-3 px-3 font-code text-code-sm text-on-surface-variant">
                          {bid.solicitation_number ?? "—"}
                        </td>
                        <td className="py-3 px-3 font-code text-code-sm text-on-surface-variant">
                          {bid.estimated_value_high ? `$${Number(bid.estimated_value_high).toLocaleString()}` : "—"}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <Link href={`/admin/review?bid=${bid.id}`} className="text-secondary text-label-md hover:underline">
                            Review
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-body-md text-on-surface-variant">No bids in admin audit right now.</p>
            )}
          </section>

          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
            <h2 className="text-title-lg text-on-surface mb-4">Stage Distribution</h2>
            <div className="h-40 bg-surface-container-low rounded flex items-end justify-around p-4">
              {stageCounts.map((s) => (
                <div key={s.value} className="flex flex-col items-center gap-1">
                  <span className="text-label-md text-on-surface">{s.count}</span>
                  <div
                    className={`w-8 rounded-t ${s.value === "admin_audit" ? "bg-secondary" : "bg-outline-variant"}`}
                    style={{ height: `${Math.max(6, (s.count / maxStageCount) * 96)}px` }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-around mt-2 text-label-md text-on-surface-variant">
              {stageCounts.map((s) => (
                <span key={s.value} className={s.value === "admin_audit" ? "font-bold text-secondary" : ""}>
                  {s.label}
                </span>
              ))}
            </div>
          </section>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-6">
          <section className="bg-surface-container-lowest border border-outline-variant border-l-4 border-l-error rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-error">warning</span>
              <h3 className="text-title-lg text-on-surface">Needs Attention</h3>
            </div>
            {needsAttention.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {needsAttention.map(([bidId, info]) => (
                  <li key={bidId} className="p-3 bg-error-container/20 rounded flex flex-col gap-1">
                    <Link href={`/compliance/matrix?bid=${bidId}`} className="text-label-md text-on-surface font-bold hover:underline">
                      {info.title}
                    </Link>
                    <span className="text-body-md text-on-surface-variant">
                      {info.count} failed compliance item{info.count === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body-md text-on-surface-variant">Nothing flagged.</p>
            )}
          </section>

          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-title-lg text-on-surface">Team</h3>
              <Link href="/settings/team" className="text-secondary text-label-md hover:underline">
                Manage
              </Link>
            </div>
            <ul className="flex flex-col gap-3">
              {(team ?? []).map((t) => (
                <li key={t.id} className="flex justify-between items-center py-2 border-b border-outline-variant/50 last:border-b-0">
                  <span className="text-body-md text-on-surface">{t.full_name}</span>
                  <span className="text-code-sm font-code text-on-surface-variant">{t.role.replace("_", " ")}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/settings/roles"
              className="block w-full mt-4 text-center py-2 border border-outline-variant text-on-surface rounded text-label-md hover:bg-surface-container-low transition-colors"
            >
              Role Permissions
            </Link>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 flex flex-col justify-between h-28">
      <div className="flex justify-between items-start">
        <span className="text-label-md text-on-surface-variant uppercase">{label}</span>
        <span className="material-symbols-outlined text-secondary">{icon}</span>
      </div>
      <div className="text-display-lg text-on-surface">{value}</div>
    </div>
  );
}
