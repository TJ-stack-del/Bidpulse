import Anthropic from "@anthropic-ai/sdk";
import { parseLlmJson } from "@/lib/llm-json";
import type { ScrapedOpportunity } from "./jaa";

// Two real, live, unauthenticated PDF forecast documents published by City
// of Jacksonville Public Works -- found and verified 2026-09-16 via direct
// fetch, not assumed: both return a real HTTP 200 on a plain CMS page
// (jacksonville.gov/departments/public-works/engineering-and-construction-
// management/prospective-bid-opportunities), unlike the interactive
// Oracle ADF/DemandStar/OpenGov portals this project separately hit hard
// bot-protection walls on for Clay County (Akamai WAF + Cloudflare JS
// challenge), St. Johns County (routes to a bare DemandStar SPA shell with
// no server-rendered data), and Duval County Public Schools (Finalsite
// "Client Challenge" bot page) -- see PROJECT-STATUS.md.
//
// A THIRD PDF on the same page ("Continuing Contract Forecast") is
// deliberately excluded here -- verified by direct read that it lists
// ALREADY-AWARDED contracts (vendor name, contract #, expiration date),
// not upcoming opportunities. Including it would pollute
// matched_opportunities with rows there's nothing to bid on, the same
// principle coj.ts already applies by filtering out non-"Active" rows.
//
// These URLs bake in the exact forecast window (PWEN-2026-Q3-2027-Q2) and
// WILL 404 once COJ republishes next quarter's forecast under a new
// filename -- that's not a hypothetical, it's the whole premise of a
// rolling forecast. When both fetches start failing, re-check
// https://www.jacksonville.gov/departments/public-works/engineering-and-
// construction-management/prospective-bid-opportunities for the current
// links rather than debugging a cold 404 from scratch.
const FORECAST_SOURCES = [
  {
    url: "https://www.jacksonville.gov/getContentAsset/7ed42c43-26d5-4d1a-bbc4-c8f868a45342/135b97c9-84fa-4e82-b956-0fbccec4aa1f/PWEN-2026-Q3-2027-Q2-Construction-Bid-Forecast.pdf?language=en",
    label: "Construction Bid Forecast",
    // Distinct per-source agency strings, not one shared constant --
    // app/api/scrape/route.ts dedupes new rows on (org_id, source_title,
    // source_agency). A shared agency string would let a same-named
    // project from the other forecast silently vanish as a "duplicate"
    // instead of being inserted as the real, separate row it is.
    agency: "City of Jacksonville — Public Works (Construction Bid Forecast)",
  },
  {
    url: "https://www.jacksonville.gov/getContentAsset/0d0a9ad3-c799-41aa-b7cb-033c78708c71/135b97c9-84fa-4e82-b956-0fbccec4aa1f/PWEN-2026-Q3-2027-Q2-Professional-Services-Forecast_ADA.pdf?language=en",
    label: "Professional Design Services Forecast",
    agency: "City of Jacksonville — Public Works (Professional Design Services Forecast)",
  },
] as const;

// Both real documents render as one consistent table per PDF, but with
// different columns between the two (Construction has a Project Number
// column; Professional Services doesn't) -- one flexible prompt covers
// both rather than two near-identical ones.
const SYSTEM_PROMPT = `You extract rows from a City of Jacksonville Public Works bid-forecast PDF. The document is a single table listing planned future projects, one row per project, with columns similar to: Quarter, Project Number (not always present), Project Name, Description, and a set-aside/participation column.

Respond with ONLY a JSON array, one object per table row, each with exactly these keys:
- "quarter": the quarter value for that row (e.g. "Q3 2026"), or null if not shown
- "projectNumber": the project/bid number for that row if the table has that column, or null if the table has no such column or the cell is blank
- "projectName": the project title/name — required, never null or empty
- "description": the full description text for that row, or null if blank

Skip the header row. Also skip any row that isn't a real project -- e.g. a quarter's row that just says something like "None currently scheduled," "TBD," or "No projects scheduled" instead of naming an actual project. Respond with nothing but the JSON array — no markdown code fences, no commentary.`;

type ForecastRow = {
  quarter: string | null;
  projectNumber: string | null;
  projectName: string;
  description: string | null;
};

// Real observed case, not hypothetical: a real quarter's row in the
// Professional Design Services Forecast reads "None currently scheduled."
// as its project name when nothing's planned for that quarter -- the
// system prompt already asks the model to skip these, but that's a
// request, not a guarantee, so this is a real code-level backstop rather
// than trusting prompt-following alone. Matches the same principle coj.ts
// already applies filtering out non-"Active" status rows: a placeholder
// saying "nothing here" must never become a fake opportunity.
const PLACEHOLDER_ROW_PATTERN = /^(none|n\/a|tbd)\b|no (projects?|opportunities) (are )?(currently )?scheduled/i;

function isPlaceholderRow(projectName: string): boolean {
  return PLACEHOLDER_ROW_PATTERN.test(projectName.trim());
}

// This is genuine free-text extraction (real column layout, wrapped
// multi-line cells, two different real column sets between the two
// documents), not a case where a deterministic parser would be more
// reliable -- matches this project's own "deterministic before LLM"
// standard, which reserves an LLM call for exactly this kind of
// unstructured-document case rather than for anything a plain parser
// could handle. Cost note, left explicit rather than silent: this runs
// once per PDF (2 small, low-effort calls) on /api/scrape's existing
// daily cron, even though these forecast documents only actually update
// quarterly -- accepted as a modest, bounded cost rather than adding a
// freshness-cache table to skip unchanged runs; revisit if that cost
// ever becomes a real concern.
async function extractForecastPdf(url: string): Promise<ForecastRow[]> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`COJ forecast fetch failed (${url}): ${res.status} ${res.statusText}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());

  const anthropic = new Anthropic();
  const message = await anthropic.messages.create({
    model: "claude-opus-5",
    // Real, measured need, not a guess: the 10-page Construction Bid
    // Forecast (~40 rows) needed more than 4096 output tokens and got
    // silently truncated mid-row at that cap during testing -- confirmed
    // via message.stop_reason === "max_tokens", not assumed. 8192 clears
    // that real document with real headroom to spare.
    max_tokens: 8192,
    output_config: { effort: "low" },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") },
          },
          { type: "text", text: "Extract every project row from this forecast table as described in the system prompt." },
        ],
      },
    ],
  });

  // A response cut off at the token cap produces a truncated JSON array
  // that parseLlmJson correctly can't parse -- without this check, that
  // silently became "zero rows extracted," identical to "this document has
  // no opportunities," which is exactly the kind of silent-failure gap
  // this codebase has already fixed once elsewhere (see
  // app/api/scrape/route.ts's own insertError comment). A future forecast
  // that grows past this budget must fail loudly, not vanish quietly.
  if (message.stop_reason === "max_tokens") {
    throw new Error(`COJ forecast extraction truncated at max_tokens for ${url} -- the source document may have grown; increase max_tokens.`);
  }

  // Every one of these is a real parse/shape failure, not "this document
  // genuinely has zero rows" -- must throw, not return [], or this
  // silently reintroduces the exact bug the max_tokens check above was
  // added to fix (a real failure indistinguishable from "nothing here").
  const textBlock = message.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!textBlock) {
    throw new Error(`COJ forecast extraction returned no text content for ${url}.`);
  }

  const parsed = parseLlmJson<unknown>(textBlock.text);
  if (!Array.isArray(parsed)) {
    throw new Error(`COJ forecast extraction returned unparseable or non-array JSON for ${url}.`);
  }

  return parsed
    .map((row): ForecastRow | null => {
      const obj = row as Record<string, unknown>;
      const projectName = typeof obj.projectName === "string" ? obj.projectName.trim() : "";
      if (!projectName || isPlaceholderRow(projectName)) return null;
      return {
        quarter: typeof obj.quarter === "string" ? obj.quarter : null,
        projectNumber: typeof obj.projectNumber === "string" ? obj.projectNumber : null,
        projectName,
        description: typeof obj.description === "string" ? obj.description.trim() : null,
      };
    })
    .filter((r): r is ForecastRow => r !== null);
}

export async function scrapeCojForecast(): Promise<ScrapedOpportunity[]> {
  // Run both PDFs concurrently, not sequentially -- app/api/scrape/route.ts
  // shares one 60s budget across every scraper, and two independent
  // Claude document calls have no reason to wait on each other.
  const results = await Promise.allSettled(FORECAST_SOURCES.map((source) => extractForecastPdf(source.url)));

  const opportunities: ScrapedOpportunity[] = [];
  const errors: string[] = [];

  // Each source handled independently -- one PDF failing to parse (a
  // format change, a transient API error) shouldn't discard real,
  // successfully-extracted rows from the other.
  results.forEach((result, i) => {
    const source = FORECAST_SOURCES[i];
    if (result.status === "rejected") {
      errors.push(`${source.label}: ${result.reason instanceof Error ? result.reason.message : "Unknown error"}`);
      return;
    }
    for (const row of result.value) {
      opportunities.push({
        source_title: row.projectName,
        source_agency: source.agency,
        source_url: source.url,
        // A forecast row describes planned future work, not yet a posted
        // solicitation with a real submission deadline -- left null
        // rather than guessed, same precedent as jaa.ts.
        due_date: null,
        solicitation_number: row.projectNumber,
        // Plain client-facing prose, not an internal "[Q3 2026]" bracket
        // tag -- MatchesPanel.tsx's assign flow copies this verbatim into
        // submissions.scope, which renders raw and unexplained directly to
        // the CLIENT (SubmissionCard.tsx, dashboard/page.tsx). A bracket
        // prefix that only makes sense in an admin context has no business
        // being the first thing on a client's job description.
        scope: row.description
          ? `${row.description}${row.quarter ? ` Planned for ${row.quarter}.` : ""}`
          : null,
      });
    }
  });

  if (opportunities.length === 0 && errors.length > 0) {
    throw new Error(`COJ forecast scraper: both sources failed — ${errors.join("; ")}`);
  }

  // A source failing here is a real, notable event even when the other
  // source's rows make the overall call look "successful" -- app/api/
  // scrape/route.ts only ever sees this scraper's returned row count, with
  // no way to know one of two independent sources silently failed today.
  // Logged rather than silently dropped; not thrown, since the successful
  // source's real rows still deserve to be inserted.
  if (errors.length > 0) {
    console.error("[coj-forecast] partial failure — one source failed while another succeeded", errors);
  }

  return opportunities;
}
