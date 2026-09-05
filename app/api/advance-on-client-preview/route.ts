import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { getStageChangeEmail } from "@/lib/email/templates";

// Called by PacketButtons only when viewerRole === "client" — PacketButtons
// is shared with the admin submission detail page, so an admin previewing
// the same submission for QA never calls this route at all (that's the
// actual "check the viewing context/role" requirement: it's enforced by
// which caller invokes this endpoint, not a flag this route has to trust).
// Ownership is re-verified server-side against the caller's own session
// regardless, rather than trusting that PacketButtons only ever passes a
// submission the signed-in client actually owns.
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

  const { data: client } = await supabase
    .from("clients")
    .select("id, org_id, company_name, email")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!client) {
    return NextResponse.json({ error: "Client access required." }, { status: 403 });
  }

  const { data: submission } = await supabase
    .from("submissions")
    .select("id, agency, stage, is_test, client_id")
    .eq("id", submissionId)
    .maybeSingle();

  if (!submission || submission.client_id !== client.id) {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }

  if (submission.stage !== "deliverables_ready") {
    return NextResponse.json({ advanced: false, reason: "wrong_stage" });
  }

  // The ownership + stage checks above already ran under the caller's own
  // RLS-scoped session, which is what actually authorizes this write — but
  // performing the write itself through that same session silently no-ops:
  // "clients update their own draft submissions" only permits UPDATE while
  // draft = true, and a deliverables_ready submission is always non-draft.
  // Confirmed directly (real client session, real PGRST-level test): the
  // request returns 200 with zero rows affected, no error at all, so this
  // failed completely silently in production with nothing to show for it.
  // Same fix as generate-fit-check/route.ts's identical draft=false
  // constraint — use the service role for the already-validated write.
  const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { error: updateError } = await service
    .from("submissions")
    .update({ stage: "client_review", updated_at: new Date().toISOString() })
    .eq("id", submissionId);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await supabase.from("audit_log").insert({
    submission_id: submission.id,
    org_id: client.org_id,
    event_type: "stage_auto_advanced",
    event_detail: { from: "deliverables_ready", to: "client_review", trigger: "client_preview" },
  });

  if (submission.is_test) {
    return NextResponse.json({ advanced: true, sent: false, reason: "test_submission" });
  }

  const email = getStageChangeEmail("client_review", submission.agency, client.company_name);
  if (!email || !client.email) {
    return NextResponse.json({ advanced: true, sent: false, reason: "no_template_or_email" });
  }

  try {
    await sendEmail({ to: client.email, subject: email.subject, html: email.html });
    await supabase.from("audit_log").insert({
      submission_id: submission.id,
      org_id: client.org_id,
      event_type: "stage_change_email_sent",
      event_detail: { stage: "client_review", auto: true },
    });
  } catch (err) {
    console.error("[advance-on-client-preview] send failed", err);
    return NextResponse.json({ advanced: true, sent: false, reason: "send_failed" });
  }

  return NextResponse.json({ advanced: true, sent: true });
}
