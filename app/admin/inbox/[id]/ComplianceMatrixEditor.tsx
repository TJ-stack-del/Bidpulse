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

// A row only reads as "confirmed" once an admin has actually landed on one
// of the three terminal calls below -- NEEDS VERIFICATION/NOT YET PROVIDED
// are exactly the two starting states generate-draft always writes (see
// that route's own comment), so leaving a row on either of those must keep
// counting as pending even after any bracket text in it has been edited
// away.
const TERMINAL_STATUSES = ["COMPLIANT", "NOT COMPLIANT", "NOT APPLICABLE"];

// Same badge language as computePreflightSummary's own checks on this same
// page (bg-secondary-container = ok, bg-tertiary-container = attention) --
// this reuses that vocabulary per-row instead of inventing a new one.
const STATUS_STYLES: Record<string, string> = {
  "NEEDS VERIFICATION": "bg-tertiary-container text-on-tertiary-container",
  "NOT YET PROVIDED": "bg-tertiary-container text-on-tertiary-container",
  COMPLIANT: "bg-secondary-container text-on-secondary-container",
  "NOT COMPLIANT": "bg-error-container text-on-error-container",
  "NOT APPLICABLE": "bg-surface-container-high text-on-surface-variant",
};

const PLACEHOLDER_RE = /\[[^\[\]]+\]/;

// No fixed-height scroll box -- this app's other cards (Bid details,
// Client info) let text wrap at its natural height instead of hiding it
// behind an internal scrollbar, and a 2-row textarea made every longer
// requirement/methodology line scroll inside its own tiny box. A rough
// chars-per-line estimate is enough; it only has to avoid the scrollbar,
// not be exact.
function autoRows(text: string): number {
  return Math.max(1, Math.min(4, Math.ceil((text.length || 1) / 56)));
}

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
  const confirmedCount = allRows.filter(
    (r) =>
      TERMINAL_STATUSES.includes(r.status) &&
      !PLACEHOLDER_RE.test(r.requirement) &&
      !PLACEHOLDER_RE.test(r.methodology)
  ).length;

  function updateRow(segIndex: number, rowIndex: number, field: keyof ComplianceRow, newValue: string) {
    const next = segments.map((seg, si) => {
      if (si !== segIndex || seg.kind !== "table") return seg;
      return { ...seg, rows: seg.rows.map((r, ri) => (ri === rowIndex ? { ...r, [field]: newValue } : r)) };
    });
    onChange(serializeSegments(next));
  }

  return (
    <div className="flex flex-col gap-2">
      <span
        className={`self-start inline-flex items-center gap-1 px-2 py-0.5 rounded text-label-sm font-bold uppercase tracking-wider ${
          confirmedCount === allRows.length
            ? "bg-secondary-container text-on-secondary-container"
            : "bg-tertiary-container text-on-tertiary-container"
        }`}
      >
        <span className="material-symbols-outlined text-[14px]">
          {confirmedCount === allRows.length ? "check_circle" : "fact_check"}
        </span>
        {confirmedCount} of {allRows.length} rows confirmed
      </span>

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
          <div key={si} className="flex flex-col gap-1.5">
            {seg.rows.map((row, ri) => {
              const confirmed =
                TERMINAL_STATUSES.includes(row.status) && !PLACEHOLDER_RE.test(row.requirement) && !PLACEHOLDER_RE.test(row.methodology);
              const statusKnown = Object.prototype.hasOwnProperty.call(STATUS_STYLES, row.status);
              return (
                <div
                  key={ri}
                  className={`rounded-lg border bg-surface p-2 flex flex-col gap-1.5 ${
                    confirmed ? "border-outline-variant" : "border-tertiary/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span
                        className={`material-symbols-outlined text-[15px] shrink-0 ${
                          confirmed ? "text-secondary" : "text-tertiary"
                        }`}
                      >
                        {confirmed ? "check_circle" : "radio_button_unchecked"}
                      </span>
                      <textarea
                        value={row.requirement}
                        onChange={(e) => updateRow(si, ri, "requirement", e.target.value)}
                        disabled={disabled}
                        rows={autoRows(row.requirement)}
                        placeholder="Requirement (from the RFP)"
                        className="flex-1 min-w-0 bg-transparent text-label-md text-on-surface font-bold outline-none resize-none disabled:opacity-60 leading-snug py-0.5"
                      />
                    </div>
                    <select
                      value={statusKnown ? row.status : ""}
                      onChange={(e) => updateRow(si, ri, "status", e.target.value)}
                      disabled={disabled}
                      className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border-0 outline-none disabled:opacity-60 ${
                        statusKnown ? STATUS_STYLES[row.status] : "bg-surface-container-high text-on-surface-variant"
                      }`}
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
                  </div>
                  <textarea
                    value={row.methodology}
                    onChange={(e) => updateRow(si, ri, "methodology", e.target.value)}
                    disabled={disabled}
                    rows={autoRows(row.methodology)}
                    placeholder="Methodology & verification notes"
                    className="w-full ml-[21px] px-2 py-1 rounded border border-outline-variant bg-surface-container-low text-label-sm text-on-surface-variant focus:border-primary focus:text-on-surface outline-none resize-none disabled:opacity-60 leading-snug"
                    style={{ width: "calc(100% - 21px)" }}
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
