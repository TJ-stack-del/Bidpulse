// Shared by /api/preview-packet (the only place this actually runs) and
// nothing else -- one source of truth for what an unpaid client's sample
// preview shows, so it can never drift from what the server actually
// enforces. Deliberately NOT used to truncate anything client-side; see
// that route's own comment for why the gate has to live server-side.

export type SampleResult = {
  text: string;
  truncated: boolean;
};

const COMPLIANCE_MATRIX_SAMPLE_ROWS = 4;
const PROSE_SAMPLE_CHAR_CAP = 500;

function isTableRow(line: string): boolean {
  // Matches deliverables-packet.ts's own isTableRow exactly -- same
  // content, same parsing rule, so the sample and the real PDF never
  // disagree about what counts as a table row.
  return line.includes("|") && !line.startsWith("[");
}

function sampleProse(content: string): SampleResult {
  const blocks = content.split(/\n\s*\n/).filter((b) => b.trim());
  if (blocks.length === 0) return { text: content, truncated: false };

  const first = blocks[0].trim();
  const hardCapped = first.length > PROSE_SAMPLE_CHAR_CAP;
  const excerpt = hardCapped ? `${first.slice(0, PROSE_SAMPLE_CHAR_CAP).trimEnd()}…` : first;
  const truncated = blocks.length > 1 || hardCapped;

  return {
    text: truncated ? `${excerpt}\n\n… full version available after payment.` : excerpt,
    truncated,
  };
}

function sampleComplianceMatrix(content: string): SampleResult {
  const lines = content.split("\n");
  const out: string[] = [];
  let rowCount = 0;
  let totalRows = 0;

  for (const raw of lines) {
    const line = raw.trim();
    if (isTableRow(line)) {
      totalRows++;
      if (rowCount < COMPLIANCE_MATRIX_SAMPLE_ROWS) {
        out.push(raw);
        rowCount++;
      }
    } else if (rowCount === 0) {
      // Leading prose (the admin disclaimer, the trade-coverage note) kept
      // in full -- it's context, not the compliance work product itself,
      // and only ever appears before the table rows start.
      out.push(raw);
    }
  }

  const truncated = totalRows > COMPLIANCE_MATRIX_SAMPLE_ROWS;
  if (truncated) {
    out.push(`\n… ${totalRows - COMPLIANCE_MATRIX_SAMPLE_ROWS} more requirements — full matrix available after payment.`);
  }

  return { text: out.join("\n"), truncated };
}

export function sampleDeliverableContent(deliverableType: string, content: string | null): SampleResult {
  if (!content) return { text: "", truncated: false };

  // rate_sheet is the one deliverable where "a sample" and "the actual
  // thing being sold" coincide -- no partial reveal, same treatment as a
  // file-backed deliverable rather than a fragile price-masking regex.
  if (deliverableType === "rate_sheet") {
    return { text: "Pricing details available after payment.", truncated: true };
  }

  if (deliverableType === "compliance_matrix" && content.includes("|")) {
    return sampleComplianceMatrix(content);
  }

  return sampleProse(content);
}
