import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";
import { DownloadAuditLogButton } from "./DownloadAuditLogButton";
import type { AuditLogRow } from "@/lib/audit/export";

// Converted from mockups-reference/submission_receipt_desktop/code.html
// (and _mobile). "Transmitted Artifacts" reads real deliverables instead
// of fabricated file sizes; the SHA-256 proof is read back from the
// audit_log 'submission' event written by /submit (submissions has no
// checksum column); "Transmission Log" is the bid's real audit_log
// timeline instead of 3 fabricated log lines ("Receipt Acknowledged",
// "Encryption Verified" — no gateway/encryption system exists here).
// "Download Full Audit Log" reuses the same lib/audit/export helpers as
// /admin/audit-log, scoped to this bid. "View Archive" (no archive concept
// in schema.sql) becomes "View Bid".

export default async function SubmitReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ bid?: string }>;
}) {
  const { bid: bidId } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("team_members")
    .select("id, org_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!member) {
    return (
      <AppShell activePath="/submit">
        <p className="text-body-md text-error mt-6">
          No team_members record found for this account — see README step 12.
        </p>
      </AppShell>
    );
  }

  if (!bidId) redirect("/submit");

  const { data: bid } = await supabase
    .from("bids")
    .select("id, title, agency, solicitation_number")
    .eq("id", bidId)
    .single();

  if (!bid) {
    return (
      <AppShell activePath="/submit">
        <p className="text-body-md text-error mt-6">Bid not found.</p>
      </AppShell>
    );
  }

  const { data: submission } = await supabase
    .from("submissions")
    .select("submission_method, confirmation_number, sealed_document_url, submitted_at")
    .eq("bid_id", bidId)
    .maybeSingle();

  if (!submission) redirect(`/submit?bid=${bidId}`);

  const [{ data: deliverables }, { data: rawLogs }] = await Promise.all([
    supabase.from("deliverables").select("id, title, artifact_type, version").eq("bid_id", bidId),
    supabase
      .from("audit_log")
      .select("id, bid_id, event_type, event_detail, created_at, actor_id, team_members(full_name)")
      .eq("bid_id", bidId)
      .order("created_at", { ascending: false }),
  ]);

  const logs: AuditLogRow[] = (rawLogs ?? []).map((row: any) => ({
    id: row.id,
    bid_id: row.bid_id,
    event_type: row.event_type,
    event_detail: row.event_detail,
    created_at: row.created_at,
    actor_name: row.team_members?.full_name ?? null,
  }));

  const submissionEvent = logs.find((l) => l.event_type === "submission");
  const checksum = (submissionEvent?.event_detail as { checksum?: string } | null)?.checksum;

  return (
    <AppShell activePath="/submit">
      <div className="bg-[#E6F4EA] border border-on-tertiary-container/30 rounded-lg p-6 flex gap-4 items-start mt-6 relative overflow-hidden">
        <span className="material-symbols-outlined text-on-tertiary-container text-[32px]">check_circle</span>
        <div>
          <h1 className="text-headline-md text-on-surface mb-1">Submission Successfully Executed</h1>
          <p className="text-body-md text-on-surface-variant">
            {bid.title} was submitted and recorded in the audit log.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <div className="md:col-span-2 flex flex-col gap-6">
          <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6">
            <h2 className="text-title-lg text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-on-surface-variant">description</span>
              Submission Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
              <Field label="Project Name" value={bid.title} />
              <Field label="Solicitation #" value={bid.solicitation_number ?? "—"} />
              <Field label="Agency" value={bid.agency} />
              <Field label="Method" value={submission.submission_method ?? "—"} />
              <Field label="Confirmation #" value={submission.confirmation_number ?? "—"} />
              <Field label="Timestamp" value={new Date(submission.submitted_at).toLocaleString()} mono />
            </div>
            {checksum && (
              <div className="mt-6 pt-6 border-t border-outline-variant">
                <p className="text-label-md text-on-surface-variant mb-2 uppercase tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">enhanced_encryption</span>
                  Cryptographic Proof (SHA-256)
                </p>
                <div className="bg-surface-container-low p-3 border border-outline-variant">
                  <code className="font-code text-code-sm text-on-surface break-all">{checksum}</code>
                </div>
                <p className="text-label-md text-on-surface-variant mt-2 opacity-70">
                  Store this hash for legal non-repudiation.
                </p>
              </div>
            )}
          </section>

          <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6">
            <h2 className="text-title-lg text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-on-surface-variant">inventory_2</span>
              Transmitted Artifacts
            </h2>
            <div className="flex flex-col gap-2">
              {(deliverables ?? []).map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between p-3 bg-surface border border-outline-variant"
                >
                  <div>
                    <p className="text-body-md font-medium text-on-surface">{d.title}</p>
                    <p className="text-code-sm text-on-surface-variant">
                      {d.artifact_type.replace("_", " ")} · v{d.version}
                    </p>
                  </div>
                  <span className="bg-[#E6F4EA] text-on-tertiary-container text-label-md px-2 py-1 rounded border border-on-tertiary-container/30 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">lock</span>
                    Sealed
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6">
            <h2 className="text-title-lg text-on-surface mb-4">Next Steps</h2>
            <div className="flex flex-col gap-3">
              <DownloadAuditLogButton logs={logs} bidId={bid.id} />
              <Link
                href={`/intake?bid=${bid.id}`}
                className="w-full bg-surface-container-highest text-on-surface text-label-md py-3 px-4 flex items-center justify-center gap-2 hover:bg-surface-variant transition-colors border border-outline-variant rounded"
              >
                <span className="material-symbols-outlined text-[18px]">description</span>
                View Bid
              </Link>
              <Link
                href="/dashboard"
                className="w-full mt-2 bg-transparent text-secondary text-label-md py-3 px-4 flex items-center justify-center gap-2 hover:bg-surface-container-low transition-colors border border-secondary rounded"
              >
                Go to Dashboard
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </Link>
            </div>
          </section>

          <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 flex-grow">
            <h2 className="text-title-lg text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-on-surface-variant">history</span>
              Transmission Log
            </h2>
            <div className="relative pl-4 border-l-2 border-outline-variant flex flex-col gap-6">
              {logs.map((log) => (
                <div key={log.id} className="relative">
                  <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-on-tertiary-container ring-4 ring-surface-container-lowest" />
                  <p className="text-label-md text-on-surface font-medium">{log.event_type.replace("_", " ")}</p>
                  <p className="text-code-sm text-on-surface-variant">{log.actor_name ?? "System"}</p>
                  <p className="text-code-sm text-on-surface-variant opacity-70">
                    {new Date(log.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-label-md text-on-surface-variant mb-1 uppercase tracking-wider">{label}</p>
      <p className={`text-body-lg font-medium text-on-surface ${mono ? "font-code text-code-sm" : ""}`}>{value}</p>
    </div>
  );
}
