import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { getStageChangeEmail } from "@/lib/email/templates";

const STAGES = [
  "submitted",
  "in_review",
  "deliverables_ready",
  "client_review",
  "closed",
] as const;

type Stage = (typeof STAGES)[number];
type Trigger = "manual" | "admin_first_view";

type TransitionResult = {
  outcome: "applied" | "unchanged" | "conflict" | "ineligible" | "not_found";
  current_stage: Stage | null;
  agency: string | null;
  is_test: boolean | null;
  client_company_name: string | null;
  client_email: string | null;
  submission_org_id: string | null;
};

function isStage(value: unknown): value is Stage {
  return typeof value === "string" && STAGES.includes(value as Stage);
}

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: submissionId } = await params;
  const body = await request.json().catch(() => null);
  const trigger = body?.trigger as Trigger | undefined;

  if (
    !isStage(body?.expectedStage) ||
    !isStage(body?.newStage) ||
    (trigger !== "manual" && trigger !== "admin_first_view")
  ) {
    return NextResponse.json({ error: "Invalid stage transition." }, { status: 400 });
  }

  const expectedStage: Stage =
    trigger === "admin_first_view" ? "submitted" : body.expectedStage;
  const newStage: Stage =
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

  const service = serviceClient();
  const { data, error } = await service.rpc("transition_submission_stage", {
    p_submission_id: submissionId,
    p_expected_stage: expectedStage,
    p_new_stage: newStage,
    p_actor_id: member.id,
    p_event_type: trigger === "admin_first_view" ? "stage_auto_advanced" : "stage_change",
    p_event_detail: { trigger },
    p_mark_first_viewed: trigger === "admin_first_view",
  });

  if (error) {
    console.error("[transition-stage] transaction failed", error);
    return NextResponse.json({ error: "Couldn't save the stage change." }, { status: 500 });
  }

  const result = (data?.[0] ?? null) as TransitionResult | null;
  if (!result || result.outcome === "not_found") {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }
  if (result.outcome === "ineligible") {
    return NextResponse.json({
      applied: false,
      currentStage: result.current_stage,
      sent: false,
      reason: "draft_submission",
    });
  }
  if (result.outcome === "conflict") {
    return NextResponse.json(
      {
        error: "The stage changed in another tab. The latest stage has been loaded.",
        currentStage: result.current_stage,
      },
      { status: 409 }
    );
  }
  if (result.outcome === "unchanged") {
    return NextResponse.json({
      applied: false,
      currentStage: result.current_stage,
      sent: false,
      reason: "unchanged",
    });
  }

  if (result.is_test) {
    return NextResponse.json({
      applied: true,
      currentStage: result.current_stage,
      sent: false,
      reason: "test_submission",
    });
  }
  if (!result.client_email) {
    return NextResponse.json({
      applied: true,
      currentStage: result.current_stage,
      sent: false,
      reason: "no_client_email",
    });
  }

  const email = getStageChangeEmail(
    result.current_stage!,
    result.agency ?? "",
    result.client_company_name ?? "Client"
  );
  if (!email) {
    return NextResponse.json({
      applied: true,
      currentStage: result.current_stage,
      sent: false,
      reason: "no_template_for_stage",
    });
  }

  try {
    await sendEmail({
      to: result.client_email,
      subject: email.subject,
      html: email.html,
    });

    const { error: auditError } = await service.from("audit_log").insert({
      submission_id: submissionId,
      org_id: result.submission_org_id,
      actor_id: member.id,
      event_type: "stage_change_email_sent",
      event_detail: {
        stage: result.current_stage,
        auto: trigger !== "manual",
      },
    });
    if (auditError) {
      console.error("[transition-stage] email audit insert failed", auditError);
    }

    return NextResponse.json({
      applied: true,
      currentStage: result.current_stage,
      sent: true,
    });
  } catch (sendError) {
    console.error("[transition-stage] email send failed", sendError);
    return NextResponse.json({
      applied: true,
      currentStage: result.current_stage,
      sent: false,
      reason: "send_failed",
    });
  }
}
