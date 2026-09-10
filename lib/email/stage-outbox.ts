import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { getStageChangeEmail } from "@/lib/email/templates";
import { EmailSendError, sendEmail } from "@/lib/email/send";

type OutboxStatus = "pending" | "processing" | "sent" | "skipped" | "failed";

type OutboxRow = {
  id: string;
  submission_id: string;
  org_id: string;
  actor_id: string | null;
  stage: string;
  transition_trigger: string;
  recipient_email: string | null;
  client_company_name: string | null;
  agency: string;
  email_subject: string | null;
  email_html: string | null;
  status: OutboxStatus;
  skip_reason: string | null;
  attempts: number;
};

export type OutboxDeliveryResult = {
  claimed: number;
  sent: number;
  skipped: number;
  queuedForRetry: number;
  failed: number;
  status?: OutboxStatus;
  reason?: string | null;
};

export async function processStageEmailOutbox({
  outboxId,
  limit = 10,
}: {
  outboxId?: string;
  limit?: number;
} = {}): Promise<OutboxDeliveryResult> {
  const service = createServiceClient();
  const lockToken = crypto.randomUUID();
  const { data, error } = await service.rpc("claim_stage_email_outbox", {
    p_lock_token: lockToken,
    p_limit: limit,
    p_outbox_id: outboxId ?? null,
  });

  if (error) {
    throw new Error(`Could not claim stage email outbox rows: ${error.message}`);
  }

  const rows = (data ?? []) as OutboxRow[];
  const result: OutboxDeliveryResult = {
    claimed: rows.length,
    sent: 0,
    skipped: 0,
    queuedForRetry: 0,
    failed: 0,
  };

  for (const row of rows) {
    const renderedEmail =
      row.email_subject && row.email_html
        ? { subject: row.email_subject, html: row.email_html }
        : getStageChangeEmail(
            row.stage,
            row.agency,
            row.client_company_name ?? "Client"
          );

    if (!renderedEmail || !row.recipient_email) {
      const reason = !row.recipient_email
        ? "no_client_email"
        : "no_template_for_stage";
      const { data: skippedRows, error: skipError } = await service
        .from("stage_email_outbox")
        .update({
          status: "skipped",
          skip_reason: reason,
          locked_at: null,
          lock_token: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("lock_token", lockToken)
        .eq("status", "processing")
        .select("id");

      if (skipError || !skippedRows?.length) {
        console.error("[stage-email-outbox] could not mark skipped", {
          outboxId: row.id,
          error: skipError?.message ?? "The outbox lease was lost.",
        });
        result.failed += 1;
      } else {
        result.skipped += 1;
        if (row.id === outboxId) {
          result.status = "skipped";
          result.reason = reason;
        }
      }
      continue;
    }

    let email = renderedEmail;
    if (!row.email_subject || !row.email_html) {
      const { data: snapshotted, error: snapshotError } = await service
        .from("stage_email_outbox")
        .update({
          email_subject: renderedEmail.subject,
          email_html: renderedEmail.html,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("lock_token", lockToken)
        .eq("status", "processing")
        .select("email_subject, email_html")
        .maybeSingle();

      if (snapshotError || !snapshotted?.email_subject || !snapshotted.email_html) {
        const snapshotMessage =
          snapshotError?.message ?? "The outbox lease was lost.";
        console.error("[stage-email-outbox] could not snapshot email payload", {
          outboxId: row.id,
          error: snapshotMessage,
        });
        const { data: nextStatus, error: failError } = await service.rpc(
          "fail_stage_email_outbox",
          {
            p_outbox_id: row.id,
            p_lock_token: lockToken,
            p_error: `Could not snapshot email payload: ${snapshotMessage}`,
            p_terminal: false,
          }
        );
        if (failError || nextStatus === "failed") {
          result.failed += 1;
        } else {
          result.queuedForRetry += 1;
        }
        if (row.id === outboxId) {
          result.status = nextStatus === "failed" ? "failed" : "pending";
          result.reason =
            nextStatus === "failed" ? "delivery_failed" : "queued_for_retry";
        }
        continue;
      }
      email = {
        subject: snapshotted.email_subject,
        html: snapshotted.email_html,
      };
    }

    try {
      const providerResult = (await sendEmail({
        to: row.recipient_email,
        subject: email.subject,
        html: email.html,
        idempotencyKey: `stage-change/${row.id}`,
      })) as { id?: string };

      const { data: completed, error: completeError } = await service.rpc(
        "complete_stage_email_outbox",
        {
          p_outbox_id: row.id,
          p_lock_token: lockToken,
          p_provider_message_id: providerResult?.id ?? null,
        }
      );
      if (completeError || !completed) {
        // Resend accepted this message. Never make it retryable merely because
        // the database acknowledgement failed; that could duplicate delivery
        // after Resend's idempotency-retention window.
        const completionMessage =
          completeError?.message ?? "The outbox lease was lost before completion.";
        const { error: terminalError } = await service.rpc(
          "fail_stage_email_outbox",
          {
            p_outbox_id: row.id,
            p_lock_token: lockToken,
            p_error: `Email accepted by provider (${providerResult?.id ?? "unknown id"}), but completion failed: ${completionMessage}`,
            p_terminal: true,
          }
        );
        if (terminalError) {
          console.error("[stage-email-outbox] could not record completion failure", {
            outboxId: row.id,
            error: terminalError.message,
          });
        }
        result.failed += 1;
        if (row.id === outboxId) {
          result.status = "failed";
          result.reason = "delivery_status_unconfirmed";
        }
        continue;
      }

      result.sent += 1;
      if (row.id === outboxId) result.status = "sent";
    } catch (sendError) {
      const message =
        sendError instanceof Error ? sendError.message : "Unknown email delivery error";
      const retryable =
        sendError instanceof EmailSendError && sendError.retryable;
      const { data: nextStatus, error: failError } = await service.rpc(
        "fail_stage_email_outbox",
        {
          p_outbox_id: row.id,
          p_lock_token: lockToken,
          p_error: message,
          p_terminal: !retryable,
        }
      );

      if (failError) {
        console.error("[stage-email-outbox] could not record failure", {
          outboxId: row.id,
          error: failError.message,
        });
        result.failed += 1;
      } else if (nextStatus === "failed") {
        result.failed += 1;
      } else {
        result.queuedForRetry += 1;
      }

      if (row.id === outboxId) {
        result.status = nextStatus === "failed" ? "failed" : "pending";
        result.reason =
          nextStatus === "failed" ? "delivery_failed" : "queued_for_retry";
      }
    }
  }

  if (outboxId && rows.length === 0) {
    const { data: existing, error: existingError } = await service
      .from("stage_email_outbox")
      .select("status, skip_reason")
      .eq("id", outboxId)
      .maybeSingle();
    if (existingError) {
      throw new Error(`Could not read stage email status: ${existingError.message}`);
    }
    if (existing) {
      result.status = existing.status as OutboxStatus;
      result.reason = existing.skip_reason;
    }
  }

  return result;
}
