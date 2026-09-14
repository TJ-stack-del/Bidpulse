// Shared by every route/lib that asks Claude for a JSON object/array back
// (extract-from-document, extract-company-profile, inbound-bid-email,
// rfp-requirements, bid-estimation) -- all five had the exact same fragile
// `JSON.parse(textBlock.text.trim())` and the exact same silent failure
// mode: a model faithfully quoting multi-line text straight from a PDF
// (e.g. a label that wraps across lines in the source document) produces a
// literal, unescaped newline inside a JSON string value, which is invalid
// JSON and throws. Every caller's catch block then discards the entire
// result, even though the extraction itself was correct -- turning "a
// label wrapped across two lines in the PDF" into "this feature silently
// returned nothing." Real, observed case: a Jacksonville RFP's own
// "Submission Due\nDate" table cell caused a full compliance-matrix
// extraction to come back empty.
//
// Fix is a plain preprocessing pass, not a smarter prompt: walk the raw
// text once, and inside (and only inside) an actual JSON string literal,
// replace a literal newline/carriage-return/tab with its escaped form. A
// small state machine, not a regex, because it has to track whether it's
// currently inside a string and whether the previous character was an
// unescaped backslash (so `\"` inside a string doesn't end it early).

function sanitizeControlCharsInJsonStrings(text: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        out += ch;
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        out += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
        out += ch;
        continue;
      }
      if (ch === "\n") {
        out += "\\n";
        continue;
      }
      if (ch === "\r") {
        out += "\\r";
        continue;
      }
      if (ch === "\t") {
        out += "\\t";
        continue;
      }
      out += ch;
      continue;
    }
    if (ch === '"') inString = true;
    out += ch;
  }
  return out;
}

// Try a normal parse first (the common case, and strictly correct when it
// works); only fall back to the sanitizing pass -- and only re-attempt
// parsing once -- on a genuine failure. Returns null rather than throwing,
// matching every caller's existing "no result" fallback behavior.
export function parseLlmJson<T = unknown>(rawText: string): T | null {
  const text = rawText.trim();
  try {
    return JSON.parse(text) as T;
  } catch {
    try {
      return JSON.parse(sanitizeControlCharsInJsonStrings(text)) as T;
    } catch {
      return null;
    }
  }
}
