import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isFederalAgency } from "@/lib/federal-agency";
import { detectAgencyTypes } from "@/lib/agency-type";
import { referenceRequirementRows } from "@/lib/compliance/requirements-reference";

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

export type ClientInfo = {
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

export type SubmissionInfo = {
  id: string;
  agency: string;
  solicitation_number: string | null;
  scope: string | null;
  clients: ClientInfo | null;
};

function certificationLabel(cert: { cert_type: string; other_label: string | null }): string {
  return cert.cert_type === "Other" ? cert.other_label || "Other" : cert.cert_type;
}

// Capitalizes each word's first letter without touching the rest, so an
// existing acronym (HEPA, OSHA, VCT) survives instead of getting mangled.
function titleCase(text: string): string {
  return text
    .split(" ")
    .map((word) => (word.length === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

// The client's scope field is free text, not a parsed RFP — this only
// reorganizes what's already there into checklist-sized labels, it never
// adds a requirement the scope didn't mention. Paragraphs (the client's own
// line breaks) are the first choice since intake naturally separates one
// service line per paragraph (see the RFP-0182-26 example: "Day porter
// operations: ...", "Nightly custodial: ...", one per line); a single dense
// paragraph falls back to sentence splitting so it doesn't collapse into
// one catch-all row.
function scopeSegments(scopeText: string): string[] {
  const paragraphs = scopeText
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (paragraphs.length > 1) return paragraphs;

  return scopeText
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// A label is the segment's own lead-in ("Day porter operations:") when it
// has one, since that's already the client's chosen name for that line
// item; otherwise the segment's first few words stand in for it. Either
// way the label is text lifted from the scope, never invented.
const MAX_REQUIREMENT_ROWS = 6;
const MAX_LABEL_WORDS = 6;

// Local Jacksonville-area bodies whose default set-aside program is JSEB —
// overridden below for the ones (JAA, JTA) whose projects commonly carry
// federal funding despite being locally administered.
const LOCAL_JACKSONVILLE_AGENCY_PATTERN = /\b(city of jacksonville|jea|jaa|jta)\b/i;

// One extra compliance-matrix row per agency-type signal, appended after
// the scope-derived requirement rows. Same "NEEDS VERIFICATION" rule as
// everything else in this matrix: these note a category of requirement
// that agency type typically carries, never a specific number, badge ID,
// or percentage — that still has to come from the real RFP.
function agencyTypeRequirementRows(agency: string): string[] {
  const rows: string[] = [];
  const agencyTypes = detectAgencyTypes(agency);
  const isAirport = agencyTypes.includes("airport");
  const isSchool = agencyTypes.includes("school");
  const isTransit = agencyTypes.includes("transit");
  const isLocalJacksonville = LOCAL_JACKSONVILLE_AGENCY_PATTERN.test(agency);

  if (isAirport) {
    rows.push(
      "SIDA badging / airport security clearance | NEEDS VERIFICATION | [Confirm SIDA badging and airport security clearance requirements with the agency before submission]"
    );
  }
  if (isSchool) {
    rows.push(
      "Level 2 background checks / school district badge requirements | NEEDS VERIFICATION | [Confirm Level 2 background check and district badging requirements before submission]"
    );
  }
  if (isTransit) {
    rows.push(
      "DBE (Disadvantaged Business Enterprise) participation goals | NEEDS VERIFICATION | [Confirm DBE participation goals with the agency before submission]"
    );
  }

  // Transit projects commonly carry federal (FTA) funding and aviation
  // projects commonly carry federal (FAA/AIP) funding even when the
  // authority is locally administered — that funding source is what
  // determines whether DBE/SDB or the local JSEB program applies, so it
  // takes priority over the local-Jacksonville default below. The transit
  // row above already names DBE by requirement type, so it isn't repeated
  // here as a separate set-aside row.
  if (isAirport) {
    rows.push(
      "Set-aside participation (DBE/SDB) | NEEDS VERIFICATION | [Confirm whether this project carries federal (FAA/AIP) funding and, if so, DBE/SDB set-aside participation requirements — federal funding is common on airport projects even when the authority is locally administered]"
    );
  } else if (!isTransit && isLocalJacksonville) {
    rows.push(
      "Local set-aside program (JSEB) | NEEDS VERIFICATION | [Confirm JSEB (Jacksonville Small/Emerging Business) eligibility and participation requirements with the agency before submission]"
    );
  }

  return rows;
}

function deriveRequirementLabels(scopeText: string): string[] {
  const labels: string[] = [];
  for (const segment of scopeSegments(scopeText)) {
    const colonIdx = segment.indexOf(":");
    const lead = colonIdx > 0 && colonIdx <= 60 ? segment.slice(0, colonIdx) : segment;
    const label = lead
      .split(" ")
      .slice(0, MAX_LABEL_WORDS)
      .join(" ")
      .replace(/[.,;:]+$/, "")
      .trim();
    if (label) labels.push(titleCase(label));
    if (labels.length >= MAX_REQUIREMENT_ROWS) break;
  }
  return labels;
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

export function buildDraft(deliverableType: string, submission: SubmissionInfo, verifiedCertLabels: string[]): string {
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
      `- [Core service line relevant to: ${scope}]`,
      "- [Add one short bullet per additional core service line — no paragraphs]",
      "",
      "Past Performance:",
      // Real capability statement convention — one line per project, not a
      // paragraph: client, scope, dollar value, outcome. Never invent a
      // client name, contract value, or result; this app doesn't collect
      // past-project data anywhere yet, so every field here stays an
      // explicit placeholder for the admin/client to fill in with real work.
      "- [Client name] — [scope of work] — $[contract value] — [outcome/result]",
      "- [Client name] — [scope of work] — $[contract value] — [outcome/result]",
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
    // coverage amount. The requirement labels below are the one exception
    // to "nothing is sourced from the RFP" — they're lifted straight from
    // the client's own scope text (deriveRequirementLabels only reorders
    // words already there), never invented. The RFP itself still isn't
    // parsed anywhere in this app (submission_documents only stores an
    // uploaded file URL), so status and verification stay an explicit,
    // unmistakable gap for the admin to fill in after checking the real RFP
    // and the client's real paperwork.
    // Strict pipe-delimited rows, one requirement per line, nothing else on
    // the line (no numbering, no bullets) — this is what lets the packet PDF
    // (lib/pdf/deliverables-packet.ts) parse it into a real autoTable grid
    // instead of flowing text. Never put a column header or any other
    // pipe-containing line in with the rows below: the PDF's row filter
    // only excludes lines starting with "[", so a stray "|" anywhere else
    // gets rendered as a bogus table row.
    const requirementLabels = submission.scope ? deriveRequirementLabels(submission.scope) : [];
    const requirementRows =
      requirementLabels.length > 0
        ? requirementLabels.map(
            (label) =>
              `${label} | NEEDS VERIFICATION | [Not yet provided — confirm with the client before writing anything here]`
          )
        : [
            "[Requirement from RFP — not yet identified] | NEEDS VERIFICATION | [Not yet provided — confirm with the client before writing anything here]",
            "[Requirement from RFP — not yet identified] | NEEDS VERIFICATION | [Not yet provided — confirm with the client before writing anything here]",
            "[Requirement from RFP — not yet identified] | NOT YET PROVIDED | [Not yet provided — confirm with the client before writing anything here]",
          ];
    requirementRows.push(...agencyTypeRequirementRows(agency));
    // Reference-library rows (lib/compliance/requirements-reference.ts): the
    // ALWAYS_MANDATORY tier always appears; CONDITIONAL_REQUIREMENTS and
    // TRADE_SPECIFIC_CERTIFICATIONS only appear when their trigger keyword is
    // actually present in the client's own scope text — never defaulted to
    // required. Appended after the scope-derived and agency-type rows above,
    // which stay untouched.
    requirementRows.push(...referenceRequirementRows(submission.scope ?? ""));

    return [
      `COMPLIANCE MATRIX — ${agency}${solicitationLine}`,
      "",
      "[DRAFT — this is a checklist of requirements to VERIFY, not a completed matrix.",
      "Nothing below has been confirmed. Every status is NEEDS VERIFICATION or NOT YET",
      "PROVIDED until you check the actual RFP and the client's real documentation —",
      "never change a status to \"Compliant\" without confirming it first, and never",
      "fill in a number, certification, registration ID, or coverage amount unless it's",
      "a real, verified value. Leave a field blank rather than guess.",
      "",
      "Each row below is strict pipe-delimited: Requirement, then Status, then",
      "Methodology & Verification, separated by pipes, one requirement per line —",
      "nothing else on the line. Don't add numbering, bullets, or a header row.]",
      "",
      ...requirementRows,
      "",
      `Scope reference: ${scope}`,
    ].join("\n");
  }

  // technical_narrative
  return [
    `TECHNICAL APPROACH & OPERATIONAL PLAN — ${agency}${solicitationLine}`,
    "",
    `[DRAFT — replace each bullet below with specifics for: ${scope}. Keep each`,
    "point to one short line — no dense paragraphs.]",
    "",
    "1. Work Execution & Operational Cadence",
    `- [Day-to-day operational approach ${company} proposes for this scope]`,
    "- [Staffing / scheduling approach]",
    "- [Add one bullet per additional operational point]",
    "",
    "2. Quality Assurance & Compliance Controls",
    `- [QA process that verifies compliance with the ${naics} scope requirements]`,
    "- [Inspection / reporting cadence]",
    "",
    "3. Management Oversight",
    "- [Supervision structure]",
    "- [Reporting cadence]",
    "- [Issue-resolution SLA]",
  ].join("\n");
}
