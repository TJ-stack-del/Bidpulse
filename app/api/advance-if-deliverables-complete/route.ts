import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { getStageChangeEmail } from "@/lib/email/templates";

// Called by DeliverablesPanel right after every deliverable save (text or
// file) — checks a fact the system can verify directly (all three full
// deliverables have real content or a file) rather than requiring an admin
// to remember to click "Move to stage" once they're done. Re-verifies
// against the DB itself rather than trusting whatever the client component
// believes just got saved, same reasoning as notify-stage-change looking up
// the current stage itself instead of trusting the request body.
const REQUIRED_TYPES = ["capability_statement", "compliance_matrix", "technical_narrative"];

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
    .select("id, agency, stage, is_test, clients(company_name, email)")
    .eq("id", submissionId)
    .maybeSingle();
  if (!submission) {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }

  if (submission.stage !== "in_review") {
    return NextResponse.json({ advanced: false, reason: "wrong_stage" });
  }

  const { data: deliverables } = await supabase
    .from("deliverables")
    .select("deliverable_type, content, file_url")
    .eq("submission_id", submissionId);

  const complete = REQUIRED_TYPES.every((type) => {
    const d = (deliverables ?? []).find((x) => x.deliverable_type === type);
    return !!d && (!!d.file_url || !!d.content?.trim());
  });

  if (!complete) {
    return NextResponse.json({ advanced: false, reason: "incomplete" });
  }

  const { error: updateError } = await supabase
    .from("submissions")
    .update({ stage: "deliverables_ready", updated_at: new Date().toISOString() })
    .eq("id", submissionId);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await supabase.from("audit_log").insert({
    submission_id: submission.id,
    org_id: member.org_id,
    actor_id: member.id,
    event_type: "stage_auto_advanced",
    event_detail: { from: "in_review", to: "deliverables_ready", trigger: "deliverables_complete" },
  });

  if (submission.is_test) {
    return NextResponse.json({ advanced: true, sent: false, reason: "test_submission" });
  }

  const client = submission.clients as unknown as { company_name: string; email: string } | null;
  if (!client?.email) {
    return NextResponse.json({ advanced: true, sent: false, reason: "no_client_email" });
  }

  const email = getStageChangeEmail("deliverables_ready", submission.agency, client.company_name);
  if (!email) {
    return NextResponse.json({ advanced: true, sent: false, reason: "no_template_for_stage" });
  }

  try {
    await sendEmail({ to: client.email, subject: email.subject, html: email.html });
    await supabase.from("audit_log").insert({
      submission_id: submission.id,
      org_id: member.org_id,
      actor_id: member.id,
      event_type: "stage_change_email_sent",
      event_detail: { stage: "deliverables_ready", auto: true },
    });
  } catch (err) {
    console.error("[advance-if-deliverables-complete] send failed", err);
    return NextResponse.json({ advanced: true, sent: false, reason: "send_failed" });
  }

  return NextResponse.json({ advanced: true, sent: true });
}
