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
  onFitCheck?: (result: FitCheckResult | null) => void,
  // Real legal record that the client actively checked the "no guarantee of
  // winning" box, not just UI copy they could've skimmed past — BidFileStep
  // disables the submit button until this is true, so by the time this runs
  // it's already a hard true, but the audit_log row is what makes it provable
  // later rather than only ever having existed in React state.
  acknowledgedNoGuarantee?: boolean
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

  if (acknowledgedNoGuarantee) {
    await supabase.from("audit_log").insert({
      submission_id: submissionId,
      org_id: client?.org_id,
      event_type: "no_guarantee_acknowledged",
      event_detail: {
        text: "I understand that BidPulse helps prepare my bid but does not guarantee I will win the contract.",
      },
    });
  }

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
