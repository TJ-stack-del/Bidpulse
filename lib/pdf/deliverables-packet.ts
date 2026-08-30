import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { isFederalAgency } from "@/lib/federal-agency";

// Combines whatever deliverables have been prepared for a submission
// (capability statement, compliance matrix, technical narrative) into
// one real, downloadable PDF — this is the actual "RFP package" a
// client receives, not just text sitting in a box on screen.

type Deliverable = {
  deliverable_type: string;
  content: string | null;
  file_url: string | null;
};

type Certification = {
  cert_type: string;
  other_label: string | null;
  verified: boolean;
};

type ClientInfo = {
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  naics_codes: string[] | null;
  set_asides: string[] | null;
  client_certifications: Certification[] | null;
  license_number: string | null;
  years_in_business: number | null;
  business_address: string | null;
  business_phone: string | null;
  insurance_provider: string | null;
  insurance_policy_number: string | null;
  general_liability_coverage: string | null;
  workers_comp_coverage: string | null;
};

function certificationLabel(cert: Pick<Certification, "cert_type" | "other_label">): string {
  return cert.cert_type === "Other" ? cert.other_label || "Other" : cert.cert_type;
}

type SubmissionInfo = {
  agency: string;
  solicitation_number: string | null;
  due_date: string | null;
  scope: string | null;
  clients: ClientInfo | null;
};

const DELIVERABLE_LABELS: Record<string, string> = {
  capability_statement: "Capability Statement",
  compliance_matrix: "Compliance Matrix",
  technical_narrative: "Technical Narrative",
};

// Auto-drafted capability-statement content (app/api/generate-draft) writes
// "Core Competencies:" and "Differentiators:" as literal line headers
// followed by their text, up to the next blank-then-header line or the end
// of the string. Pulls just that one section back out, so the PDF can give
// it its own labeled block instead of re-printing the whole draft (with its
// own redundant agency/entity/NAICS preamble) under every heading. Returns
// null if the label isn't present — e.g. the admin overwrote the textarea
// with plain prose that never had these markers to begin with.
function extractSection(content: string, label: string, stopLabels: string[]): string | null {
  const lines = content.split("\n");
  const startIdx = lines.findIndex((l) => l.trim().toLowerCase() === `${label.toLowerCase()}:`);
  if (startIdx === -1) return null;

  const rest = lines.slice(startIdx + 1);
  const stopIdx = rest.findIndex((l) =>
    stopLabels.some((stop) => l.trim().toLowerCase() === `${stop.toLowerCase()}:`)
  );
  const section = (stopIdx === -1 ? rest : rest.slice(0, stopIdx)).join("\n").trim();
  return section || null;
}

// Technical-narrative content (both auto-drafted and, so far, every
// hand-typed replacement we've seen) uses "N. Section Title" as a literal
// numbered-line header. Splits on that pattern generically — by number, not
// by hardcoding the three template titles — so an admin adding/renaming/
// reordering sections still renders correctly instead of silently losing
// content the moment the wording drifts from the original draft.
function extractNumberedSections(content: string): { title: string; body: string }[] {
  const headerPattern = /^\d+\.\s+(.+)$/;
  const sections: { title: string; body: string[] }[] = [];
  let current: { title: string; body: string[] } | null = null;

  for (const line of content.split("\n")) {
    const match = line.trim().match(headerPattern);
    if (match) {
      if (current) sections.push(current);
      current = { title: match[1].trim(), body: [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  if (current) sections.push(current);

  return sections.map((s) => ({ title: s.title, body: s.body.join("\n").trim() }));
}

const MATRIX_HEAD = ["Solicitation Requirement", "Compliance Status", "Proposer Methodology & Verification"];

// A row's compliance status is the one word/phrase that reliably marks
// where "the requirement" ends and "the methodology" begins, even with no
// delimiter at all — real content pasted from elsewhere (see below) has
// nothing else consistent to split on. Longer/more specific phrases don't
// need to come first: a regex match is leftmost-first, and "FULLY
// COMPLIANT" / "NON-COMPLIANT" always start earlier in the text than the
// bare "COMPLIANT" substring inside them, so the specific phrase always
// wins on its own.
const STATUS_PATTERN =
  /FULLY COMPLIANT|PARTIALLY COMPLIANT|NON-?COMPLIANT|NEEDS VERIFICATION|NOT YET (?:PROVIDED|VERIFIED)|PENDING VERIFICATION|COMPLIANT/i;

function splitRowByStatus(rowText: string): [requirement: string, status: string, methodology: string] {
  const match = rowText.match(STATUS_PATTERN);
  if (!match || match.index === undefined) return [rowText.trim(), "", ""];
  return [
    rowText.slice(0, match.index).trim(),
    match[0].toUpperCase(),
    rowText.slice(match.index + match[0].length).trim(),
  ];
}

// Recovers row boundaries from sequential "1. ", "2. ", "3. " markers even
// when they're embedded in one unbroken run of text with no line breaks or
// other separators at all — exactly what a table pasted in as plain text
// from a rendered source (a Word/PDF table, an export from elsewhere) looks
// like once its cell and row separators get stripped. Matching strictly in
// sequence (1, then 2, then 3, ...) avoids treating an unrelated decimal
// elsewhere in the prose (e.g. "$2M" or "2.5") as a row marker.
function extractSequentialRows(content: string): string[] | null {
  const rows: string[] = [];
  let cursor = 0;
  let n = 1;

  while (true) {
    const marker = `${n}. `;
    const start = content.indexOf(marker, cursor);
    if (start === -1) break;

    const nextStart = content.indexOf(`${n + 1}. `, start + marker.length);
    const rowText = (nextStart === -1 ? content.slice(start + marker.length) : content.slice(start + marker.length, nextStart)).trim();
    rows.push(rowText);

    if (nextStart === -1) break;
    cursor = nextStart;
    n++;
  }

  return rows.length > 0 ? rows : null;
}

// Compliance-matrix content is usually pipe-delimited (a header row naming
// the columns, then one data row per requirement) — that's how the
// auto-draft template writes it, and it's tried first since it's an exact,
// unambiguous parse. Real admin-pasted content doesn't always keep that
// formatting, though (copying a rendered table as plain text often
// collapses every cell into one continuous run with no separators at all),
// so this falls back to recovering rows from their sequential numbering
// and splitting each on its status keyword instead of giving up and
// dumping the whole thing as one paragraph. Either way, the surrounding
// "[DRAFT — ...]" warning paragraph the auto-draft template adds is
// dropped, the same way capability statement drops its own preamble.
function extractTableRows(content: string): { head: string[]; rows: string[][] } | null {
  const pipeLines = content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.includes("|"));
  if (pipeLines.length >= 2) {
    const toCells = (line: string) => line.split("|").map((cell) => cell.trim());
    return { head: toCells(pipeLines[0]), rows: pipeLines.slice(1).map(toCells) };
  }

  const sequentialRows = extractSequentialRows(content);
  if (!sequentialRows) return null;
  const rows = sequentialRows.map((rowText, i) => {
    const [requirement, status, methodology] = splitRowByStatus(rowText);
    return [`${i + 1}. ${requirement}`, status, methodology];
  });
  return { head: MATRIX_HEAD, rows };
}

export function generateDeliverablesPacket(
  submission: SubmissionInfo,
  deliverables: Deliverable[]
): jsPDF {
  const doc = new jsPDF();
  const marginX = 20;
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 20;

  function checkPageBreak(neededSpace: number) {
    if (y + neededSpace > pageHeight - 20) {
      doc.addPage();
      y = 20;
    }
  }

  function heading(text: string) {
    checkPageBreak(15);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(text, marginX, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
  }

  function paragraph(text: string) {
    const lines = doc.splitTextToSize(text || "—", 170);
    for (const line of lines) {
      checkPageBreak(7);
      doc.text(line, marginX, y);
      y += 6;
    }
    y += 4;
  }

  // One labeled block within a page — smaller/bolder than a page heading,
  // used for the capability statement's Core Competencies / Past
  // Performance / Differentiators / etc. subsections.
  function subheading(text: string) {
    checkPageBreak(12);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(text, marginX, y);
    y += 6;
    doc.setFont("helvetica", "normal");
  }

  // Standard one-page capability-statement format: Core Competencies, Past
  // Performance, Differentiators, Company Data, Certifications/Set-Asides,
  // Contact Info — each its own labeled block instead of one long
  // paragraph. Company Data / Certifications / Contact Info come from the
  // client's actual structured fields (never invented); Core Competencies
  // and Differentiators come from the auto-drafted content when it has
  // those markers, otherwise fall back to whatever the admin wrote, or an
  // explicit bracketed gap — same "never fabricate, leave a visible gap"
  // rule the compliance matrix already follows.
  function renderCapabilityStatement(deliverable: Deliverable | undefined) {
    const client = submission.clients;
    const rawContent = deliverable?.content ?? "";
    const hasStructuredMarkers = /^(core competencies|differentiators):/im.test(rawContent);

    const coreCompetencies =
      extractSection(rawContent, "Core Competencies", ["Differentiators"]) ??
      (hasStructuredMarkers ? null : rawContent.trim() || null);
    const differentiators = extractSection(rawContent, "Differentiators", []);

    subheading("Core Competencies");
    paragraph(coreCompetencies || "[Summarize the company's core service lines relevant to this scope.]");

    subheading("Past Performance");
    paragraph("[Add past performance references — prior contracts, client references, relevant project history.]");

    subheading("Differentiators");
    paragraph(differentiators || "[What sets this company apart for this agency and scope — certifications, track record, capacity.]");

    subheading("Company Data");
    const naics =
      client?.naics_codes && client.naics_codes.length > 0 ? client.naics_codes.join(", ") : "[NAICS codes]";
    paragraph(`Primary NAICS Codes: ${naics}`);
    if (isFederalAgency(submission.agency)) {
      paragraph("UEI: [UEI]  |  CAGE Code: [CAGE code]");
    }
    paragraph(`State registration: [registration #]  |  Local business license: ${client?.license_number || "[license #]"}`);
    paragraph(
      `Years in Business: ${
        client?.years_in_business !== null && client?.years_in_business !== undefined
          ? `${client.years_in_business} years`
          : "[years in business]"
      }`
    );
    paragraph(
      `Insurance: ${client?.insurance_provider || "[insurance provider]"}${
        client?.insurance_policy_number ? ` (Policy #${client.insurance_policy_number})` : ""
      }  |  General Liability: ${client?.general_liability_coverage || "[GL coverage amount]"}  |  Workers' Comp: ${
        client?.workers_comp_coverage || "[workers' comp coverage]"
      }`
    );

    subheading("Certifications / Set-Asides");
    // Only a certification an admin has actually reviewed and marked
    // Verified appears in the delivered PDF — an unverified upload is a
    // claim the client made, not something to put in front of an agency.
    const verifiedLabels = (client?.client_certifications ?? [])
      .filter((cert) => cert.verified)
      .map(certificationLabel);
    const statuses = verifiedLabels.length > 0 ? verifiedLabels.join(", ") : null;
    const setAsides = client?.set_asides && client.set_asides.length > 0 ? client.set_asides.join(", ") : null;
    paragraph(
      [statuses, setAsides ? `Set-asides: ${setAsides}` : null].filter(Boolean).join(" | ") ||
        "[Small-business certifications and set-asides]"
    );

    subheading("Contact Info");
    paragraph(client?.company_name ?? "[Company name]");
    paragraph(
      [client?.contact_name, client?.phone, client?.email].filter(Boolean).join("  |  ") ||
        "[Contact name, phone, email]"
    );
    paragraph(
      [client?.business_address, client?.business_phone].filter(Boolean).join("  |  ") ||
        "[Business address, business phone]"
    );
  }

  // Renders as an actual table — it's called a "matrix" for a reason, and
  // a wall of pipe-delimited text under a heading isn't one. Falls back to
  // the plain-paragraph treatment (same as compliance_matrix / technical
  // narrative used before this format existed) if the content doesn't
  // parse as a table, e.g. an admin replaced it with free-form prose.
  function renderComplianceMatrix(deliverable: Deliverable | undefined) {
    const table = deliverable?.content ? extractTableRows(deliverable.content) : null;
    if (!table) {
      paragraph(deliverable?.content || "Not yet prepared.");
      return;
    }

    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      head: [table.head],
      body: table.rows,
      styles: { font: "helvetica", fontSize: 9, cellPadding: 3, valign: "top" },
      headStyles: { fillColor: [68, 71, 77], textColor: 255, fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 30 } },
    });
    // autoTable renders on its own tracked position; hand our own y-cursor
    // back to wherever it actually finished so anything after this section
    // starts below the table instead of overlapping it.
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // Same "split by marker, one subheading + paragraph per piece" shape as
  // the other two sections, just keyed on numbered lines ("1. Title")
  // instead of "Label:" lines, since that's the actual format
  // technical-narrative content uses. No fixed placeholder text here (unlike
  // the other two) because there's no single generic fallback that would
  // apply to an arbitrary custom section title — the fallback is instead
  // to show whatever's there under one "Approach" heading.
  function renderTechnicalNarrative(deliverable: Deliverable | undefined) {
    const rawContent = deliverable?.content ?? "";
    if (!rawContent.trim()) {
      paragraph("Not yet prepared.");
      return;
    }

    const sections = extractNumberedSections(rawContent);
    if (sections.length === 0) {
      subheading("Approach");
      paragraph(rawContent);
      return;
    }

    for (const section of sections) {
      subheading(section.title);
      paragraph(section.body || "—");
    }
  }

  // Cover page
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Bid Package", marginX, y);
  y += 12;
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(submission.clients?.company_name ?? "Client", marginX, y);
  y += 10;

  heading("Bid Details");
  paragraph(`Agency: ${submission.agency}`);
  paragraph(`Solicitation #: ${submission.solicitation_number ?? "—"}`);
  paragraph(
    `Due date: ${submission.due_date ? new Date(submission.due_date).toLocaleDateString() : "—"}`
  );
  paragraph(`Scope: ${submission.scope ?? "—"}`);

  for (const type of ["capability_statement", "compliance_matrix", "technical_narrative"]) {
    const deliverable = deliverables.find((d) => d.deliverable_type === type);
    doc.addPage();
    y = 20;
    heading(DELIVERABLE_LABELS[type]);

    // A deliverable row is always either typed text or an uploaded file,
    // never both (DeliverablesPanel's upsert nulls out whichever field
    // wasn't just saved) — so this three-way split applies the same way
    // to all three types, same as before any of them had real formatting.
    if (deliverable?.content) {
      if (type === "capability_statement") renderCapabilityStatement(deliverable);
      else if (type === "compliance_matrix") renderComplianceMatrix(deliverable);
      else renderTechnicalNarrative(deliverable);
    } else if (deliverable?.file_url) {
      paragraph(`(Attached as a separate file: see uploaded document)`);
    } else {
      paragraph("Not yet prepared.");
    }
  }

  return doc;
}
