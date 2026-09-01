import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Combines whatever deliverables have been prepared for a submission
// into one real, downloadable PDF — following actual capability
// statement conventions (short bullets and real tables, never long
// flowing paragraphs) instead of dumping everything as wrapped text.

type Deliverable = {
  deliverable_type: string;
  content: string | null;
  file_url: string | null;
};

type SubmissionInfo = {
  agency: string;
  solicitation_number: string | null;
  due_date: string | null;
  scope: string | null;
  clients: { company_name: string } | null;
};

const DELIVERABLE_LABELS: Record<string, string> = {
  capability_statement: "Capability Statement",
  compliance_matrix: "Compliance Matrix",
  technical_narrative: "Technical Narrative",
  rate_sheet: "Rate Sheet",
  executive_cover: "Executive Cover",
  certificate_of_insurance: "Certificate of Insurance",
};

const FULL_ORDER = ["capability_statement", "compliance_matrix", "technical_narrative"];
const LEAN_ORDER = ["rate_sheet", "executive_cover", "certificate_of_insurance"];

// Renders plain text as real bullets and properly spaced paragraphs,
// instead of one long wrapped block. Recognizes lines starting with
// "- " or "•" as bullet items; blank lines start a new paragraph.
function renderStructuredText(doc: jsPDF, text: string, marginX: number, startY: number): number {
  let y = startY;
  const pageHeight = doc.internal.pageSize.getHeight();
  const lines = (text || "—").split("\n");

  function checkPageBreak(needed: number) {
    if (y + needed > pageHeight - 20) {
      doc.addPage();
      y = 20;
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      y += 3; // paragraph gap
      continue;
    }

    const isBullet = line.startsWith("- ") || line.startsWith("• ");
    const text = isBullet ? line.replace(/^[-•]\s*/, "") : line;
    const indent = isBullet ? marginX + 5 : marginX;
    const wrapWidth = isBullet ? 165 : 170;

    const wrapped = doc.splitTextToSize(text, wrapWidth);
    for (let i = 0; i < wrapped.length; i++) {
      checkPageBreak(6);
      const prefix = isBullet && i === 0 ? "•  " : isBullet ? "   " : "";
      doc.text(prefix + wrapped[i], indent, y);
      y += 5.5;
    }
  }
  return y;
}

export function generateDeliverablesPacket(
  submission: SubmissionInfo,
  deliverables: Deliverable[]
): jsPDF {
  const doc = new jsPDF();
  const marginX = 20;
  let y = 20;

  function sectionHeading(text: string) {
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(text, marginX, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
  }

  // Cover
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Bid Package", marginX, y);
  y += 10;
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(submission.clients?.company_name ?? "Client", marginX, y);
  y += 9;

  sectionHeading("Bid Details");
  doc.setFontSize(10);
  doc.text(`Agency: ${submission.agency}`, marginX, y);
  y += 5.5;
  doc.text(`Solicitation #: ${submission.solicitation_number ?? "—"}`, marginX, y);
  y += 5.5;
  doc.text(
    `Due date: ${submission.due_date ? new Date(submission.due_date).toLocaleDateString() : "—"}`,
    marginX,
    y
  );
  y += 5.5;
  y = renderStructuredText(doc, `Scope: ${submission.scope ?? "—"}`, marginX, y);

  // Lean and full deliverable sets are mutually exclusive for a given
  // submission (DeliverablesPanel only ever shows one set at a time) — pick
  // whichever one actually has rows, so a lean-package submission doesn't
  // also get three "Not yet prepared" pages for the full-set types it never
  // used.
  const isLean = deliverables.some((d) => LEAN_ORDER.includes(d.deliverable_type));
  const order = isLean ? LEAN_ORDER : FULL_ORDER;

  for (const type of order) {
    const deliverable = deliverables.find((d) => d.deliverable_type === type);
    doc.addPage();
    y = 20;
    sectionHeading(DELIVERABLE_LABELS[type]);

    if (!deliverable?.content) {
      doc.text(deliverable?.file_url ? "(Attached as a separate file)" : "Not yet prepared.", marginX, y);
      continue;
    }

    if (type === "compliance_matrix" && deliverable.content.includes("|")) {
      // Real content mixes plain prose (the admin disclaimer, the client-facing
      // trade-coverage note when it applies, the trailing scope reference) with
      // pipe-delimited rows (Requirement | Status | Methodology). Walk the
      // content in its own original order, rendering each contiguous run of
      // table rows as a real autoTable and each contiguous run of prose as
      // regular text — a prior version of this only ever rendered the table
      // and silently dropped every surrounding prose line, which would have
      // dropped the client-facing trade-coverage note from the actual
      // downloaded PDF (it would still show in the in-app preview, since that
      // renders deliverable.content as plain text with no such filtering).
      const lines = deliverable.content.split("\n");
      let i = 0;
      let renderedAnyTable = false;
      while (i < lines.length) {
        const isTableRow = (line: string) => line.includes("|") && !line.startsWith("[");
        if (isTableRow(lines[i].trim())) {
          const rows: string[][] = [];
          while (i < lines.length && isTableRow(lines[i].trim())) {
            rows.push(lines[i].trim().split("|").map((cell) => cell.trim()));
            i++;
          }
          autoTable(doc, {
            startY: y,
            head: [["Requirement", "Status", "Methodology & Verification"]],
            body: rows,
            styles: { fontSize: 9, cellPadding: 3 },
            headStyles: { fillColor: [30, 30, 30] },
            margin: { left: marginX, right: marginX },
          });
          renderedAnyTable = true;
          // jspdf-autotable attaches this at runtime; not in the plugin's
          // own type declarations, hence the cast.
          y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
        } else {
          const proseLines: string[] = [];
          while (i < lines.length && !isTableRow(lines[i].trim())) {
            proseLines.push(lines[i]);
            i++;
          }
          y = renderStructuredText(doc, proseLines.join("\n"), marginX, y);
        }
      }
      if (renderedAnyTable) continue;
    }

    renderStructuredText(doc, deliverable.content, marginX, y);
  }

  return doc;
}
