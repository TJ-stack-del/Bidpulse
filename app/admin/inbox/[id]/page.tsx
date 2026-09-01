import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";
import { AdminSubmissionActions } from "./AdminSubmissionActions";
import { DeliverablesPanel } from "./DeliverablesPanel";
import { PaymentStatus } from "./PaymentStatus";
import { ClientCertifications } from "./ClientCertifications";
import { signRfpDocumentUrls } from "@/lib/storage";
import { EstimatedValueInput } from "./EstimatedValueInput";
import { isKnownTrade } from "@/lib/compliance/known-trades";

// The actual review workspace: full intake info, stage editing, internal
// notes, checklist, deliverables. This is where the "admin does the real
// work" part of the done-for-you model happens.

export default async function AdminSubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // org_id/actor_id are needed for correct audit_log writes below (see
  // AdminSubmissionActions/DeliverablesPanel) — RLS only lets this resolve
  // for an actual admin's own org, same as the rest of /admin/inbox.
  const { data: member } = await supabase
    .from("team_members")
    .select("id, org_id, full_name")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!member) redirect("/");

  const { data: submission } = await supabase
    .from("submissions")
    .select(
      "*, clients(company_name, contact_name, email, phone, naics_codes, license_number, years_in_business, business_address, business_phone, insurance_provider, insurance_policy_number, general_liability_coverage, workers_comp_coverage, differentiators)"
    )
    .eq("id", id)
    .single();

  if (!submission) {
    return (
      <AppShell activePath="/admin/inbox" role="admin" viewerName={member.full_name}>
        <p className="text-body-md text-error mt-6">Submission not found.</p>
      </AppShell>
    );
  }

  const { data: notes } = await supabase
    .from("admin_notes")
    .select("id, note, created_at")
    .eq("submission_id", id)
    .order("created_at", { ascending: false });

  const { data: checklist } = await supabase
    .from("checklist_items")
    .select("id, label, status, notes")
    .eq("submission_id", id);

  const { data: deliverablesRaw } = await supabase
    .from("deliverables")
    .select("id, deliverable_type, file_url, content, created_at")
    .eq("submission_id", id);
  const deliverables = await signRfpDocumentUrls(supabase, deliverablesRaw ?? []);

  const { data: certificationsRaw } = await supabase
    .from("client_certifications")
    .select("id, cert_type, other_label, certification_number, expiration_date, file_url, file_name, verified")
    .eq("client_id", submission.client_id)
    .order("created_at", { ascending: false });
  const certifications = await signRfpDocumentUrls(supabase, certificationsRaw ?? []);

  const { data: pkg } = submission.package_id
    ? await supabase
        .from("packages")
        .select("id, package_type, price_note, paid, paid_at")
        .eq("id", submission.package_id)
        .maybeSingle()
    : { data: null };

  // Packages are 1:many with submissions (no unique constraint ties a
  // package to one submission, and packages has no submission_id column at
  // all) — a retainer can cover several bids for the same client, so the
  // Payment card offers reusing one of these instead of always creating new.
  const { data: clientPackages } = await supabase
    .from("packages")
    .select("id, package_type, price_note, paid, paid_at, created_at")
    .eq("client_id", submission.client_id)
    .order("created_at", { ascending: false });

  const { data: org } = await supabase
    .from("organizations")
    .select("lean_package_threshold")
    .eq("id", member.org_id)
    .single();

  const { data: auditLog } = await supabase
    .from("audit_log")
    .select("id, event_type, event_detail, created_at, team_members(full_name)")
    .eq("submission_id", id)
    .order("created_at", { ascending: false });

  const client = submission.clients as any;

  // Safety net: is this bid's trade one BidPulse has real compliance
  // coverage for at all (lib/compliance/known-trades.ts)? If not, the
  // compliance matrix can look complete without being complete — flag it
  // here with the same visual weight as the mandatory-site-visit warning
  // below, not just in the deliverable content itself.
  const tradeKnown = isKnownTrade({ naicsCodes: client?.naics_codes ?? [], scopeText: submission.scope ?? "" });

  const STAGE_LABELS: Record<string, string> = {
    submitted: "Submitted",
    in_review: "In review",
    deliverables_ready: "Deliverables ready",
    client_review: "Client review",
    confirmed_submitted: "Confirmed submitted",
    closed: "Closed",
  };

  // Same labels/framing as the client's own confirmation screen — a
  // readiness read for our own prep process, never a chance-of-winning claim.
  const FIT_LABELS: Record<string, string> = {
    strong: "Strong fit",
    moderate: "Moderate fit",
    weak: "Worth a second look",
  };
  const FIT_STYLE: Record<string, string> = {
    strong: "bg-secondary-container text-on-secondary-container",
    moderate: "bg-surface-container-highest text-on-surface-variant",
    weak: "bg-surface-container-highest text-on-surface-variant",
  };

  const AUDIT_EVENT_LABELS: Record<string, string> = {
    stage_change: "Stage changed",
    deliverable_prepared: "Deliverable prepared",
    confirmation_email_sent: "Confirmation email sent",
    submission_locked: "Submitted by client",
    submission_created_from_match: "Created from matched opportunity",
    payment_marked_paid: "Marked as paid",
    payment_marked_unpaid: "Marked as unpaid",
    package_linked: "Package linked",
    stage_change_email_sent: "Client notified by email",
    client_reported_submitted: "Client reported submitted",
    client_viewed_packet: "Client viewed packet",
    client_downloaded_packet: "Client downloaded packet",
    certification_verified: "Certification verified",
    certification_unverified: "Certification marked unverified",
  };

  // Most recent of either type — a download implies a view, so either one
  // answers "has the client actually looked at this." auditLog is already
  // ordered created_at desc, so the first match is the most recent.
  const lastPacketView =
    (auditLog ?? []).find(
      (e) => e.event_type === "client_viewed_packet" || e.event_type === "client_downloaded_packet"
    ) ?? null;

  return (
    <AppShell activePath="/admin/inbox" role="admin" viewerName={member.full_name}>
      {!tradeKnown && (
        <div className="mt-6 bg-error-container/20 border border-error/30 rounded-xl p-4 flex gap-3">
          <span className="material-symbols-outlined text-error text-[20px] shrink-0">warning</span>
          <div>
            <p className="text-label-md text-error font-bold uppercase tracking-wide mb-1">
              No trade-specific compliance rules on file for this industry
            </p>
            <p className="text-body-md text-on-surface">
              Verify requirements manually before relying on this checklist.
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-label-md text-on-surface-variant uppercase tracking-wider mb-1">
            {client?.company_name}
          </p>
          <h1 className="text-headline-lg text-primary">{submission.agency}</h1>
        </div>
        <span className="inline-flex px-3 py-1 rounded-full text-label-md font-medium bg-secondary-container text-on-secondary-container">
          {STAGE_LABELS[submission.stage] ?? submission.stage}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
            <h2 className="text-title-lg text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[20px]">info</span>
              Bid details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-body-md">
              <div>
                <span className="text-label-md text-on-surface-variant block">Solicitation #</span>
                {submission.solicitation_number ?? "—"}
              </div>
              <div>
                <span className="text-label-md text-on-surface-variant block">Due date</span>
                {submission.due_date ? new Date(submission.due_date).toLocaleDateString() : "—"}
              </div>
              <div>
                <EstimatedValueInput submissionId={submission.id} initialValue={submission.estimated_value} />
              </div>
              <div className="col-span-2">
                <span className="text-label-md text-on-surface-variant block">Scope</span>
                {submission.scope ?? "—"}
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
            <h2 className="text-title-lg text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[20px]">person</span>
              Client info
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-body-md">
              <div>
                <span className="text-label-md text-on-surface-variant block">Contact</span>
                {client?.contact_name}
              </div>
              <div>
                <span className="text-label-md text-on-surface-variant block">Email</span>
                {client?.email}
              </div>
              <div>
                <span className="text-label-md text-on-surface-variant block">Phone</span>
                {client?.phone ?? "—"}
              </div>
              <div>
                <span className="text-label-md text-on-surface-variant block">NAICS codes</span>
                {(client?.naics_codes ?? []).join(", ") || "—"}
              </div>
              <div>
                <span className="text-label-md text-on-surface-variant block">License #</span>
                {client?.license_number ?? "—"}
              </div>
              <div>
                <span className="text-label-md text-on-surface-variant block">Years in business</span>
                {client?.years_in_business ?? "—"}
              </div>
              <div>
                <span className="text-label-md text-on-surface-variant block">Business address</span>
                {client?.business_address ?? "—"}
              </div>
              <div>
                <span className="text-label-md text-on-surface-variant block">Business phone</span>
                {client?.business_phone ?? "—"}
              </div>
              <div>
                <span className="text-label-md text-on-surface-variant block">Insurance</span>
                {client?.insurance_provider
                  ? `${client.insurance_provider}${client.insurance_policy_number ? ` (#${client.insurance_policy_number})` : ""}`
                  : "—"}
              </div>
              <div>
                <span className="text-label-md text-on-surface-variant block">GL / Workers' Comp</span>
                {[client?.general_liability_coverage, client?.workers_comp_coverage].filter(Boolean).join(" | ") || "—"}
              </div>
              <div className="col-span-2">
                <span className="text-label-md text-on-surface-variant block">Differentiators</span>
                {client?.differentiators ?? "—"}
              </div>
            </div>

            <h3 className="text-label-md text-on-surface-variant uppercase tracking-wider mt-6 mb-2">
              Certifications
            </h3>
            <ClientCertifications
              orgId={member.org_id}
              actorId={member.id}
              certifications={certifications}
            />
          </div>

          <AdminSubmissionActions
            submissionId={submission.id}
            orgId={member.org_id}
            actorId={member.id}
            currentStage={submission.stage}
            checklist={checklist ?? []}
            notes={notes ?? []}
            clientReportedSubmittedAt={submission.client_reported_submitted_at}
          />

          <PaymentStatus
            submissionId={submission.id}
            orgId={member.org_id}
            actorId={member.id}
            clientId={submission.client_id}
            packageId={pkg?.id ?? null}
            packageType={pkg?.package_type ?? null}
            packagePriceNote={pkg?.price_note ?? null}
            initialPaid={pkg?.paid ?? false}
            initialPaidAt={pkg?.paid_at ?? null}
            existingPackages={(clientPackages ?? []).filter((p) => p.id !== pkg?.id)}
          />

          <DeliverablesPanel
            submissionId={submission.id}
            orgId={member.org_id}
            actorId={member.id}
            initialDeliverables={deliverables}
            lastPacketView={lastPacketView}
            estimatedValue={submission.estimated_value}
            leanPackageThreshold={org?.lean_package_threshold ?? 35000}
          />
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
            <h3 className="text-title-lg text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[20px]">admin_panel_settings</span>
              Status
            </h3>
            <p className="text-body-md text-on-surface-variant">
              Stage: <span className="font-bold text-on-surface">{STAGE_LABELS[submission.stage] ?? submission.stage}</span>
            </p>
            {submission.is_test && (
              <p className="text-label-md text-error mt-2">TEST — excluded from revenue reporting</p>
            )}
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
            <h3 className="text-title-lg text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[20px]">travel_explore</span>
              Fit check
            </h3>
            {submission.fit_alignment ? (
              <>
                <span
                  className={`inline-flex px-2.5 py-1 rounded-full text-label-sm font-bold ${
                    FIT_STYLE[submission.fit_alignment] ?? "bg-surface-container-highest text-on-surface-variant"
                  }`}
                >
                  {FIT_LABELS[submission.fit_alignment] ?? submission.fit_alignment}
                </span>
                <p className="text-body-md text-on-surface-variant mt-2">{submission.fit_explanation}</p>
              </>
            ) : (
              <p className="text-body-md text-on-surface-variant">
                Not run yet — this only runs automatically right after a client submits via the intake wizard.
              </p>
            )}

            {submission.mandatory_site_visit_concern && (
              <div className="mt-4 bg-error-container/20 border border-error/30 rounded-lg p-4 flex gap-3">
                <span className="material-symbols-outlined text-error text-[20px] shrink-0">warning</span>
                <div>
                  <p className="text-label-md text-error font-bold uppercase tracking-wide mb-1">
                    Mandatory site visit
                  </p>
                  <p className="text-body-md text-on-surface">{submission.mandatory_site_visit_explanation}</p>
                </div>
              </div>
            )}

            {submission.wage_risk_concern && (
              <div className="mt-4 bg-surface-container-highest border border-outline-variant rounded-lg p-4 flex gap-3">
                <span className="material-symbols-outlined text-on-surface-variant text-[20px] shrink-0">payments</span>
                <div>
                  <p className="text-label-md text-on-surface font-bold uppercase tracking-wide mb-1">
                    Wage pricing risk
                  </p>
                  <p className="text-body-md text-on-surface-variant">{submission.wage_risk_explanation}</p>
                </div>
              </div>
            )}

            {submission.fit_eligibility_concern && (
              <div className="mt-4 bg-surface-container-highest border border-outline-variant rounded-lg p-4 flex gap-3">
                <span className="material-symbols-outlined text-on-surface-variant text-[20px] shrink-0">fact_check</span>
                <div>
                  <p className="text-label-md text-on-surface font-bold uppercase tracking-wide mb-1">
                    Eligibility to check
                  </p>
                  <p className="text-body-md text-on-surface-variant">{submission.fit_eligibility_explanation}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <section className="mt-6">
        <h2 className="text-title-lg text-primary mb-4 flex items-center gap-2 border-b border-outline-variant pb-2">
          <span className="material-symbols-outlined text-on-surface-variant text-[20px]">history</span>
          Audit log
        </h2>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-body-sm">
            <thead className="bg-surface-container-low border-b border-outline-variant">
              <tr>
                <th className="py-3 px-4 text-label-sm text-on-surface-variant uppercase tracking-wider">Timestamp</th>
                <th className="py-3 px-4 text-label-sm text-on-surface-variant uppercase tracking-wider">By</th>
                <th className="py-3 px-4 text-label-sm text-on-surface-variant uppercase tracking-wider">Event</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {(auditLog ?? []).map((entry: any) => (
                <tr key={entry.id}>
                  <td className="py-3 px-4 text-on-surface whitespace-nowrap">
                    {new Date(entry.created_at).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-on-surface">{entry.team_members?.full_name ?? "System"}</td>
                  <td className="py-3 px-4 text-on-surface-variant">
                    {AUDIT_EVENT_LABELS[entry.event_type] ?? entry.event_type}
                  </td>
                </tr>
              ))}
              {(!auditLog || auditLog.length === 0) && (
                <tr>
                  <td colSpan={3} className="py-6 px-4 text-center text-on-surface-variant">
                    No activity recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
