"use client";

// The compliance matrix is the one deliverable an admin genuinely has to
// hand-verify line by line against the real RFP (see generate-draft's own
// header disclaimer) -- there's no LLM in this app and there isn't going to
// be one wired into a compliance claim. What was actually slow about that
// wasn't the verification itself, it was the editing mechanics: the matrix
// lived in one big <textarea> as strict pipe-delimited text
// ("Requirement | Status | Methodology", one per line, see
// deliverables-packet.ts's own parser for the same convention), so
// confirming a single row meant finding its line in a wall of text and
// hand-retyping it without breaking the pipe format. This renders the exact
// same content as a real per-row form -- a status dropdown instead of
// freetext, one row at a time -- and reserializes back to the identical
// pipe-delimited string on every edit, so nothing downstream (the PDF
// table renderer, the placeholder gate, Auto-draft) has to change at all.

export type ComplianceRow = { requirement: string; status: string; methodology: string };
type Segment = { kind: "prose"; text: string } | { kind: "table"; rows: ComplianceRow[] };

const STATUS_OPTIONS = ["NEEDS VERIFICATION", "NOT YET PROVIDED", "COMPLIANT", "NOT COMPLIANT", "NOT APPLICABLE"];

const PLACEHOLDER_RE = /\[[^\[\]]+\]/;

// Same row-detection rule as deliverables-packet.ts's PDF renderer: a
// pipe-delimited table row never starts with "[" (that's a bracketed prose
// disclaimer line, not a row), so the two stay in sync on what counts as a
// "row" vs. prose.
function isTableRow(line: string): boolean {
  return line.includes("|") && !line.startsWith("[");
}

function parseSegments(content: string): Segment[] {
  const lines = content.split("\n");
  const segments: Segment[] = [];
  let i = 0;
  while (i < lines.length) {
    if (isTableRow(lines[i].trim())) {
      const rows: ComplianceRow[] = [];
      while (i < lines.length && isTableRow(lines[i].trim())) {
        const [requirement = "", status = "", methodology = ""] = lines[i].trim().split("|").map((c) => c.trim());
        rows.push({ requirement, status, methodology });
        i++;
      }
      segments.push({ kind: "table", rows });
    } else {
      const proseLines: string[] = [];
      while (i < lines.length && !isTableRow(lines[i].trim())) {
        proseLines.push(lines[i]);
        i++;
      }
      segments.push({ kind: "prose", text: proseLines.join("\n") });
    }
  }
  return segments;
}

function serializeSegments(segments: Segment[]): string {
  return segments
    .map((seg) =>
      seg.kind === "prose" ? seg.text : seg.rows.map((r) => `${r.requirement} | ${r.status} | ${r.methodology}`).join("\n")
    )
    .join("\n");
}

export function hasParsableRows(content: string): boolean {
  return parseSegments(content).some((seg) => seg.kind === "table" && seg.rows.length > 0);
}

export function ComplianceMatrixEditor({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const segments = parseSegments(value);
  const allRows = segments.filter((s): s is Extract<Segment, { kind: "table" }> => s.kind === "table").flatMap((s) => s.rows);
  const unresolvedCount = allRows.filter(
    (r) => PLACEHOLDER_RE.test(r.requirement) || PLACEHOLDER_RE.test(r.status) || PLACEHOLDER_RE.test(r.methodology)
  ).length;

  function updateRow(segIndex: number, rowIndex: number, field: keyof ComplianceRow, newValue: string) {
    const next = segments.map((seg, si) => {
      if (si !== segIndex || seg.kind !== "table") return seg;
      return { ...seg, rows: seg.rows.map((r, ri) => (ri === rowIndex ? { ...r, [field]: newValue } : r)) };
    });
    onChange(serializeSegments(next));
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-label-md text-on-surface-variant">
        {allRows.length - unresolvedCount} of {allRows.length} rows confirmed
      </p>
      {segments.map((seg, si) =>
        seg.kind === "prose" ? (
          seg.text.trim() ? (
            <p
              key={si}
              className="text-label-sm text-on-surface-variant italic whitespace-pre-wrap border-l-2 border-outline-variant pl-3"
            >
              {seg.text.trim()}
            </p>
          ) : null
        ) : (
          <div key={si} className="flex flex-col gap-2">
            {seg.rows.map((row, ri) => {
              const rowUnresolved =
                PLACEHOLDER_RE.test(row.requirement) || PLACEHOLDER_RE.test(row.status) || PLACEHOLDER_RE.test(row.methodology);
              return (
                <div
                  key={ri}
                  className={`grid grid-cols-1 md:grid-cols-[2fr_1fr_2fr] gap-2 p-2 rounded border ${
                    rowUnresolved ? "border-tertiary bg-tertiary-container/20" : "border-outline-variant"
                  }`}
                >
                  <textarea
                    value={row.requirement}
                    onChange={(e) => updateRow(si, ri, "requirement", e.target.value)}
                    disabled={disabled}
                    rows={2}
                    placeholder="Requirement (from the RFP)"
                    className="px-2 py-1.5 rounded border border-outline-variant bg-surface text-label-md text-on-surface focus:border-primary outline-none resize-none disabled:opacity-60"
                  />
                  <select
                    value={STATUS_OPTIONS.includes(row.status) ? row.status : ""}
                    onChange={(e) => updateRow(si, ri, "status", e.target.value)}
                    disabled={disabled}
                    className="px-2 py-1.5 rounded border border-outline-variant bg-surface text-label-md text-on-surface focus:border-primary outline-none disabled:opacity-60"
                  >
                    <option value="" disabled>
                      Choose status…
                    </option>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={row.methodology}
                    onChange={(e) => updateRow(si, ri, "methodology", e.target.value)}
                    disabled={disabled}
                    rows={2}
                    placeholder="Methodology & verification notes"
                    className="px-2 py-1.5 rounded border border-outline-variant bg-surface text-label-md text-on-surface focus:border-primary outline-none resize-none disabled:opacity-60"
                  />
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
