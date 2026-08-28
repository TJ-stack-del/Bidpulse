import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";
import { LifecycleStepper } from "@/components/ui/LifecycleStepper";
import { ComplianceChecklist } from "./ComplianceChecklist";

// Converted from mockups-reference/compliance_review/code.html. The
// mockup's "Security Certifications" and "Technical Thresholds" cards have
// no backing table (no columns for SLA/data-localization/certifications
// anywhere in schema.sql), so they're replaced with a real status
// breakdown computed from this bid's compliance_items. Same for the
// mockup's hardcoded "78%" score — computed from real rows below.

export default async function CompliancePage({
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
      <AppShell activePath="/compliance">
        <p className="text-body-md text-error mt-6">
          No team_members record found for this account — see README step 12.
        </p>
      </AppShell>
    );
  }

  // No bid selected — show a picker instead of guessing which one.
  if (!bidId) {
    const { data: bids } = await supabase
      .from("bids")
      .select("id, title, agency, stage")
      .eq("org_id", member.org_id)
      .order("created_at", { ascending: false });

    return (
      <AppShell activePath="/compliance">
        <h1 className="text-headline-lg text-on-surface mt-6 mb-1">Compliance Checklist</h1>
        <p className="text-body-md text-on-surface-variant mb-4">Pick a bid to review.</p>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
          {bids && bids.length > 0 ? (
            bids.map((bid) => (
              <Link
                key={bid.id}
                href={`/compliance?bid=${bid.id}`}
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
    .select("id, title, agency, solicitation_number, stage")
    .eq("id", bidId)
    .single();

  if (!bid) {
    return (
      <AppShell activePath="/compliance">
        <p className="text-body-md text-error mt-6">Bid not found.</p>
      </AppShell>
    );
  }

  const { data: items } = await supabase
    .from("compliance_items")
    .select("id, clause_reference, requirement, status")
    .eq("bid_id", bidId)
    .order("clause_reference", { ascending: true });

  const allItems = items ?? [];
  const total = allItems.length;
  const passed = allItems.filter((i) => i.status === "passed").length;
  const score = total > 0 ? Math.round((passed / total) * 100) : 0;

  return (
    <AppShell activePath="/compliance">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mt-6">
        <div>
          <h1 className="text-headline-lg text-on-surface mb-1">Compliance Checklist</h1>
          <p className="text-body-md text-on-surface-variant">
            {bid.solicitation_number ?? bid.agency}: {bid.title}
          </p>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 flex items-center gap-6 w-full md:w-auto">
          <div>
            <div className="text-label-md text-on-surface-variant mb-1 uppercase tracking-wider">
              Compliance Score
            </div>
            <span className="text-display-lg text-on-tertiary-container">{score}%</span>
          </div>
          <div className="w-24 h-2 bg-surface-container-high rounded-full overflow-hidden">
            <div className="h-full bg-on-tertiary-container" style={{ width: `${score}%` }} />
          </div>
        </div>
      </div>

      <LifecycleStepper currentStage={2} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
              <h2 className="text-title-lg text-on-surface">Requirements</h2>
              <Link
                href={`/compliance/matrix?bid=${bidId}`}
                className="text-secondary text-label-md hover:underline"
              >
                View Full Matrix
              </Link>
            </div>
            {allItems.length > 0 ? (
              <ComplianceChecklist
                items={allItems}
                bidId={bid.id}
                orgId={member.org_id}
                actorId={member.id}
              />
            ) : (
              <p className="text-body-md text-on-surface-variant px-6 py-6">
                No compliance items logged for this bid yet.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <StatusBreakdown items={allItems} />
        </div>
      </div>
    </AppShell>
  );
}

function StatusBreakdown({ items }: { items: { status: string }[] }) {
  const counts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});

  const rows: { label: string; key: string; tone: "pass" | "fail" | "neutral" }[] = [
    { label: "Passed", key: "passed", tone: "pass" },
    { label: "In Progress", key: "in_progress", tone: "neutral" },
    { label: "Not Started", key: "not_started", tone: "neutral" },
    { label: "Waived", key: "waived", tone: "neutral" },
    { label: "Failed", key: "failed", tone: "fail" },
  ];

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
      <h3 className="text-title-lg text-on-surface mb-4">Status Breakdown</h3>
      <div className="flex flex-col">
        {rows.map((row, i) => (
          <div
            key={row.key}
            className={`flex justify-between items-center py-2 ${
              i === rows.length - 1 ? "" : "border-b border-outline-variant/50"
            }`}
          >
            <span className="text-body-md text-on-surface-variant">{row.label}</span>
            <span
              className={`font-label-md px-2 py-0.5 rounded text-[10px] border ${
                row.tone === "pass"
                  ? "bg-surface-container-low text-on-tertiary-container border-on-tertiary-container/20"
                  : row.tone === "fail"
                  ? "bg-error-container text-on-error-container border-on-error-container/20"
                  : "bg-surface-container-low text-on-surface-variant border-outline-variant"
              }`}
            >
              {counts[row.key] ?? 0}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
