import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CertificationsSection } from "../profile/CertificationsSection";
import { InsuranceBondingSection } from "../profile/InsuranceBondingSection";
import { DocumentLibrarySection } from "../profile/DocumentLibrarySection";
import { PastPerformanceSection } from "../profile/PastPerformanceSection";
import { signRfpDocumentUrls, signRfpDocumentUrl } from "@/lib/storage";
import { computeReadinessScore } from "@/lib/compliance/readiness-score";
import { getExpiringSoon } from "@/lib/compliance/expiring-soon";
import { ComplianceReadinessGauge } from "@/components/ui/ComplianceReadinessGauge";
import { ExpiringSoonBanner } from "@/components/ui/ExpiringSoonBanner";

// Split out of app/dashboard/profile/page.tsx per explicit user direction:
// the target mockup (a Stitch-designed "Compliance Vault" screen) has this
// content on its own nav tab, separate from "Profile" -- stacking
// Certifications/Insurance & Bonding/Document Library/Past Performance
// directly onto the Company Info page (which is where Phase 1-3 of this
// build initially landed them) was cramming four substantial sections onto
// one page instead of matching that structure.
export const dynamic = "force-dynamic";

// Mirrors InsuranceBondingSection.tsx's own POLICY_TYPES labels -- kept as a
// plain lookup here rather than importing that "use client" module's array,
// since this file only needs the label strings, not the form component.
const POLICY_TYPE_LABELS: Record<string, string> = {
  general_liability: "General Liability",
  workers_comp: "Workers' Comp",
  commercial_auto: "Commercial Auto",
  professional_liability: "Professional Liability",
  umbrella: "Umbrella",
};

export default async function ComplianceVaultPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: client } = await supabase
    .from("clients")
    .select("id, company_name")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!client) redirect("/");

  const { data: certificationsRaw } = await supabase
    .from("client_certifications")
    .select(
      "id, cert_type, other_label, certification_number, expiration_date, file_url, file_name, verified, created_at, record_type, jurisdiction_state, licensing_board"
    )
    .eq("client_id", client.id)
    .order("created_at", { ascending: false });
  const certifications = await signRfpDocumentUrls(supabase, certificationsRaw ?? []);

  const { data: insurancePoliciesRaw } = await supabase
    .from("client_insurance_policies")
    .select(
      "id, policy_type, carrier_name, policy_number, per_occurrence_limit, aggregate_limit, effective_date, expiration_date, file_url, file_name, verified"
    )
    .eq("client_id", client.id)
    .order("created_at", { ascending: false });
  const insurancePolicies = await signRfpDocumentUrls(supabase, insurancePoliciesRaw ?? []);

  const { data: bondingRaw } = await supabase
    .from("client_bonding_capacity")
    .select(
      "id, surety_name, bond_number, aggregate_bonding_capacity, single_project_bonding_capacity, effective_date, expiration_date, file_url, file_name, verified"
    )
    .eq("client_id", client.id)
    .order("created_at", { ascending: false });
  const bondingRecords = await signRfpDocumentUrls(supabase, bondingRaw ?? []);

  const { data: documentsRaw } = await supabase
    .from("client_documents")
    .select("id, doc_type, label, file_url, file_name, created_at")
    .eq("client_id", client.id)
    .order("created_at", { ascending: false });
  const documents = await signRfpDocumentUrls(supabase, documentsRaw ?? []);

  const { data: pastPerformanceRaw } = await supabase
    .from("client_past_performance")
    .select(
      "id, reference_client_name, scope_of_work, contract_value, outcome, created_at, photo_url, photo_file_name, prime_gc_name, on_time_percentage, verification_status"
    )
    .eq("client_id", client.id)
    .order("created_at", { ascending: false });
  // signRfpDocumentUrls signs `file_url` specifically -- past performance's
  // evidence photo uses photo_url instead (see lib/storage.ts's comment on
  // why), so this signs it directly rather than through that helper.
  const pastPerformance = await Promise.all(
    (pastPerformanceRaw ?? []).map(async (row) => ({
      ...row,
      photo_url: await signRfpDocumentUrl(supabase, row.photo_url),
    }))
  );

  // Readiness score spans every verifiable record type (certifications,
  // insurance, bonding) -- past performance and document-library rows are
  // deliberately excluded, since neither carries a `verified` column (see
  // the Compliance Vault plan: past performance uses a separate, hybrid
  // federal-award check instead, and the document library was built with
  // no admin-verification workflow at all).
  const readiness = computeReadinessScore([...certifications, ...insurancePolicies, ...bondingRecords]);

  const certLabel = (c: (typeof certifications)[number]) =>
    c.record_type === "small_business_cert" && c.cert_type === "Other" ? c.other_label || "Other" : c.cert_type;
  const policyLabel = (p: (typeof insurancePolicies)[number]) =>
    POLICY_TYPE_LABELS[p.policy_type] ?? p.policy_type;
  const bondingLabel = (b: (typeof bondingRecords)[number]) => `Bond${b.surety_name ? ` — ${b.surety_name}` : ""}`;

  const expiringSoon = [
    ...getExpiringSoon(certifications, certLabel),
    ...getExpiringSoon(insurancePolicies, policyLabel),
    ...getExpiringSoon(bondingRecords, bondingLabel),
  ].sort((a, b) => new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime());

  return (
    <>
      <div className="mt-6">
        <h1 className="text-headline-lg text-primary mb-1">Compliance Vault</h1>
        <p className="text-body-md text-on-surface-variant">{client.company_name}</p>
      </div>

      <div className="mt-4">
        <ComplianceReadinessGauge percent={readiness.percent} verifiedCount={readiness.verifiedCount} total={readiness.total} />
      </div>

      {expiringSoon.length > 0 && (
        <div className="mt-4">
          <ExpiringSoonBanner records={expiringSoon} />
        </div>
      )}

      <div className="bg-surface-container-lowest dark:bg-surface-container-low border border-outline-variant rounded-xl p-6 mt-4">
        <h2 className="text-title-lg text-primary mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">verified</span>
          Certifications & Licenses
        </h2>
        <p className="text-body-md text-on-surface-variant mb-4">
          Add each trade license, small-business/socioeconomic certification, or field certification you hold,
          with its document. Our team reviews the document before it&apos;s used in anything we prepare for you.
        </p>
        <CertificationsSection clientId={client.id} initialCertifications={certifications} />
      </div>

      <div className="bg-surface-container-lowest dark:bg-surface-container-low border border-outline-variant rounded-xl p-6 mt-4">
        <h2 className="text-title-lg text-primary mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">shield</span>
          Insurance & Bonding
        </h2>
        <p className="text-body-md text-on-surface-variant mb-4">
          Add each insurance policy and, if you carry one, your surety bonding capacity, with its document. Our
          team reviews the document before it&apos;s used in anything we prepare for you.
        </p>
        <InsuranceBondingSection clientId={client.id} initialPolicies={insurancePolicies} initialBonding={bondingRecords} />
      </div>

      <div className="bg-surface-container-lowest dark:bg-surface-container-low border border-outline-variant rounded-xl p-6 mt-4">
        <h2 className="text-title-lg text-primary mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">folder_copy</span>
          Document Library
        </h2>
        <p className="text-body-md text-on-surface-variant mb-4">
          Keep your standard paperwork here (W-9, non-collusion affidavit, capability statement, any custom
          RFP riders) so it&apos;s ready to reuse instead of hunting it down for every bid.
        </p>
        <DocumentLibrarySection clientId={client.id} initialDocuments={documents} />
      </div>

      <div className="bg-surface-container-lowest dark:bg-surface-container-low border border-outline-variant rounded-xl p-6 mt-4">
        <h2 className="text-title-lg text-primary mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">work_history</span>
          Past Performance
        </h2>
        <p className="text-body-md text-on-surface-variant mb-4">
          Add a few past projects: client/agency name, scope, contract value, and outcome. We use these as real
          references in your capability statement instead of leaving that section blank.
        </p>
        <PastPerformanceSection clientId={client.id} initialEntries={pastPerformance ?? []} />
      </div>
    </>
  );
}
