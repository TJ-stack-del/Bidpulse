import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { getNewMessageEmail } from "@/lib/email/templates";

// Called by SubmissionMessages right after an ADMIN sends a message —
// mirrors notify-stage-change's own pattern (looks up the submission from
// the DB itself rather than trusting anything in the request body beyond
// the id). One-directional by design: a client's own message never calls
// this route at all, since admin already has the daily digest and checks
// the inbox regularly.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const submissionId = body?.submissionId;
  if (typeof submissionId !== "string") {
    return NextResponse.json({ error: "Invalid submissionId." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
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
    .select("id, agency, is_test, clients!submissions_client_id_fkey(company_name, email)")
    .eq("id", submissionId)
    .maybeSingle();

  if (!submission) {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }

  if (submission.is_test) {
    return NextResponse.json({ sent: false, reason: "test_submission" });
  }

  const client = submission.clients as unknown as { company_name: string; email: string } | null;
  if (!client?.email) {
    return NextResponse.json({ sent: false, reason: "no_client_email" });
  }

  const email = getNewMessageEmail(submission.agency, client.company_name);

  try {
    await sendEmail({ to: client.email, subject: email.subject, html: email.html });
  } catch (err) {
    console.error("[notify-new-message] send failed", {
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
    event_type: "message_email_sent",
    event_detail: { to: client.email },
  });

  return NextResponse.json({ sent: true });
}
