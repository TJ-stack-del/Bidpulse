import type { SupabaseClient } from "@supabase/supabase-js";

// Shared by the intake wizard's own "Your bid file" step and the
// dashboard's "complete your bid" card (components/ui/BidFileStep.tsx) —
// both lock a submission the same way, so the draft/stage flip and the
// audit-log entry live in one place instead of two copies that could drift.
//
// The fit-check fetch is deliberately fire-and-forget and only kicked off
// after the lock above has actually succeeded (real scope/agency data is
// saved) — never before. A caller that wants to show the result (the
// wizard's confirmation screen) passes onFitCheck; a caller that doesn't
// (the dashboard card, which just refreshes the page) can omit it.
export type FitCheckResult = {
  alignment: string;
  explanation: string;
  mandatorySiteVisitConcern: boolean;
  mandatorySiteVisitExplanation: string | null;
};

export async function finalizeSubmission(
  supabase: SupabaseClient,
  submissionId: string,
  onFitCheck?: (result: FitCheckResult | null) => void
) {
  const { data: submission, error: submitError } = await supabase
    .from("submissions")
    .update({
      draft: false,
      submitted_at: new Date().toISOString(),
      stage: "submitted",
    })
    .eq("id", submissionId)
    .select("client_id")
    .single();

  if (submitError || !submission) {
    throw new Error(submitError?.message ?? "Couldn't submit.");
  }

  const { data: client } = await supabase
    .from("clients")
    .select("org_id")
    .eq("id", submission.client_id)
    .single();

  await supabase.from("audit_log").insert({
    submission_id: submissionId,
    org_id: client?.org_id,
    event_type: "submission_locked",
    event_detail: { event: "client_submitted" },
  });

  const fitCheckFetch = fetch("/api/generate-fit-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ submissionId }),
  }).then((res) => res.json());

  if (onFitCheck) {
    fitCheckFetch
      .then((data) =>
        onFitCheck(
          data?.fit_alignment
            ? {
                alignment: data.fit_alignment,
                explanation: data.fit_explanation,
                mandatorySiteVisitConcern: !!data.mandatory_site_visit_concern,
                mandatorySiteVisitExplanation: data.mandatory_site_visit_explanation ?? null,
              }
            : null
        )
      )
      .catch(() => onFitCheck(null));
  } else {
    fitCheckFetch.catch(() => {});
  }
}
