import "server-only";

import { processStageEmailOutbox } from "@/lib/email/stage-outbox";
import { createServiceClient } from "@/lib/supabase/service";

export type SubmissionStage =
  | "submitted"
  | "in_review"
  | "deliverables_ready"
  | "client_review"
  | "closed";

export type TransitionOutcome =
  | "applied"
  | "replayed"
  | "unchanged"
  | "conflict"
  | "ineligible"
  | "not_found";

export type TransitionResult = {
  outcome: TransitionOutcome;
  current_stage: SubmissionStage | null;
  notification_id: string | null;
  notification_status: string | null;
  notification_skip_reason: string | null;
};

export async function transitionSubmissionStage({
  submissionId,
  expectedStage,
  newStage,
  actorId,
  clientId = null,
  eventType,
  trigger,
  markFirstViewed = false,
  requireCompleteDeliverables = false,
  idempotencyKey = crypto.randomUUID(),
}: {
  submissionId: string;
  expectedStage: SubmissionStage;
  newStage: SubmissionStage;
  actorId: string | null;
  clientId?: string | null;
  eventType: "stage_change" | "stage_auto_advanced";
  trigger: string;
  markFirstViewed?: boolean;
  requireCompleteDeliverables?: boolean;
  idempotencyKey?: string;
}) {
  const service = createServiceClient();
  const { data, error } = await service.rpc(
    "transition_submission_stage_with_outbox",
    {
      p_submission_id: submissionId,
      p_expected_stage: expectedStage,
      p_new_stage: newStage,
      p_actor_id: actorId,
      p_client_id: clientId,
      p_event_type: eventType,
      p_event_detail: { trigger },
      p_mark_first_viewed: markFirstViewed,
      p_require_complete_deliverables: requireCompleteDeliverables,
      p_idempotency_key: idempotencyKey,
    }
  );

  if (error) {
    throw new Error(`Could not transition submission stage: ${error.message}`);
  }

  const transition = (data?.[0] ?? null) as TransitionResult | null;
  if (!transition) {
    throw new Error("Stage transition returned no result.");
  }

  let delivery = null;
  if (transition.notification_id) {
    try {
      delivery = await processStageEmailOutbox({
        outboxId: transition.notification_id,
      });
    } catch (error) {
      // The transition and outbox row are already committed. A delivery-system
      // outage must not make callers retry or report the stage change as failed;
      // the scheduled worker can safely recover the pending/leased row.
      console.error(
        "[transition-submission-stage] immediate email delivery failed",
        error
      );
      delivery = {
        claimed: 0,
        sent: 0,
        skipped: 0,
        queuedForRetry: 1,
        failed: 0,
        status: "pending",
        reason: "queued_for_retry",
      };
    }
  }

  return { transition, delivery };
}
