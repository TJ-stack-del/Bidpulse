import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";
import { FitScoreEditor } from "./FitScoreEditor";

// Converted from mockups-reference/fit_analysis_detail/code.html — shown
// there as a modal dialog, rendered here as a full AppShell page like the
// rest of the app's detail views. Maps directly onto bids.fit_score and
// bids.scoring_breakdown (jsonb, free-form — see schema.sql), so this
// defines the shape it expects (verdict / factors / strengths / risks,
// matching the mockup's own sections) and treats it defensively since
// nothing else in the app writes to that column yet.

export type ScoringBreakdown = {
  verdict?: string;
  factors?: { label: string; score: number; note?: string }[];
  strengths?: string[];
  risks?: string[];
};

export default async function FitScorePage({
  params,
}: {
  params: Promise<{ bidId: string }>;
}) {
  const { bidId } = await params;
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
      <AppShell activePath="/fit-score">
        <p className="text-body-md text-error mt-6">
          No team_members record found for this account — see README step 12.
        </p>
      </AppShell>
    );
  }

  const { data: bid } = await supabase
    .from("bids")
    .select("id, title, agency, solicitation_number, fit_score, scoring_breakdown")
    .eq("id", bidId)
    .single();

  if (!bid) notFound();

  const breakdown = (bid.scoring_breakdown ?? {}) as ScoringBreakdown;
  const score = bid.fit_score !== null ? Math.round(Number(bid.fit_score)) : null;
  const circumference = 2 * Math.PI * 60;
  const dashOffset = score !== null ? circumference * (1 - Math.max(0, Math.min(100, score)) / 100) : circumference;

  return (
    <AppShell activePath="/fit-score">
      <div className="flex items-center gap-2 text-on-surface-variant text-body-md mt-6 mb-2">
        <Link href={`/intake?bid=${bid.id}`} className="hover:text-primary transition-colors">
          {bid.title}
        </Link>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <span className="text-on-surface font-bold">Fit Analysis</span>
      </div>

      <p className="text-code-sm text-on-surface-variant mb-4">
        {bid.solicitation_number ?? bid.agency}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
        <div className="flex flex-col items-center justify-center relative">
          <svg className="w-48 h-48 -rotate-90">
            <circle
              className="text-surface-container-high"
              cx="96"
              cy="96"
              r="60"
              fill="transparent"
              stroke="currentColor"
              strokeWidth="10"
            />
            <circle
              className="text-on-tertiary-container"
              cx="96"
              cy="96"
              r="60"
              fill="transparent"
              stroke="currentColor"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-headline-lg text-on-surface">{score !== null ? `${score}%` : "—"}</span>
            <span className="text-label-md text-on-surface-variant mt-1 uppercase tracking-widest">Fit Score</span>
          </div>
        </div>

        <div className="bg-surface-container-low border-l-4 border-on-tertiary-container p-5 rounded-r-lg">
          <h3 className="text-label-md text-on-surface-variant uppercase mb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">verified</span>
            The BidPulse Verdict
          </h3>
          <p className="text-body-md text-on-surface">
            {breakdown.verdict ?? "No verdict recorded yet — add one below."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
        <div className="flex flex-col gap-6">
          <div>
            <h3 className="text-title-lg text-on-surface mb-4">Score Breakdown</h3>
            {breakdown.factors && breakdown.factors.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {breakdown.factors.map((factor, i) => (
                  <div
                    key={i}
                    className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-label-md text-on-surface font-bold">{factor.label}</span>
                      <span className="text-code-sm font-code font-bold text-on-tertiary-container">
                        {factor.score}%
                      </span>
                    </div>
                    <div className="w-full bg-surface-variant rounded-full h-1.5 mb-2">
                      <div
                        className="bg-on-tertiary-container h-1.5 rounded-full"
                        style={{ width: `${Math.max(0, Math.min(100, factor.score))}%` }}
                      />
                    </div>
                    {factor.note && <p className="text-body-md text-on-surface-variant">{factor.note}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-body-md text-on-surface-variant">No scoring factors recorded yet.</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ListCard title="Key Strengths" icon="thumb_up" tone="pass" items={breakdown.strengths ?? []} />
            <ListCard title="Potential Risks" icon="warning" tone="fail" items={breakdown.risks ?? []} />
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
          <h3 className="text-title-lg text-on-surface mb-4">Edit Fit Analysis</h3>
          <FitScoreEditor bidId={bid.id} currentScore={bid.fit_score} currentBreakdown={breakdown} />
        </div>
      </div>
    </AppShell>
  );
}

function ListCard({
  title,
  icon,
  tone,
  items,
}: {
  title: string;
  icon: string;
  tone: "pass" | "fail";
  items: string[];
}) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5">
      <h4 className="text-label-md text-on-surface mb-4 flex items-center gap-2">
        <span className={`material-symbols-outlined ${tone === "pass" ? "text-on-tertiary-container" : "text-error"}`}>
          {icon}
        </span>
        {title}
      </h4>
      {items.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <span
                className={`material-symbols-outlined text-[18px] mt-0.5 ${
                  tone === "pass" ? "text-on-tertiary-container" : "text-error"
                }`}
              >
                {tone === "pass" ? "check_circle" : "error"}
              </span>
              <span className="text-body-md text-on-surface-variant">{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-body-md text-on-surface-variant">None recorded yet.</p>
      )}
    </div>
  );
}
