import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";
import { ComplianceItemActions } from "./ComplianceItemActions";

// Converted from mockups-reference/compliance_check_detail_desktop/code.html
// (and _mobile, same content at different breakpoints — AppShell already
// handles the mobile/desktop split). That mockup is built around an AI
// document viewer with auto-generated "Compliance Findings" you Ignore /
// Edit Manually / Apply Suggestion — there's no document store or AI
// findings table in schema.sql, so this keeps the real idea (review one
// clause, record a decision) as a plain status + notes form instead.

const STATUS_OPTIONS = ["not_started", "in_progress", "passed", "failed", "waived"];

export default async function ComplianceItemPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
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

  const { data: item } = await supabase
    .from("compliance_items")
    .select(
      "id, bid_id, clause_reference, requirement, status, notes, reviewed_at, reviewed_by, bids(title, agency, solicitation_number), team_members(full_name)"
    )
    .eq("id", itemId)
    .single();

  if (!item) notFound();

  const bid = item.bids as unknown as { title: string; agency: string; solicitation_number: string | null } | null;
  const reviewer = item.team_members as unknown as { full_name: string } | null;

  return (
    <AppShell activePath="/compliance">
      <div className="flex items-center gap-2 text-on-surface-variant text-body-md mt-6 mb-2">
        <Link href={`/compliance?bid=${item.bid_id}`} className="hover:text-primary transition-colors">
          Rules
        </Link>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <span className="text-on-surface font-bold">{item.clause_reference}</span>
      </div>

      <h1 className="text-headline-lg text-on-surface mb-1">Rule: {item.clause_reference}</h1>
      {bid && (
        <p className="text-body-md text-on-surface-variant mb-4">
          {bid.solicitation_number ?? bid.agency}: {bid.title}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
            <h2 className="text-title-lg text-on-surface mb-4">What You Need To Do</h2>
            <p className="text-body-md text-on-surface-variant bg-surface p-4 rounded border border-outline-variant/30">
              {item.requirement}
            </p>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
            <h2 className="text-title-lg text-on-surface mb-4">What's Happened So Far</h2>
            {item.reviewed_at ? (
              <p className="text-body-md text-on-surface-variant">
                Last checked by <span className="text-on-surface">{reviewer?.full_name ?? "a team member"}</span> on{" "}
                {new Date(item.reviewed_at).toLocaleString()}.
              </p>
            ) : (
              <p className="text-body-md text-on-surface-variant">Nobody's checked this yet.</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 sticky top-[88px]">
            <h3 className="text-title-lg text-on-surface mb-4">Mark This Rule</h3>
            <ComplianceItemActions
              itemId={item.id}
              bidId={item.bid_id}
              orgId={member.org_id}
              actorId={member.id}
              clauseReference={item.clause_reference}
              currentStatus={item.status}
              currentNotes={item.notes ?? ""}
              statusOptions={STATUS_OPTIONS}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
