import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";
import Link from "next/link";

// This replaces the old self-serve /bids list — now shows every client's
// submissions, not just one contractor's own.

export default async function AdminInboxPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Without this check, a client account hitting this URL directly would
  // still render the page (RLS just narrows the query to their own single
  // row), mislabeled as "every client's submissions" — root already knows
  // where a client actually belongs.
  const { data: member } = await supabase
    .from("team_members")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!member) redirect("/");

  const { data: submissions } = await supabase
    .from("submissions")
    .select("id, agency, solicitation_number, stage, due_date, is_test, draft, clients(company_name)")
    .order("created_at", { ascending: false });

  const stageLabels: Record<string, string> = {
    submitted: "Submitted",
    in_review: "In review",
    deliverables_ready: "Deliverables ready",
    client_review: "Client review",
    confirmed_submitted: "Confirmed submitted",
    closed: "Closed",
  };

  return (
    <AppShell activePath="/admin/inbox" role="admin">
      <div className="mt-6">
        <h1 className="text-headline-lg text-on-surface mb-1">Intake Inbox</h1>
        <p className="text-body-md text-on-surface-variant">
          Every client submission, across every stage.
        </p>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl mt-4 overflow-x-auto">
        <table className="w-full text-body-md">
          <thead className="bg-surface-container-low">
            <tr>
              <th className="text-left px-4 py-3 text-label-md text-on-surface-variant">Client</th>
              <th className="text-left px-4 py-3 text-label-md text-on-surface-variant">Agency</th>
              <th className="text-left px-4 py-3 text-label-md text-on-surface-variant">Stage</th>
              <th className="text-left px-4 py-3 text-label-md text-on-surface-variant">Due</th>
              <th className="text-left px-4 py-3 text-label-md text-on-surface-variant"></th>
            </tr>
          </thead>
          <tbody>
            {(submissions ?? []).map((sub: any) => (
              <tr key={sub.id} className="border-t border-outline-variant">
                <td className="px-4 py-3 text-on-surface">
                  {sub.clients?.company_name ?? "—"}
                  {sub.is_test && (
                    <span className="ml-2 text-[10px] px-2 py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-bold uppercase">
                      Test
                    </span>
                  )}
                  {sub.draft && (
                    <span className="ml-2 text-[10px] px-2 py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-bold uppercase">
                      Draft
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-on-surface-variant">{sub.agency}</td>
                <td className="px-4 py-3 text-on-surface-variant">{stageLabels[sub.stage] ?? sub.stage}</td>
                <td className="px-4 py-3 text-on-surface-variant">
                  {sub.due_date ? new Date(sub.due_date).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/inbox/${sub.id}`} className="text-secondary font-bold hover:underline">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {(!submissions || submissions.length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-on-surface-variant">
                  No submissions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
