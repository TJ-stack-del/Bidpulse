import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";
import { MatchesPanel } from "./MatchesPanel";

// BUILD-ORDER-SPECWRIGHT.md Step 8: "adapt the existing scrapers
// (lib/scrapers/*)" — that directory doesn't exist anywhere in this repo,
// so there's nothing to adapt. What's built here is the other half that
// stands on its own: an admin screen to review matched_opportunities and
// assign one to a client, which seeds a real submission for them. Until a
// scraper exists, opportunities get logged manually from this same screen.

export default async function AdminMatchesPage() {
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

  if (!member) redirect("/");

  const { data: matches } = await supabase
    .from("matched_opportunities")
    .select(
      "id, source_title, source_agency, source_url, due_date, match_score, status, assigned_client_id, created_at"
    )
    .eq("org_id", member.org_id)
    .order("created_at", { ascending: false });

  const { data: clients } = await supabase
    .from("clients")
    .select("id, company_name")
    .eq("org_id", member.org_id)
    .order("company_name", { ascending: true });

  return (
    <AppShell activePath="/admin/matches" role="admin">
      <div className="mt-6">
        <h1 className="text-headline-lg text-on-surface mb-1">Matched Opportunities</h1>
        <p className="text-body-md text-on-surface-variant">
          Review new matches and assign each one to a client.
        </p>
      </div>

      <MatchesPanel
        orgId={member.org_id}
        actorId={member.id}
        initialMatches={matches ?? []}
        clients={clients ?? []}
      />
    </AppShell>
  );
}
