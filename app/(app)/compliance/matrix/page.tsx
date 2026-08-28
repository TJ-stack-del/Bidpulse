import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";
import { ComplianceMatrixTable } from "./ComplianceMatrixTable";

// Converted from mockups-reference/compliance_matrix_desktop/code.html.
// Dropped: the "Priority" and "Owner" avatar columns as originally styled
// (no priority column exists on compliance_items) and the Agency/Clause
// Type filters (no matching columns) — Owner is kept but driven by the
// real reviewed_by -> team_members join instead of a random avatar image.

const STATUS_FILTERS = ["not_started", "in_progress", "passed", "failed", "waived"];

export default async function ComplianceMatrixPage({
  searchParams,
}: {
  searchParams: Promise<{ bid?: string; status?: string }>;
}) {
  const { bid: bidId, status } = await searchParams;
  if (!bidId) redirect("/compliance");

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

  const { data: bid } = await supabase
    .from("bids")
    .select("id, title, agency, solicitation_number")
    .eq("id", bidId)
    .single();

  if (!bid) {
    return (
      <AppShell activePath="/compliance">
        <p className="text-body-md text-error mt-6">Bid not found.</p>
      </AppShell>
    );
  }

  const { data: allItems } = await supabase
    .from("compliance_items")
    .select("id, clause_reference, requirement, status, reviewed_by, team_members(full_name)")
    .eq("bid_id", bidId)
    .order("clause_reference", { ascending: true });

  // Supabase's untyped client can't tell this is a to-one embed (reviewed_by
  // is a single FK), so it infers team_members as an array — it's actually
  // a single object (or null) at runtime.
  type MatrixItem = {
    id: string;
    clause_reference: string;
    requirement: string;
    status: string;
    reviewed_by: string | null;
    team_members: { full_name: string } | null;
  };
  const items = (allItems ?? []) as unknown as MatrixItem[];
  const visibleItems = status ? items.filter((i) => i.status === status) : items;

  const total = items.length;
  const passed = items.filter((i) => i.status === "passed").length;
  const failed = items.filter((i) => i.status === "failed").length;
  const needsAttention = items.filter(
    (i) => i.status === "not_started" || i.status === "in_progress"
  ).length;

  return (
    <AppShell activePath="/compliance">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mt-6">
        <div>
          <div className="flex items-center gap-2 text-on-surface-variant text-body-md mb-2">
            <Link href="/compliance" className="hover:text-primary transition-colors">
              Compliance
            </Link>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
            <span className="text-on-surface font-bold">Matrix</span>
          </div>
          <h1 className="text-headline-lg text-on-surface mb-1">Compliance Matrix &amp; FAR Analysis</h1>
          <p className="text-body-md text-on-surface-variant">
            {bid.solicitation_number ?? bid.agency}: {bid.title}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <StatCard label="Total Clauses" value={total} icon="gavel" />
        <StatCard label="Passed" value={passed} icon="check_circle" tone="pass" />
        <StatCard label="Failed" value={failed} icon="cancel" tone="fail" />
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden mt-4">
        <div className="px-4 py-3 border-b border-outline-variant bg-surface flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <FilterChip label="All" active={!status} href={`/compliance/matrix?bid=${bidId}`} />
            {STATUS_FILTERS.map((s) => (
              <FilterChip
                key={s}
                label={s.replace("_", " ")}
                active={status === s}
                href={`/compliance/matrix?bid=${bidId}&status=${s}`}
              />
            ))}
          </div>
          <p className="text-code-sm text-on-surface-variant">
            {needsAttention} item{needsAttention === 1 ? "" : "s"} need attention
          </p>
        </div>

        {visibleItems.length > 0 ? (
          <ComplianceMatrixTable items={visibleItems} bidId={bidId} orgId={member.org_id} actorId={member.id} />
        ) : (
          <p className="text-body-md text-on-surface-variant px-6 py-6">No items match this filter.</p>
        )}
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: string;
  tone?: "pass" | "fail";
}) {
  return (
    <div className="bg-surface-container-lowest p-4 border border-outline-variant rounded-lg flex items-center justify-between">
      <div>
        <p className="text-label-md text-on-surface-variant mb-1">{label}</p>
        <p
          className={`text-headline-md ${
            tone === "pass" ? "text-on-tertiary-container" : tone === "fail" ? "text-error" : "text-on-surface"
          }`}
        >
          {value}
        </p>
      </div>
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center ${
          tone === "fail" ? "bg-error-container/30 text-error" : "bg-surface-container-highest text-on-surface-variant"
        }`}
      >
        <span className="material-symbols-outlined">{icon}</span>
      </div>
    </div>
  );
}

function FilterChip({ label, active, href }: { label: string; active: boolean; href: string }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1 rounded-full border text-label-md capitalize transition-colors ${
        active
          ? "bg-secondary text-on-secondary border-secondary"
          : "bg-surface-container-low text-on-surface-variant border-outline-variant hover:bg-surface-container-high"
      }`}
    >
      {label}
    </Link>
  );
}
