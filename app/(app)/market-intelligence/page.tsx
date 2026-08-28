import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";

// Converted from mockups-reference/market_intelligence_desktop/code.html —
// the full filterable/sortable browse view of matched_opportunities (the
// dashboard only shows a top-4 preview). Cards link into the existing
// /opportunities/[id] detail page rather than duplicating its layout.
// Dropped: the Estimated Value range filter and "Deadline"/"Value" sort
// options — matched_opportunities has no due_date or value column (see
// README section 2 step 5 / the /opportunities/[id] comment for the same
// note). Agency filter and Match Score sort are real and kept.

const STATUS_FILTERS = ["new", "reviewed", "converted_to_bid", "dismissed"];

export default async function MarketIntelligencePage({
  searchParams,
}: {
  searchParams: Promise<{ agency?: string; status?: string; sort?: string }>;
}) {
  const { agency, status, sort } = await searchParams;
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
      <AppShell activePath="/market-intelligence">
        <p className="text-body-md text-error mt-6">
          No team_members record found for this account — see README step 12.
        </p>
      </AppShell>
    );
  }

  const { data: allOpportunities } = await supabase
    .from("matched_opportunities")
    .select("id, source_title, source_agency, match_score, match_rationale, status, naics_codes")
    .eq("org_id", member.org_id);

  const opportunities = allOpportunities ?? [];
  const agencies = Array.from(new Set(opportunities.map((o) => o.source_agency))).sort();

  let visible = opportunities;
  if (agency) visible = visible.filter((o) => o.source_agency === agency);
  if (status) visible = visible.filter((o) => o.status === status);
  visible = [...visible].sort((a, b) =>
    sort === "match_asc" ? a.match_score - b.match_score : b.match_score - a.match_score
  );

  const qs = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const next = { agency, status, sort, ...overrides };
    Object.entries(next).forEach(([k, v]) => v && params.set(k, v));
    const s = params.toString();
    return s ? `?${s}` : "";
  };

  return (
    <AppShell activePath="/market-intelligence">
      <h1 className="text-headline-lg text-on-surface mt-6 mb-1">Market Intelligence</h1>
      <p className="text-body-md text-on-surface-variant mb-4">
        {visible.length} of {opportunities.length} matched solicitations.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <aside className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 flex flex-col gap-6 h-fit">
          <div className="flex justify-between items-center">
            <h2 className="text-title-lg text-on-surface">Filters</h2>
            <Link href="/market-intelligence" className="text-secondary text-label-md hover:underline">
              Reset
            </Link>
          </div>

          <div>
            <h3 className="text-label-md text-on-surface-variant uppercase mb-3 tracking-wide">Agency</h3>
            <div className="flex flex-col gap-2">
              {agencies.length > 0 ? (
                agencies.map((a) => (
                  <Link
                    key={a}
                    href={qs({ agency: agency === a ? undefined : a })}
                    className={`text-body-md hover:text-primary transition-colors ${
                      agency === a ? "text-secondary font-bold" : "text-on-surface-variant"
                    }`}
                  >
                    {a}
                  </Link>
                ))
              ) : (
                <p className="text-body-md text-on-surface-variant">No opportunities logged yet.</p>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-label-md text-on-surface-variant uppercase mb-3 tracking-wide">Status</h3>
            <div className="flex flex-col gap-2">
              {STATUS_FILTERS.map((s) => (
                <Link
                  key={s}
                  href={qs({ status: status === s ? undefined : s })}
                  className={`text-body-md capitalize hover:text-primary transition-colors ${
                    status === s ? "text-secondary font-bold" : "text-on-surface-variant"
                  }`}
                >
                  {s.replace("_", " ")}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-label-md text-on-surface-variant uppercase mb-3 tracking-wide">Sort</h3>
            <div className="flex flex-col gap-2">
              <Link
                href={qs({ sort: "match_desc" })}
                className={`text-body-md hover:text-primary transition-colors ${
                  sort !== "match_asc" ? "text-secondary font-bold" : "text-on-surface-variant"
                }`}
              >
                Match % (High to Low)
              </Link>
              <Link
                href={qs({ sort: "match_asc" })}
                className={`text-body-md hover:text-primary transition-colors ${
                  sort === "match_asc" ? "text-secondary font-bold" : "text-on-surface-variant"
                }`}
              >
                Match % (Low to High)
              </Link>
            </div>
          </div>
        </aside>

        <div className="lg:col-span-3">
          {visible.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {visible.map((opp) => (
                <Link
                  key={opp.id}
                  href={`/opportunities/${opp.id}`}
                  className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 flex flex-col hover:bg-surface-bright transition-colors relative overflow-hidden"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-on-tertiary-container" />
                  <div className="flex justify-between items-start mb-3 pl-2">
                    <span className="bg-surface-container text-on-surface-variant text-label-md px-2 py-1 rounded">
                      {opp.source_agency}
                    </span>
                    <span className="text-on-tertiary-container text-label-md font-bold">
                      {Math.round(opp.match_score)}%
                    </span>
                  </div>
                  <h3 className="text-title-lg text-on-surface pl-2 mb-2 line-clamp-2">{opp.source_title}</h3>
                  {opp.match_rationale && (
                    <p className="text-body-md text-on-surface-variant pl-2 line-clamp-2">{opp.match_rationale}</p>
                  )}
                  <span className="pl-2 mt-4 text-label-md text-on-surface-variant capitalize">
                    {opp.status.replace("_", " ")}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-body-md text-on-surface-variant bg-surface-container-lowest border border-outline-variant rounded p-6">
              No opportunities match these filters.
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
