import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { getInfoRequestEmail } from "@/lib/email/templates";

// Admin's "Request info from client" action — creates a real checklist_items
// row (so it's visibly tracked on both admin and client sides via existing
// RLS: clients read-only, admins manage) and emails the client, same shape
// as notify-stage-change/route.ts. Called from RequestInfoForm.tsx on the
// submission detail page.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const submissionId = body?.submissionId;
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (typeof submissionId !== "string" || !message) {
    return NextResponse.json({ error: "Invalid submissionId or message." }, { status: 400 });
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
    .select("id, agency, is_test, clients(company_name, email)")
    .eq("id", submissionId)
    .maybeSingle();

  if (!submission) {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }

  const { error: checklistError } = await supabase
    .from("checklist_items")
    .insert({ submission_id: submissionId, label: message });
  if (checklistError) {
    return NextResponse.json({ error: checklistError.message }, { status: 500 });
  }

  // Test/rehearsal submissions never email a real inbox — matches
  // notify-stage-change's existing convention.
  if (submission.is_test) {
    return NextResponse.json({ sent: false, reason: "test_submission" });
  }

  const client = submission.clients as unknown as { company_name: string; email: string } | null;
  if (!client?.email) {
    return NextResponse.json({ sent: false, reason: "no_client_email" });
  }

  const email = getInfoRequestEmail(message, submission.agency, client.company_name);

  try {
    await sendEmail({ to: client.email, subject: email.subject, html: email.html });
  } catch (err) {
    console.error("[request-info] send failed for", JSON.stringify(client.email), {
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
    event_type: "info_requested",
    event_detail: { message, to: client.email },
  });

  return NextResponse.json({ sent: true });
}
