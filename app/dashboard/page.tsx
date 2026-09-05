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

const STAGE_LABELS: Record<string, string> = {
  submitted: "Submitted",
  in_review: "In review",
  deliverables_ready: "Deliverables ready",
  client_review: "Client review",
  closed: "Closed",
};

const CHECKLIST_STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
  waived: "Waived",
};

// Same labels already used client-facing on the intake confirmation screen
// (IntakeWizard.tsx) -- badge only, no explanatory text, matching the
// decision to keep Fit Check's raw admin-facing prose and the sharper
// eligibility-concern flag out of the client's ongoing view. "weak" never
// gets a red/error treatment -- it's deliberately non-alarming, since this
// is a readiness read for our own prep process, never a chance-of-winning
// or disqualification claim. Colors found broken on real inspection and
// fixed here (then backported to IntakeWizard.tsx, which had the same two
// bugs from sharing this exact object): "moderate" was the same gray as
// "weak," which reads as neutral/nothing rather than an actual signal --
// now a distinct amber (tertiary-container) instead, while "weak" stays
// deliberately muted rather than becoming a second, different color that
// would read as more alarming than it should.
const FIT_LABELS: Record<string, string> = {
  strong: "Strong fit",
  moderate: "Moderate fit",
  weak: "Worth a second look",
};
const FIT_STYLE: Record<string, string> = {
  strong: "bg-secondary-container text-on-secondary-container",
  moderate: "bg-tertiary-container text-on-tertiary-container",
  weak: "bg-surface-container-highest text-on-surface-variant",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ submission?: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: client } = await supabase
    .from("clients")
    .select("id, org_id, company_name, contact_name, naics_codes")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  // Not a client account (e.g. an admin landed here directly) — the root
  // page already knows how to route each account type correctly.
  if (!client) redirect("/");

  // Ordered by updated_at (bumped on every stage change), not created_at —
  // the default tab should be whichever bid most recently had something
  // happen to it, not just whichever was opened first. Otherwise an older
  // submission that just got a fresh stage change loses the default slot
  // to a newer-but-untouched-since one, and looks "stuck" on reload even
  // though the data was never stale — just showing the wrong submission.
  const { data: submissions, error: submissionsError } = await supabase
    .from("submissions")
    .select(
      "id, agency, solicitation_number, due_date, scope, stage, draft, is_test, package_id, created_at, updated_at, mandatory_site_visit_concern, mandatory_site_visit_explanation, fit_alignment"
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
        <p className="text-body-md text-on-surface-variant mb-4">
          You haven&apos;t started a bid yet.
        </p>
        <Link
          href="/intake"
          className="inline-block py-3 px-4 bg-secondary text-on-secondary rounded text-label-md font-semibold hover:bg-on-secondary-container transition active:scale-[0.97] w-fit"
        >
          Start your first bid
        </Link>
      </AppShell>
    );
  }

  const { submission: requestedId } = await searchParams;
  const activeSubmission = (requestedId && submissions.find((s) => s.id === requestedId)) || submissions[0];

  const { data: pkg } = activeSubmission.package_id
    ? await supabase
        .from("packages")
        .select("package_type, price_note")
        .eq("id", activeSubmission.package_id)
        .maybeSingle()
    : { data: null };

  const { data: checklist } = await supabase
    .from("checklist_items")
    .select("id, label, status")
    .eq("submission_id", activeSubmission.id)
    .order("updated_at", { ascending: true });

  const showDeliverables = stageNumber(activeSubmission.stage) >= stageNumber("deliverables_ready");

  const { data: deliverablesRaw } = showDeliverables
    ? await supabase
        .from("deliverables")
        .select("id, deliverable_type, file_url, content, created_at")
        .eq("submission_id", activeSubmission.id)
    : { data: null };
  const deliverables = await signRfpDocumentUrls(supabase, deliverablesRaw ?? []);

  // Safety net: heads-up shown BEFORE the client ever gets to deliverables,
  // not a surprise buried in the compliance matrix document later (see the
  // matching note in that document's own content, generate-draft/route.ts).
  const tradeKnown = isKnownTrade({ naicsCodes: client.naics_codes ?? [], scopeText: activeSubmission.scope ?? "" });

  return (
    <AppShell activePath="/dashboard" role="client" viewerName={client.company_name}>
      {submissions.length > 1 && (
        <div className="flex gap-2 flex-wrap mt-6">
          {submissions.map((s) => (
            <Link
              key={s.id}
              href={`/dashboard?submission=${s.id}`}
              className={`px-3 py-2 rounded text-label-md border transition ${
                s.id === activeSubmission.id
                  ? "bg-secondary text-on-secondary border-secondary"
                  : "bg-surface border-outline-variant text-on-surface hover:bg-surface-container-high"
              }`}
            >
              {s.agency}
            </Link>
          ))}
        </div>
      )}

      <div className={submissions.length > 1 ? "" : "mt-6"}>
        <p className="text-label-md text-on-surface-variant uppercase tracking-wider mb-1">
          {client.company_name}
          {activeSubmission.is_test && (
            <span className="ml-2 text-[10px] px-2 py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-bold uppercase">
              Test
            </span>
          )}
        </p>
        <h1 className="text-headline-lg text-primary mb-1">{activeSubmission.agency}</h1>
        <p className="text-body-md text-on-surface-variant">
          {activeSubmission.solicitation_number ?? "No solicitation number on file"}
          {activeSubmission.due_date &&
            ` · Due ${new Date(activeSubmission.due_date).toLocaleDateString()}`}
        </p>
      </div>

      {activeSubmission.draft ? (
        // Still a draft — usually one an admin created from a matched
        // opportunity, with agency/scope/due date already on file. The
        // stage/checklist/deliverables panels below all describe states
        // that only make sense once this is actually locked in, so this
        // replaces them with just the one thing still missing.
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <CompleteBidFile submissionId={activeSubmission.id} clientId={client.id} />
          </div>
          {activeSubmission.scope && (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 h-fit">
              <h3 className="text-title-lg text-primary mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[20px]">description</span>
                Scope
              </h3>
              <p className="text-body-md text-on-surface-variant">{activeSubmission.scope}</p>
            </div>
          )}
        </div>
      ) : (
        <>
          {activeSubmission.mandatory_site_visit_concern && (
            <div className="mt-4 bg-error-container/20 border border-error/30 rounded-xl p-5 flex gap-3">
              <span className="material-symbols-outlined text-error text-[20px] shrink-0">warning</span>
              <div>
                <p className="text-label-md text-error font-bold uppercase tracking-wide mb-1">
                  Mandatory site visit — read this
                </p>
                <p className="text-body-md text-on-surface">{activeSubmission.mandatory_site_visit_explanation}</p>
              </div>
            </div>
          )}

          {!tradeKnown && (
            <div className="mt-4 bg-surface-container-highest border border-outline-variant rounded-xl p-5 flex gap-3">
              <span className="material-symbols-outlined text-on-surface-variant text-[20px] shrink-0">info</span>
              <div>
                <p className="text-label-md text-on-surface font-bold uppercase tracking-wide mb-1">
                  A note about your trade
                </p>
                <p className="text-body-md text-on-surface-variant">
                  We&apos;re still building extra bid-help for your kind of business. We&apos;ll still write your
                  capability statement and approach summary in full. The compliance checklist might not catch
                  everything specific to your trade yet. We&apos;ll flag that for you when it&apos;s ready. You can
                  always ask us directly.
                </p>
              </div>
            </div>
          )}

          <LifecycleStepper currentStage={stageNumber(activeSubmission.stage)} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
            <div className="lg:col-span-2 flex flex-col gap-6">
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
                <h2 className="text-title-lg text-primary mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-[20px]">timeline</span>
                  Status
                </h2>
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-body-md text-on-surface">
                    {STAGE_LABELS[activeSubmission.stage] ?? activeSubmission.stage}
                  </p>
                  {activeSubmission.fit_alignment && (
                    <span
                      className={`inline-flex px-3 py-1 rounded-full text-label-md font-bold ${
                        FIT_STYLE[activeSubmission.fit_alignment] ?? "bg-surface-container-highest text-on-surface-variant"
                      }`}
                    >
                      {FIT_LABELS[activeSubmission.fit_alignment] ?? activeSubmission.fit_alignment}
                    </span>
                  )}
                </div>
              </div>

              <SubmissionMessages
                submissionId={activeSubmission.id}
                orgId={client.org_id}
                clientId={client.id}
                viewerRole="client"
                senderName={client.contact_name ?? client.company_name}
                senderEmail={user.email ?? ""}
              />

              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low">
                  <h2 className="text-title-lg text-primary flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-[20px]">fact_check</span>
                    What we still need from you
                  </h2>
                </div>
                {checklist && checklist.length > 0 ? (
                  <div className="flex flex-col">
                    {checklist.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between px-6 py-4 border-b border-outline-variant last:border-b-0 border-l-4 ${
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
                        <span className="text-label-md px-2 py-0.5 rounded text-[10px] border border-outline-variant bg-surface-container-low text-on-surface-variant uppercase">
                          {CHECKLIST_STATUS_LABELS[item.status] ?? item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-body-md text-on-surface-variant px-6 py-6">Nothing pending right now.</p>
                )}
              </div>

              {showDeliverables && (
                <DeliverablesSection
                  submissionId={activeSubmission.id}
                  orgId={client.org_id}
                  clientId={client.id}
                  deliverables={deliverables}
                />
              )}
            </div>

            <div className="flex flex-col gap-6">
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
                <h3 className="text-title-lg text-primary mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-[20px]">folder_special</span>
                  Package
                </h3>
                {pkg ? (
                  <>
                    <p className="text-body-md text-on-surface capitalize">{pkg.package_type.replace(/_/g, " ")}</p>
                    {pkg.price_note && (
                      <p className="text-body-md text-on-surface-variant mt-1">{pkg.price_note}</p>
                    )}
                  </>
                ) : (
                  <p className="text-body-md text-on-surface-variant">Not yet assigned.</p>
                )}
              </div>

              {activeSubmission.scope && (
                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
                  <h3 className="text-title-lg text-primary mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-[20px]">description</span>
                    Scope
                  </h3>
                  <p className="text-body-md text-on-surface-variant">{activeSubmission.scope}</p>
                </div>
              )}

              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
                <h3 className="text-title-lg text-primary mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-[20px]">balance</span>
                  Bid process reminders
                </h3>
                <BidProcessNotices />
              </div>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
