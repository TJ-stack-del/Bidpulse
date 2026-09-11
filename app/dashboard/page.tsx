import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";
import { LifecycleStepper, stageNumber } from "@/components/ui/LifecycleStepper";
import { DeliverablesSection } from "./DeliverablesSection";
import { CompleteBidFile } from "./CompleteBidFile";
import { signRfpDocumentUrls } from "@/lib/storage";
import { BidProcessNotices } from "@/components/ui/BidProcessNotices";
import { SubmissionMessages } from "@/components/ui/SubmissionMessages";
import { isKnownTrade } from "@/lib/compliance/known-trades";
import { computeProfileCompleteness } from "@/lib/compliance/profile-completeness";

// Reads cookies (via lib/supabase/server) which already opts this page out
// of static rendering — confirmed via `Cache-Control: no-store` on the
// actual response. Kept explicit anyway so a future refactor that drops
// the cookies() call can't silently reintroduce caching here.
export const dynamic = "force-dynamic";

// Converted per BUILD-ORDER-BIDPULSE.md Step 5: a read-only status view
// for a client — package info, pending-info checklist (status only, no
// editing — that's admin-only per schema.sql's RLS policies), the 5-stage
// pilot timeline, and deliverables once the submission reaches
// deliverables_ready or later.
//
// Layout matches the Stitch "Real Schema" contractor workspace reference:
// every active (non-draft, non-closed) submission gets its own full card
// in one stacked feed -- NOT a tab-switcher that hides all but one. A real
// stat row and an always-visible "start a new bid" prompt sit above the
// feed; company profile and the certifications vault sit in a persistent
// sidebar (shown once, not per-submission). Closed bids collapse to a
// compact list at the bottom instead of disappearing.

const CHECKLIST_STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
  waived: "Waived",
};

// Same values CertificationsSection.tsx's own CERT_TYPES uses -- cert_type
// IS the display label already, except "Other" which stores its real name
// in other_label instead (see that component's own certLabel()).
function certLabel(cert: { cert_type: string; other_label: string | null }): string {
  return cert.cert_type === "Other" ? cert.other_label || "Other" : cert.cert_type;
}

function formatCurrency(value: number | null): string | null {
  if (value == null) return null;
  return `$${value.toLocaleString()}`;
}

type Submission = {
  id: string;
  agency: string;
  solicitation_number: string | null;
  due_date: string | null;
  scope: string | null;
  stage: string;
  draft: boolean;
  is_test: boolean;
  package_id: string | null;
  estimated_value: number | null;
  mandatory_site_visit_concern: boolean | null;
  mandatory_site_visit_explanation: string | null;
};

type ChecklistItem = { id: string; submission_id: string; label: string; status: string };
type Deliverable = {
  id: string;
  submission_id: string;
  deliverable_type: string;
  file_url: string | null;
  content: string | null;
  created_at: string;
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: client } = await supabase
    .from("clients")
    .select(
      "id, org_id, company_name, contact_name, naics_codes, license_number, business_registration_number, years_in_business, insurance_provider, general_liability_coverage, workers_comp_coverage, business_address, business_phone"
    )
    .eq("auth_user_id", user.id)
    .maybeSingle();

  // Not a client account (e.g. an admin landed here directly) — the root
  // page already knows how to route each account type correctly.
  if (!client) redirect("/");

  const { data: certifications } = await supabase
    .from("client_certifications")
    .select("id, cert_type, other_label, certification_number, expiration_date, verified")
    .eq("client_id", client.id)
    .order("created_at", { ascending: true });

  const completeness = computeProfileCompleteness({
    naicsCodes: client.naics_codes,
    licenseNumber: client.license_number,
    businessRegistrationNumber: client.business_registration_number,
    insuranceProvider: client.insurance_provider,
    generalLiabilityCoverage: client.general_liability_coverage,
    workersCompCoverage: client.workers_comp_coverage,
    businessAddress: client.business_address,
    businessPhone: client.business_phone,
    hasCertification: (certifications?.length ?? 0) > 0,
  });

  const { data: submissions, error: submissionsError } = await supabase
    .from("submissions")
    .select(
      "id, agency, solicitation_number, due_date, scope, stage, draft, is_test, package_id, created_at, updated_at, estimated_value, mandatory_site_visit_concern, mandatory_site_visit_explanation"
    )
    .eq("client_id", client.id)
    .order("updated_at", { ascending: false });

  // A failed query (e.g. a column that exists in code but not yet in the
  // live database — exactly what happened here once already) must never
  // look identical to "this client genuinely has zero bids." Discarding
  // `error` and falling through to the empty state on any failure is what
  // made that migration gap invisible instead of an obvious error.
  if (submissionsError) {
    console.error("[dashboard] failed to load submissions", {
      clientId: client.id,
      message: submissionsError.message,
      code: submissionsError.code,
      details: submissionsError.details,
      hint: submissionsError.hint,
    });
    return (
      <AppShell activePath="/dashboard" role="client" viewerName={client.company_name}>
        <p className="text-body-md text-error mt-6">
          Something went wrong loading your bids. Please refresh, or contact us if this keeps happening.
        </p>
      </AppShell>
    );
  }

  if (!submissions || submissions.length === 0) {
    return (
      <AppShell activePath="/dashboard" role="client" viewerName={client.company_name}>
        <h1 className="text-headline-lg text-primary mt-6 mb-1">Welcome, {client.company_name}.</h1>
        <p className="text-body-md text-on-surface-variant mb-4">You haven&apos;t started a bid yet.</p>
        <Link
          href="/intake"
          className="inline-block py-3 px-4 bg-primary-container text-on-primary-container rounded text-label-md font-semibold hover:opacity-90 transition active:scale-[0.97] w-fit"
        >
          Start your first bid
        </Link>
      </AppShell>
    );
  }

  const draftSubmissions = submissions.filter((s) => s.draft);
  const activeSubmissions = submissions.filter((s) => !s.draft && s.stage !== "closed");
  const closedSubmissions = submissions.filter((s) => !s.draft && s.stage === "closed");

  const activeIds = activeSubmissions.map((s) => s.id);

  const { data: checklistRaw } =
    activeIds.length > 0
      ? await supabase
          .from("checklist_items")
          .select("id, submission_id, label, status")
          .in("submission_id", activeIds)
          .order("updated_at", { ascending: true })
      : { data: [] as ChecklistItem[] };

  const { data: deliverablesRaw } =
    activeIds.length > 0
      ? await supabase
          .from("deliverables")
          .select("id, submission_id, deliverable_type, file_url, content, created_at")
          .in("submission_id", activeIds)
      : { data: [] as Deliverable[] };
  const deliverablesSigned = await signRfpDocumentUrls(supabase, deliverablesRaw ?? []);

  const checklistBySubmission = new Map<string, ChecklistItem[]>();
  for (const item of (checklistRaw ?? []) as ChecklistItem[]) {
    const list = checklistBySubmission.get(item.submission_id) ?? [];
    list.push(item);
    checklistBySubmission.set(item.submission_id, list);
  }
  const deliverablesBySubmission = new Map<string, Deliverable[]>();
  for (const d of deliverablesSigned as Deliverable[]) {
    const list = deliverablesBySubmission.get(d.submission_id) ?? [];
    list.push(d);
    deliverablesBySubmission.set(d.submission_id, list);
  }

  const packageIds = Array.from(new Set(submissions.map((s) => s.package_id).filter((id): id is string => !!id)));
  const { data: packagesRaw } =
    packageIds.length > 0
      ? await supabase.from("packages").select("id, package_type, price_note").in("id", packageIds)
      : { data: [] as { id: string; package_type: string; price_note: string | null }[] };
  const packagesById = new Map((packagesRaw ?? []).map((p) => [p.id, p]));

  // Real, computed aggregates -- both about this client's own bids, not an
  // internal admin/ops metric (the Stitch reference's "Staff Estimator
  // Assigned" and "System Status: Live Dispatch" stats belong to the admin
  // console it was rendered with, not a client's own page, so those are
  // skipped entirely rather than adapted).
  const awaitingPreviewCount = activeSubmissions.filter((s) => s.stage === "deliverables_ready").length;

  return (
    <AppShell activePath="/dashboard" role="client" viewerName={client.company_name}>
      <div className="mt-6 mb-2">
        <h1 className="text-headline-lg text-primary mb-1">Welcome back, {client.company_name}.</h1>
        <p className="text-body-md text-on-surface-variant">Your active bids, in one place.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface-container-low rounded-xl shadow-sm p-space-base flex items-center gap-space-md">
          <span className="material-symbols-outlined text-primary text-[24px]">assignment</span>
          <div>
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Active submissions</p>
            <p className="text-headline-sm text-on-surface font-bold font-code">
              {activeSubmissions.length + draftSubmissions.length}
            </p>
          </div>
        </div>
        <div className="bg-surface-container-low rounded-xl shadow-sm p-space-base flex items-center gap-space-md">
          <span className="material-symbols-outlined text-secondary text-[24px]">visibility</span>
          <div>
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Awaiting your preview</p>
            <p className="text-headline-sm text-on-surface font-bold font-code">{awaitingPreviewCount}</p>
          </div>
        </div>
      </div>

      <Link
        href="/intake"
        className="bg-primary-container/10 hover:bg-primary-container/20 border border-primary-container/30 rounded-xl p-space-base flex items-center gap-space-md transition"
      >
        <span className="material-symbols-outlined text-primary text-[28px] shrink-0">add_circle</span>
        <div className="flex-1 min-w-0">
          <p className="text-body-lg text-on-surface font-bold">Start a new bid</p>
          <p className="text-body-sm text-on-surface-variant">Send us the RFP — we&apos;ll take it from there.</p>
        </div>
        <span className="material-symbols-outlined text-primary shrink-0">arrow_forward</span>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">work</span>
            <h2 className="text-label-md text-on-surface font-bold uppercase tracking-wider">
              Active workstream · {activeSubmissions.length + draftSubmissions.length} in progress
            </h2>
          </div>

          {draftSubmissions.map((sub) => (
            <div key={sub.id} className="bg-surface-container-low rounded-xl shadow-md p-space-base flex flex-col gap-space-base">
              <div>
                <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">
                  {sub.solicitation_number ?? "No solicitation #"}
                </p>
                <h3 className="text-title-lg font-headline text-on-surface font-bold">{sub.agency}</h3>
              </div>
              <CompleteBidFile submissionId={sub.id} clientId={client.id} />
              {sub.scope && <p className="text-body-md text-on-surface-variant">{sub.scope}</p>}
            </div>
          ))}

          {activeSubmissions.map((sub) => (
            <SubmissionCard
              key={sub.id}
              submission={sub as Submission}
              checklist={checklistBySubmission.get(sub.id) ?? []}
              deliverables={deliverablesBySubmission.get(sub.id) ?? []}
              tradeKnown={isKnownTrade({ naicsCodes: client.naics_codes ?? [], scopeText: sub.scope ?? "" })}
              pkg={sub.package_id ? packagesById.get(sub.package_id) ?? null : null}
              companyName={client.company_name}
              orgId={client.org_id}
              clientId={client.id}
              senderName={client.contact_name ?? client.company_name}
              senderEmail={user.email ?? ""}
            />
          ))}

          {activeSubmissions.length === 0 && draftSubmissions.length === 0 && (
            <p className="text-body-md text-on-surface-variant bg-surface-container-low rounded-xl p-space-base">
              Nothing active right now — every bid is closed out.
            </p>
          )}

          {closedSubmissions.length > 0 && (
            <div className="bg-surface-container-low rounded-xl shadow-sm overflow-hidden">
              <div className="px-space-base py-space-sm bg-surface-container-high">
                <h3 className="text-label-sm text-on-surface font-bold uppercase tracking-wider">
                  Closed · {closedSubmissions.length}
                </h3>
              </div>
              <div className="flex flex-col divide-y divide-outline-variant">
                {closedSubmissions.map((sub) => (
                  <div key={sub.id} className="px-space-base py-space-sm flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-body-md text-on-surface font-semibold truncate">{sub.agency}</p>
                      <p className="text-label-sm text-on-surface-variant">
                        {sub.solicitation_number ?? "No solicitation #"}
                      </p>
                    </div>
                    <span className="shrink-0 text-label-sm text-on-surface-variant uppercase tracking-wider">
                      Closed
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar — shown once, not per submission */}
        <div className="flex flex-col gap-6">
          <div className="bg-surface-container-low rounded-xl shadow-sm p-space-base">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="text-[16px] font-headline font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">domain</span>
                Company profile
              </h3>
              {/* Replaces the earlier fit_alignment "fit" badge entirely
                  (see BUILD-ORDER-BIDPULSE.md item #10) -- that concept
                  measured profile completeness while reading as a
                  competitive judgment ("Weak fit"). A percentage has
                  nothing alarming to soften: it's concrete and fixable,
                  and stays informational (never red) at every level. */}
              <span
                className={`shrink-0 inline-flex px-2 py-0.5 rounded text-label-sm font-bold uppercase tracking-wider ${
                  completeness.percent === 100
                    ? "bg-secondary-container text-on-secondary-container"
                    : "bg-tertiary-container text-on-tertiary-container"
                }`}
              >
                {completeness.percent}% complete
              </span>
            </div>
            <div className="flex flex-col gap-space-sm text-body-md">
              <p className="text-on-surface font-semibold">{client.company_name}</p>
              {client.business_address && <p className="text-on-surface-variant">{client.business_address}</p>}
              {client.years_in_business != null && (
                <p className="text-on-surface-variant">{client.years_in_business} years in business</p>
              )}
              {client.license_number && <p className="text-on-surface-variant">License #{client.license_number}</p>}
              {(client.insurance_provider || client.general_liability_coverage || client.workers_comp_coverage) && (
                <div className="pt-space-xs border-t border-outline-variant mt-space-xs">
                  <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-1">
                    Insurance &amp; bonding
                  </p>
                  {client.insurance_provider && (
                    <p className="text-on-surface-variant">Carrier: {client.insurance_provider}</p>
                  )}
                  {client.general_liability_coverage && (
                    <p className="text-on-surface-variant">General liability: {client.general_liability_coverage}</p>
                  )}
                  {client.workers_comp_coverage && (
                    <p className="text-on-surface-variant">Workers&apos; comp: {client.workers_comp_coverage}</p>
                  )}
                </div>
              )}
              <Link href="/dashboard/profile" className="text-primary text-label-sm font-bold hover:underline mt-1">
                Edit your profile →
              </Link>
            </div>
          </div>

          <div className="bg-surface-container-low rounded-xl shadow-sm overflow-hidden">
            <div className="px-space-base py-space-sm bg-surface-container-high flex items-center justify-between">
              <h3 className="text-[16px] font-headline font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">verified</span>
                Credentials
              </h3>
              {certifications && certifications.length > 0 && (
                <span className="text-label-sm text-on-surface-variant font-code">
                  {certifications.filter((c) => c.verified).length} of {certifications.length} verified
                </span>
              )}
            </div>
            {certifications && certifications.length > 0 ? (
              <div className="flex flex-col divide-y divide-outline-variant">
                {certifications.map((cert) => (
                  <div key={cert.id} className="px-space-base py-space-sm flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-body-md text-on-surface font-semibold truncate">{certLabel(cert)}</p>
                      {cert.certification_number && (
                        <p className="text-label-sm text-on-surface-variant">Cert #{cert.certification_number}</p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 inline-flex px-2 py-0.5 rounded text-label-sm font-bold uppercase tracking-wider ${
                        cert.verified
                          ? "bg-secondary-container text-on-secondary-container"
                          : "bg-tertiary-container text-on-tertiary-container"
                      }`}
                    >
                      {cert.verified ? "Verified" : "Pending"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-body-md text-on-surface-variant px-space-base py-4">
                No certifications on file yet.{" "}
                <Link href="/dashboard/profile" className="text-primary font-bold hover:underline">
                  Add one
                </Link>
              </p>
            )}
          </div>

          <div className="bg-surface-container-low rounded-xl shadow-sm p-space-base">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-primary text-[18px]">balance</span>
              <h3 className="text-label-sm text-on-surface font-bold uppercase tracking-wider">
                Bid process reminders
              </h3>
            </div>
            <BidProcessNotices />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function SubmissionCard({
  submission,
  checklist,
  deliverables,
  tradeKnown,
  pkg,
  companyName,
  orgId,
  clientId,
  senderName,
  senderEmail,
}: {
  submission: Submission;
  checklist: ChecklistItem[];
  deliverables: Deliverable[];
  tradeKnown: boolean;
  pkg: { package_type: string; price_note: string | null } | null;
  companyName: string;
  orgId: string;
  clientId: string;
  senderName: string;
  senderEmail: string;
}) {
  const showDeliverables = stageNumber(submission.stage) >= stageNumber("deliverables_ready");
  const formattedValue = formatCurrency(submission.estimated_value);
  const pendingChecklistCount = checklist.filter((c) => c.status !== "done" && c.status !== "waived").length;

  return (
    <div className="bg-surface-container-low rounded-xl shadow-md overflow-hidden">
      <div className="p-space-base flex flex-col gap-space-base">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-label-sm text-primary font-bold uppercase tracking-wider">
              <span>{submission.solicitation_number ?? "No solicitation #"}</span>
              <span className="text-outline-variant">·</span>
              <span className="text-on-surface-variant normal-case font-medium">{companyName}</span>
            </div>
            <h3 className="text-headline-md font-headline text-on-surface font-bold mt-1">{submission.agency}</h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {pkg && (
              <span className="px-2 py-0.5 rounded bg-surface-container-highest text-on-surface-variant text-label-sm font-bold uppercase tracking-wider capitalize">
                {pkg.package_type.replace(/_/g, " ")}
              </span>
            )}
            {submission.is_test && (
              <span className="px-2 py-0.5 rounded bg-surface-container-highest text-on-surface-variant text-label-sm font-bold uppercase tracking-wider">
                Test
              </span>
            )}
          </div>
        </div>

        <LifecycleStepper currentStage={stageNumber(submission.stage)} />

        {submission.mandatory_site_visit_concern && (
          <div className="bg-error-container/10 rounded-xl p-space-base flex gap-space-md border-l-4 border-l-error">
            <span className="material-symbols-outlined text-error text-[20px] shrink-0">warning</span>
            <div>
              <p className="text-label-sm text-error font-bold uppercase tracking-wider mb-1">
                Mandatory site visit — read this
              </p>
              <p className="text-body-md text-on-surface">{submission.mandatory_site_visit_explanation}</p>
            </div>
          </div>
        )}

        {!tradeKnown && (
          <div className="bg-surface-container-high rounded-xl p-space-base flex gap-space-md border-l-4 border-l-tertiary">
            <span className="material-symbols-outlined text-tertiary text-[20px] shrink-0">info</span>
            <div>
              <p className="text-label-sm text-on-surface font-bold uppercase tracking-wider mb-1">
                A note about your trade
              </p>
              <p className="text-body-md text-on-surface-variant">
                We&apos;re still building extra bid-help for your kind of business, but we&apos;ll still write your
                capability statement and approach summary in full. Our compliance checklist might not catch
                everything specific to your trade yet, so our team will flag anything that needs your attention
                while reviewing your bid. You can always ask us directly if you&apos;re not sure about something.
              </p>
            </div>
          </div>
        )}

        <div className={`grid gap-space-sm ${formattedValue ? "grid-cols-2" : "grid-cols-1"}`}>
          <div className="bg-surface-container-lowest dark:bg-surface-container rounded-lg p-space-md">
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Submission deadline</p>
            <p className="text-body-lg text-on-surface font-bold mt-0.5">
              {submission.due_date ? new Date(submission.due_date).toLocaleDateString() : "Not set"}
            </p>
          </div>
          {formattedValue && (
            <div className="bg-surface-container-lowest dark:bg-surface-container rounded-lg p-space-md">
              <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Estimated value</p>
              <p className="text-body-lg text-on-surface font-bold mt-0.5 font-code">{formattedValue}</p>
            </div>
          )}
        </div>

        {submission.scope && (
          <div>
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-1">Scope</p>
            <p className="text-body-md text-on-surface-variant">{submission.scope}</p>
          </div>
        )}

        <div className="bg-surface-container-lowest dark:bg-surface-container rounded-lg overflow-hidden">
          <div className="px-space-md py-space-sm flex items-center justify-between">
            <h4 className="text-label-sm text-on-surface font-bold uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">fact_check</span>
              What we still need from you
            </h4>
            {pendingChecklistCount > 0 && (
              <span className="text-label-sm text-primary font-bold font-code">{pendingChecklistCount} pending</span>
            )}
          </div>
          {checklist.length > 0 ? (
            <div className="flex flex-col">
              {checklist.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between px-space-md py-space-sm border-t border-outline-variant border-l-4 ${
                    item.status === "done"
                      ? "border-l-secondary opacity-70"
                      : item.status === "in_progress"
                      ? "border-l-secondary"
                      : "border-l-transparent"
                  }`}
                >
                  <span className={`text-body-md text-on-surface ${item.status === "done" ? "line-through" : ""}`}>
                    {item.label}
                  </span>
                  <span className="text-label-sm px-2 py-0.5 rounded font-bold bg-surface-container-high text-on-surface-variant uppercase tracking-wider">
                    {CHECKLIST_STATUS_LABELS[item.status] ?? item.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-body-md text-on-surface-variant px-space-md py-4">Nothing pending right now.</p>
          )}
        </div>

        {showDeliverables && (
          <DeliverablesSection
            submissionId={submission.id}
            orgId={orgId}
            clientId={clientId}
            deliverables={deliverables}
            stage={submission.stage}
          />
        )}

        <SubmissionMessages
          submissionId={submission.id}
          orgId={orgId}
          clientId={clientId}
          viewerRole="client"
          senderName={senderName}
          senderEmail={senderEmail}
        />
      </div>
    </div>
  );
}
