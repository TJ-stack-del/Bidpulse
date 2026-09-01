import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";
import { CertificationsSection } from "./CertificationsSection";
import { CompanyProfileClient } from "./CompanyProfileClient";
import { signRfpDocumentUrls } from "@/lib/storage";

// Same cookies()-forces-dynamic reasoning as app/dashboard/page.tsx.
export const dynamic = "force-dynamic";

export default async function CompanyProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: client } = await supabase
    .from("clients")
    .select(
      "id, company_name, contact_name, email, phone, license_number, business_registration_number, years_in_business, business_address, business_phone, insurance_provider, insurance_policy_number, general_liability_coverage, workers_comp_coverage, commercial_auto_coverage, differentiators, naics_codes, small_business_statuses, set_asides"
    )
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!client) redirect("/");

  const { data: certificationsRaw } = await supabase
    .from("client_certifications")
    .select("id, cert_type, other_label, certification_number, expiration_date, file_url, file_name, verified, created_at")
    .eq("client_id", client.id)
    .order("created_at", { ascending: false });
  const certifications = await signRfpDocumentUrls(supabase, certificationsRaw ?? []);

  return (
    <AppShell activePath="/dashboard/profile" role="client" viewerName={client.company_name}>
      <div className="mt-6">
        <h1 className="text-headline-lg text-primary mb-1">Company Profile</h1>
        <p className="text-body-md text-on-surface-variant">{client.company_name}</p>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 mt-4">
        <h2 className="text-title-lg text-primary mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary text-[20px]">business</span>
          Company Info
        </h2>
        <p className="text-body-md text-on-surface-variant mb-4">
          Fill this in once — we reuse it as real facts in every capability statement and readiness check we
          prepare for you, so you don&apos;t have to re-enter it on every bid.
        </p>
        <CompanyProfileClient
          clientId={client.id}
          initialInfo={{
            license_number: client.license_number,
            business_registration_number: client.business_registration_number,
            years_in_business: client.years_in_business,
            business_address: client.business_address,
            business_phone: client.business_phone,
            insurance_provider: client.insurance_provider,
            insurance_policy_number: client.insurance_policy_number,
            general_liability_coverage: client.general_liability_coverage,
            workers_comp_coverage: client.workers_comp_coverage,
            commercial_auto_coverage: client.commercial_auto_coverage,
            differentiators: client.differentiators,
            naics_codes: client.naics_codes ?? [],
            small_business_statuses: client.small_business_statuses ?? [],
            set_asides: client.set_asides ?? [],
          }}
        />
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 mt-4">
        <h2 className="text-title-lg text-primary mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary text-[20px]">verified</span>
          Certifications
        </h2>
        <p className="text-body-md text-on-surface-variant mb-4">
          Add each small-business or socioeconomic certification you hold, with its certificate document. Our
          team reviews the document before a certification is used in anything we prepare for you — you&apos;ll
          see its status change to &quot;Verified&quot; here once that happens.
        </p>
        <CertificationsSection clientId={client.id} initialCertifications={certifications} />
      </div>
    </AppShell>
  );
}
