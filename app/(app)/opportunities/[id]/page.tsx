import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";
import { OpportunityActions } from "./OpportunityActions";

// Converted from mockups-reference/matched_opportunities_detail/code.html —
// that mockup is actually a browse/list ("Market Intelligence") screen, but
// the route map calls for a single-record `/opportunities/[id]` detail page,
// so this keeps its per-card visual language (fit-score ring, agency chip,
// rationale note) applied to one matched_opportunities row instead of a
// list. Fields the mockup shows but the table has no column for — Est.
// Value, days-left countdown — are dropped rather than faked; see README
// section 2, step 5. The mockup's "Shortlisted" status also isn't one of
// matched_opportunities.status's real values (new | reviewed |
// converted_to_bid | dismissed per schema.sql), so actions here are named
// after the real status they set.

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  reviewed: "Reviewed",
  converted_to_bid: "Converted to Bid",
  dismissed: "Dismissed",
};

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: opportunity } = await supabase
    .from("matched_opportunities")
    .select("*")
    .eq("id", id)
    .single();

  if (!opportunity) notFound();

  const circumference = 2 * Math.PI * 28;
  const score = Math.max(0, Math.min(100, Math.round(opportunity.match_score)));
  const dashOffset = circumference * (1 - score / 100);

  return (
    <AppShell activePath="/opportunities">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mt-6">
        <div>
          <p className="text-label-md text-on-surface-variant uppercase tracking-wider mb-1">
            Market Intelligence
          </p>
          <h1 className="text-headline-lg text-on-surface">{opportunity.source_title}</h1>
        </div>
        <span
          className={`text-label-md px-3 py-1 rounded font-bold uppercase shrink-0 ${
            opportunity.status === "converted_to_bid"
              ? "bg-on-tertiary-container text-on-tertiary"
              : opportunity.status === "dismissed"
              ? "bg-surface-container text-on-surface-variant"
              : opportunity.status === "reviewed"
              ? "bg-surface-container-highest text-on-surface"
              : "bg-secondary text-on-primary"
          }`}
        >
          {STATUS_LABEL[opportunity.status] ?? opportunity.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
            <div className="flex items-center gap-4 text-body-md text-on-surface-variant mb-4">
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[18px]">apartment</span>
                {opportunity.source_agency}
              </div>
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[18px]">event</span>
                Logged {new Date(opportunity.created_at).toLocaleDateString()}
              </div>
            </div>

            {opportunity.naics_codes && opportunity.naics_codes.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {opportunity.naics_codes.map((code: string) => (
                  <span
                    key={code}
                    className="bg-surface-container text-on-surface-variant text-code-sm font-code px-2 py-1 rounded"
                  >
                    NAICS {code}
                  </span>
                ))}
              </div>
            )}

            {opportunity.match_rationale && (
              <p className="text-body-md text-on-surface-variant bg-surface p-4 rounded border border-outline-variant/30 italic">
                {opportunity.match_rationale}
              </p>
            )}
          </div>

          {opportunity.status === "converted_to_bid" && opportunity.bid_id && (
            <div className="bg-surface-container-lowest border-l-4 border-l-on-tertiary-container border border-outline-variant rounded-r-xl p-6 flex items-center justify-between">
              <p className="text-body-md text-on-surface">
                This opportunity has already been converted into a bid.
              </p>
              <Link
                href={`/intake?bid=${opportunity.bid_id}`}
                className="text-secondary text-label-md font-bold hover:underline shrink-0"
              >
                View Bid
              </Link>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 flex flex-col items-center">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90">
                <circle
                  className="text-surface-container-high"
                  cx="48"
                  cy="48"
                  fill="transparent"
                  r="28"
                  stroke="currentColor"
                  strokeWidth="6"
                />
                <circle
                  className="text-on-tertiary-container"
                  cx="48"
                  cy="48"
                  fill="transparent"
                  r="28"
                  stroke="currentColor"
                  strokeWidth="6"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute font-bold text-title-lg text-on-surface">{score}%</span>
            </div>
            <span className="text-label-md text-on-surface-variant mt-2">Match Score</span>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 sticky top-[88px]">
            <h3 className="text-title-lg text-on-surface mb-4">Actions</h3>
            <OpportunityActions
              opportunityId={opportunity.id}
              status={opportunity.status}
              sourceTitle={opportunity.source_title}
              sourceAgency={opportunity.source_agency}
              orgId={opportunity.org_id}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
