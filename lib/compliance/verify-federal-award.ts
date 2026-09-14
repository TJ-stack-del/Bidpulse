// Real, scoped past-performance verification against USASpending.gov's
// public, no-auth API (confirmed live: /api/v2/autocomplete/recipient/,
// /api/v2/search/spending_by_award/ -- both tested directly against the
// real API before writing this, exact field names below match what it
// actually returns, not a guess).
//
// This only ever covers FEDERAL prime awards. There is no equivalent
// unified public API for state/local/school-district awards, which is
// most of this app's actual client work (the example RFPs this app
// already handles -- Jacksonville, Austin ISD -- are exactly that kind).
// A clean no-match here is the expected, common case, not a failure --
// callers must never present "self_reported" as if it were "unverified"
// or a red flag, and must never present a match as a guarantee (name
// matching against a public database is inherently fuzzy).
//
// Deterministic matching only, no LLM: this is a case-insensitive
// substring/name check against structured API results, not free-text
// interpretation.

const USASPENDING_BASE = "https://api.usaspending.gov/api/v2";

type SpendingByAwardResult = {
  "Award ID": string;
  "Recipient Name": string;
  "Awarding Agency": string;
  "Award Amount": number;
  Description: string | null;
  "Start Date": string | null;
  "End Date": string | null;
};

export type FederalAwardCheckResult =
  | { status: "confirmed_federal_award"; source: "usaspending.gov"; matchedAward: { id: string; agency: string; amount: number } }
  | { status: "self_reported" }
  | { status: "unconfirmed" };

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

// A reference like "City of Round Rock" should match an awarding agency
// like "City of Round Rock, Texas" or vice versa -- plain substring check
// on normalized text in both directions, nothing fuzzier (no edit
// distance / no LLM), since a false positive here would misrepresent a
// client's real record.
function plausiblyMatches(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

// contract_value is free text ("$185,000", "$1.2M/yr, ongoing") -- this
// extracts a rough numeric magnitude for a loose cross-check, not an exact
// parse. Returns null (skip the amount check entirely) rather than a wrong
// number when the text doesn't cleanly parse.
function roughAmount(text: string | null): number | null {
  if (!text) return null;
  const match = text.match(/\$?\s*([\d,.]+)\s*([kKmMbB])?/);
  if (!match) return null;
  const base = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(base)) return null;
  const suffix = match[2]?.toLowerCase();
  if (suffix === "k") return base * 1_000;
  if (suffix === "m") return base * 1_000_000;
  if (suffix === "b") return base * 1_000_000_000;
  return base;
}

export async function checkFederalAward(input: {
  companyName: string;
  referenceClientName: string;
  contractValue: string | null;
}): Promise<FederalAwardCheckResult> {
  let results: SpendingByAwardResult[];
  try {
    const res = await fetch(`${USASPENDING_BASE}/search/spending_by_award/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filters: {
          recipient_search_text: [input.companyName],
          award_type_codes: ["A", "B", "C", "D"],
          time_period: [{ start_date: "2007-10-01", end_date: new Date().toISOString().slice(0, 10) }],
        },
        fields: ["Award ID", "Recipient Name", "Awarding Agency", "Award Amount", "Description", "Start Date", "End Date"],
        page: 1,
        limit: 25,
        sort: "Award Amount",
        order: "desc",
      }),
    });
    if (!res.ok) return { status: "unconfirmed" };
    const data = (await res.json()) as { results?: SpendingByAwardResult[] };
    results = data.results ?? [];
  } catch {
    return { status: "unconfirmed" };
  }

  const roughValue = roughAmount(input.contractValue);

  const match = results.find((r) => {
    if (!plausiblyMatches(input.referenceClientName, r["Awarding Agency"])) return false;
    // Amount check only applied when the client actually stated one --
    // absent that, an agency-name match alone is enough signal.
    if (roughValue == null) return true;
    // Loose tolerance (half to double): a stated contract value is often
    // one option-year or one line item of a larger overall award.
    return r["Award Amount"] >= roughValue * 0.5 && r["Award Amount"] <= roughValue * 2;
  });

  if (!match) return { status: "self_reported" };

  return {
    status: "confirmed_federal_award",
    source: "usaspending.gov",
    matchedAward: { id: match["Award ID"], agency: match["Awarding Agency"], amount: match["Award Amount"] },
  };
}
