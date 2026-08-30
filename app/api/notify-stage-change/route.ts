import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { getStageChangeEmail } from "@/lib/email/templates";

// Called by AdminSubmissionActions right after a stage change is saved —
// looks up the submission's *current* stage from the DB rather than trusting
// a stage passed in the body, so the email can never say something the
// database doesn't actually reflect.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const submissionId = body?.submissionId;
  // Accepted for the caller's convenience/traceability only — never used to
  // decide what the email says, since the DB read below is authoritative.
  const requestedStage = typeof body?.newStage === "string" ? body.newStage : undefined;

  if (typeof submissionId !== "string") {
    return NextResponse.json({ error: "Invalid submissionId." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (!user) {
    // getUser()'s error was previously discarded, so "Not authenticated"
    // gave no way to tell an expired/invalid session apart from no cookie
    // being sent at all. Cookie *names* only — never log values, since
    // those are live session tokens.
    console.error("[notify-stage-change] auth check failed", {
      authErrorMessage: authError?.message,
      authErrorStatus: authError?.status,
      cookieNames: (await cookies()).getAll().map((c) => c.name),
    });
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: member } = await supabase
    .from("team_members")
    .select("id, org_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { data: submission } = await supabase
    .from("submissions")
    .select("id, agency, stage, is_test, clients(company_name, email)")
    .eq("id", submissionId)
    .maybeSingle();

  if (!submission) {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }

  // Test/rehearsal submissions never email a real inbox.
  if (submission.is_test) {
    return NextResponse.json({ sent: false, reason: "test_submission" });
  }

  const client = submission.clients as unknown as { company_name: string; email: string } | null;
  if (!client?.email) {
    return NextResponse.json({ sent: false, reason: "no_client_email" });
  }

  const email = getStageChangeEmail(submission.stage, submission.agency, client.company_name);
  if (!email) {
    return NextResponse.json({ sent: false, reason: "no_template_for_stage" });
  }

  try {
    await sendEmail({ to: client.email, subject: email.subject, html: email.html });
  } catch (err) {
    // sendEmail normalizes casing before the actual send, but log the
    // pre-normalization value here too — a case mismatch between a client's
    // stored email and the Resend account's sandbox allow-list is exactly
    // what produced the "can only send to your own address" error before.
    console.error("[notify-stage-change] send failed for", JSON.stringify(client.email), {
      submissionId: submission.id,
      error: err instanceof Error ? err.message : err,
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Send failed." },
      { status: 502 }
    );
  }

  await supabase.from("audit_log").insert({
    submission_id: submission.id,
    org_id: member.org_id,
    actor_id: member.id,
    event_type: "stage_change_email_sent",
    event_detail: {
      stage: submission.stage,
      to: client.email,
      ...(requestedStage && requestedStage !== submission.stage ? { requestedStage } : {}),
    },
  });

  return NextResponse.json({ sent: true });
}
