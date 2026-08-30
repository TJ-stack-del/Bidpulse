import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isFederalAgency } from "@/lib/federal-agency";

// Admin-only "auto-draft" helper for DeliverablesPanel — removes the
// blank-page problem by returning a structured starting draft built from
// the submission's own intake data (agency, scope, client NAICS/status
// info), not a fully-written deliverable. No LLM is wired up yet (no
// provider key configured anywhere in this project), so this is a
// template fill-in for now — swap buildDraft()'s internals for a real
// model call later without touching the route's request/response contract
// or the client-side wiring in DeliverablesPanel.tsx.

const DELIVERABLE_LABELS: Record<string, string> = {
  capability_statement: "Capability statement",
  compliance_matrix: "Compliance matrix",
  technical_narrative: "Technical narrative",
};

type ClientInfo = {
  company_name: string | null;
  naics_codes: string[] | null;
  set_asides: string[] | null;
  license_number: string | null;
  years_in_business: number | null;
  business_address: string | null;
  business_phone: string | null;
  insurance_provider: string | null;
  insurance_policy_number: string | null;
  general_liability_coverage: string | null;
  workers_comp_coverage: string | null;
  differentiators: string | null;
};

type SubmissionInfo = {
  id: string;
  agency: string;
  solicitation_number: string | null;
  scope: string | null;
  clients: ClientInfo | null;
};

function certificationLabel(cert: { cert_type: string; other_label: string | null }): string {
  return cert.cert_type === "Other" ? cert.other_label || "Other" : cert.cert_type;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const submissionId = body?.submissionId;
  const deliverableType = body?.deliverableType;

  if (typeof submissionId !== "string" || typeof deliverableType !== "string" || !(deliverableType in DELIVERABLE_LABELS)) {
    return NextResponse.json({ error: "Invalid submissionId or deliverableType." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // Admin-only: a client authenticated to their own submission would still
  // pass the RLS-scoped select below (their own row), so team_members
  // membership is checked explicitly rather than relying on RLS alone.
  const { data: member } = await supabase
    .from("team_members")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { data: submission } = await supabase
    .from("submissions")
    .select(
      "id, agency, solicitation_number, scope, client_id, clients(company_name, naics_codes, set_asides, license_number, years_in_business, business_address, business_phone, insurance_provider, insurance_policy_number, general_liability_coverage, workers_comp_coverage, differentiators)"
    )
    .eq("id", submissionId)
    .maybeSingle();

  if (!submission) {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }

  // Only a certification an admin has actually looked at and marked
  // Verified counts as fact in anything this route generates — an
  // unverified upload is a claim, not something to put in front of an
  // agency. Same rule the final PDF (lib/pdf/deliverables-packet.ts)
  // follows for consistency between the draft and the delivered document.
  const { data: verifiedCerts } = await supabase
    .from("client_certifications")
    .select("cert_type, other_label")
    .eq("client_id", submission.client_id)
    .eq("verified", true);

  const content = buildDraft(
    deliverableType,
    submission as unknown as SubmissionInfo,
    (verifiedCerts ?? []).map(certificationLabel)
  );
  return NextResponse.json({ content });
}

function buildDraft(deliverableType: string, submission: SubmissionInfo, verifiedCertLabels: string[]): string {
  const client = submission.clients ?? {
    company_name: null,
    naics_codes: null,
    set_asides: null,
    license_number: null,
    years_in_business: null,
    business_address: null,
    business_phone: null,
    insurance_provider: null,
    insurance_policy_number: null,
    general_liability_coverage: null,
    workers_comp_coverage: null,
    differentiators: null,
  };
  const company = client.company_name ?? "the contractor";
  const agency = submission.agency;
  const solicitationLine = submission.solicitation_number ? ` — Solicitation ${submission.solicitation_number}` : "";
  const scope = submission.scope ?? "[scope of work — see the RFP]";
  const naics = client.naics_codes && client.naics_codes.length > 0 ? client.naics_codes.join(", ") : "[NAICS codes]";
  const statuses =
    verifiedCertLabels.length > 0 ? verifiedCertLabels.join(", ") : "[no verified certifications on file yet]";
  const setAsides = client.set_asides && client.set_asides.length > 0 ? client.set_asides.join(", ") : null;

  if (deliverableType === "capability_statement") {
    const licenseNumber = client.license_number ?? "[license #]";
    const entityLine = isFederalAgency(agency)
      ? `Entity Identifiers: UEI: [UEI] | CAGE Code: [CAGE code] | State registration: [registration #]`
      : `Entity Identifiers: State registration: [registration #] | Local business license: ${licenseNumber}`;

    const yearsInBusiness =
      client.years_in_business !== null && client.years_in_business !== undefined
        ? `${client.years_in_business} years`
        : "[years in business]";
    const companyInfoLine = `Years in Business: ${yearsInBusiness} | Business Address: ${
      client.business_address ?? "[business address]"
    } | Business Phone: ${client.business_phone ?? "[business phone]"}`;

    const insuranceLine = `Insurance: ${client.insurance_provider ?? "[insurance provider]"}${
      client.insurance_policy_number ? ` (Policy #${client.insurance_policy_number})` : ""
    } | General Liability: ${client.general_liability_coverage ?? "[GL coverage amount]"} | Workers' Comp: ${
      client.workers_comp_coverage ?? "[workers' comp coverage]"
    }`;

    // Real client-provided differentiators are an actual fact to use as-is,
    // not something to fabricate — only falls back to a placeholder when
    // the client hasn't filled in that Company Profile field yet.
    const differentiators =
      client.differentiators?.trim() ||
      `[What sets ${company} apart for this agency and scope — certifications, track record, capacity.]`;

    return [
      `CAPABILITY STATEMENT: ${company.toUpperCase()}`,
      "",
      `Prepared for: ${agency}${solicitationLine}`,
      "",
      "[DRAFT — replace every bracketed placeholder before sending]",
      "",
      entityLine,
      "",
      companyInfoLine,
      "",
      insuranceLine,
      "",
      `Socioeconomic Certifications: ${statuses}${setAsides ? ` | Set-asides: ${setAsides}` : ""}`,
      "",
      `Primary NAICS Codes: ${naics}`,
      "",
      "Core Competencies:",
      `[Summarize ${company}'s core service lines relevant to: ${scope}]`,
      "",
      "Differentiators:",
      differentiators,
    ].join("\n");
  }

  if (deliverableType === "compliance_matrix") {
    // This is a checklist of what to verify, not a completed matrix — never
    // generate a status that implies a requirement is already met (no
    // "Compliant" / "Fully Compliant" / anything like it), and never invent
    // a plausible-looking number, certification, registration ID, or
    // coverage amount. Nothing here is sourced from the actual RFP text (it
    // isn't parsed anywhere in this app — submission_documents only stores
    // an uploaded file URL) or from any verified client documentation, so
    // every row must stay an explicit, unmistakable gap for the admin to
    // fill in after checking the real RFP and the client's real paperwork.
    return [
      `COMPLIANCE MATRIX — ${agency}${solicitationLine}`,
      "",
      "[DRAFT — this is a checklist of requirements to VERIFY, not a completed matrix.",
      "Nothing below has been confirmed. Every status is NEEDS VERIFICATION or NOT YET",
      "PROVIDED until you check the actual RFP and the client's real documentation —",
      "never change a status to \"Compliant\" without confirming it first, and never",
      "fill in a number, certification, registration ID, or coverage amount unless it's",
      "a real, verified value. Leave a field blank rather than guess.]",
      "",
      "Solicitation Requirement | Compliance Status | Proposer Methodology & Verification",
      "1. [Requirement from RFP — not yet identified] | NEEDS VERIFICATION | [Not yet provided — confirm with the client before writing anything here]",
      "2. [Requirement from RFP — not yet identified] | NEEDS VERIFICATION | [Not yet provided — confirm with the client before writing anything here]",
      "3. [Requirement from RFP — not yet identified] | NOT YET PROVIDED | [Not yet provided — confirm with the client before writing anything here]",
      "",
      `Scope reference: ${scope}`,
    ].join("\n");
  }

  // technical_narrative
  return [
    `TECHNICAL APPROACH & OPERATIONAL PLAN — ${agency}${solicitationLine}`,
    "",
    `[DRAFT — replace each section below with specifics for: ${scope}]`,
    "",
    "1. Work Execution & Operational Cadence",
    `${company} proposes to [describe the day-to-day operational approach for this scope].`,
    "",
    "2. Quality Assurance & Compliance Controls",
    `[Describe QA processes and how compliance with the ${naics} scope requirements is verified.]`,
    "",
    "3. Management Oversight",
    "[Describe supervision structure, reporting cadence, and issue-resolution SLA.]",
  ].join("\n");
}
