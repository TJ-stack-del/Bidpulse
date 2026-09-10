import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  transitionSubmissionStage,
  type SubmissionStage,
} from "@/lib/submissions/transition-stage";

const STAGES = [
  "submitted",
  "in_review",
  "deliverables_ready",
  "client_review",
  "closed",
] as const;

type Stage = (typeof STAGES)[number];
type Trigger = "manual" | "admin_first_view";

function isStage(value: unknown): value is Stage {
  return typeof value === "string" && STAGES.includes(value as Stage);
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: submissionId } = await params;
  const body = await request.json().catch(() => null);
  const trigger = body?.trigger as Trigger | undefined;
  const idempotencyKey = isUuid(body?.requestId)
    ? body.requestId
    : crypto.randomUUID();

  if (
    !isStage(body?.expectedStage) ||
    !isStage(body?.newStage) ||
    (trigger !== "manual" && trigger !== "admin_first_view")
  ) {
    return NextResponse.json({ error: "Invalid stage transition." }, { status: 400 });
  }

  const expectedStage: SubmissionStage =
    trigger === "admin_first_view" ? "submitted" : body.expectedStage;
  const newStage: SubmissionStage =
    trigger === "admin_first_view" ? "in_review" : body.newStage;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: member, error: memberError } = await supabase
    .from("team_members")
    .select("id, org_id")
    .eq("auth_user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (memberError) {
    console.error("[transition-stage] membership lookup failed", memberError);
    return NextResponse.json({ error: "Couldn't verify admin access." }, { status: 500 });
  }
  if (!member) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  // This read runs through the caller's RLS-scoped session. It prevents the
  // service-role RPC below from being used to reach another organization.
  const { data: visibleSubmission, error: submissionError } = await supabase
    .from("submissions")
    .select("id, draft")
    .eq("id", submissionId)
    .maybeSingle();
  if (submissionError) {
    console.error("[transition-stage] submission lookup failed", submissionError);
    return NextResponse.json({ error: "Couldn't load the submission." }, { status: 500 });
  }
  if (!visibleSubmission) {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }
  if (trigger === "admin_first_view" && visibleSubmission.draft) {
    return NextResponse.json({
      applied: false,
      currentStage: "submitted",
      sent: false,
      reason: "draft_submission",
    });
  }

  let transitionResult;
  try {
    transitionResult = await transitionSubmissionStage({
      submissionId,
      expectedStage,
      newStage,
      actorId: member.id,
      eventType:
        trigger === "admin_first_view"
          ? "stage_auto_advanced"
          : "stage_change",
      trigger,
      markFirstViewed: trigger === "admin_first_view",
      idempotencyKey,
    });
  } catch (error) {
    console.error("[transition-stage] transaction or delivery failed", error);
    return NextResponse.json({ error: "Couldn't save the stage change." }, { status: 500 });
  }

  const { transition, delivery } = transitionResult;
  if (transition.outcome === "not_found") {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }
  if (transition.outcome === "ineligible") {
    return NextResponse.json({
      applied: false,
      currentStage: transition.current_stage,
      sent: false,
      reason: "draft_submission",
    });
  }
  if (transition.outcome === "conflict") {
    return NextResponse.json(
      {
        error: "The stage changed in another tab. The latest stage has been loaded.",
        currentStage: transition.current_stage,
      },
      { status: 409 }
    );
  }

  const status = delivery?.status ?? transition.notification_status;
  const reason =
    delivery?.reason ??
    transition.notification_skip_reason ??
    (status === "sent"
      ? undefined
      : transition.outcome === "unchanged"
        ? "unchanged"
        : "queued_for_retry");

  return NextResponse.json({
    applied: transition.outcome === "applied",
    currentStage: transition.current_stage,
    sent: status === "sent",
    ...((status !== "sent" || reason) ? { reason } : {}),
  });
}
