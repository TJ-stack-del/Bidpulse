import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { transitionSubmissionStage } from "@/lib/submissions/transition-stage";

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
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!client) {
    return NextResponse.json({ error: "Client access required." }, { status: 403 });
  }

  const { data: submission } = await supabase
    .from("submissions")
    .select("id, stage, client_id")
    .eq("id", submissionId)
    .maybeSingle();

  if (!submission || submission.client_id !== client.id) {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }

  if (
    submission.stage !== "deliverables_ready" &&
    submission.stage !== "client_review"
  ) {
    return NextResponse.json({ advanced: false, reason: "wrong_stage" });
  }

  try {
    const { transition, delivery } = await transitionSubmissionStage({
      submissionId,
      expectedStage: "deliverables_ready",
      newStage: "client_review",
      actorId: null,
      clientId: client.id,
      eventType: "stage_auto_advanced",
      trigger: "client_preview",
    });

    if (
      transition.outcome === "conflict" ||
      transition.outcome === "not_found" ||
      transition.outcome === "ineligible"
    ) {
      return NextResponse.json({
        advanced: false,
        reason: transition.outcome,
        currentStage: transition.current_stage,
      });
    }

    const status = delivery?.status ?? transition.notification_status;
    return NextResponse.json({
      advanced: transition.current_stage === "client_review",
      sent: status === "sent",
      reason:
        delivery?.reason ??
        transition.notification_skip_reason ??
        (status === "sent" ? undefined : "queued_for_retry"),
    });
  } catch (error) {
    console.error("[advance-on-client-preview] transition failed", error);
    return NextResponse.json(
      { error: "Couldn't advance the submission." },
      { status: 500 }
    );
  }
}
