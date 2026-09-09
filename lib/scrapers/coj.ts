import * as cheerio from "cheerio";
import type { ScrapedOpportunity } from "./jaa";

// City of Jacksonville's real listings live on Oracle Fusion Cloud
// Procurement (Oracle ADF), not on rfp.coj.net — confirmed via direct
// fetch 2026-09-02: rfp.coj.net/rfp/solicitation/SolicitationDefault.asp
// is legacy classic-ASP, currently showing "No solicitations are
// Available." with a literal `Response.Write"..."` template bug leaking
// into the page output. That's not our bug, it's just confirmation the
// page is stale/unmaintained — treat it as dead, nothing scrapes it.
const COJ_URL = "https://eims.fa.us2.oraclecloud.com/fscmUI/faces/NegotiationAbstracts?prcBuId=300000008806179";
const SOURCE_AGENCY = "City of Jacksonville";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Every "Details" link on the listing is an ADF commandLink
// (href="#", onclick-driven partial-page navigation), not a real
// bookmarkable per-row URL — clicking one would only ever produce a URL
// carrying the exact kind of session-scoped _afrLoop/_afrWindowId params
// noted below as unstable, so a "deep link" built that way wouldn't
// actually work in a later, different session anyway. source_url is the
// listing page itself for every row — the one link that's genuinely
// stable and where the client already showed us admins are expected to
// go to look something up (the page's own copy says a registered
// supplier has to log in to see full solicitation content).
//
// PREVIOUS VERSION of this file used playwright-core + @sparticuz/chromium
// (a real headless Chromium in the Vercel function) on the premise that a
// bare fetch() returns an empty shell with no solicitation rows — true,
// but the actual reason isn't "this page needs a JS-executing renderer,"
// it's a two-step Oracle ADF "loopback" redirect. Confirmed directly
// (real curl + Node fetch runs against the live page, 2026-09-09):
//   1. A cold GET returns a small bootstrap page containing a loopback
//      script. That script's whole job in a real browser is to compute
//      browser/media-feature params and reload the same URL with them
//      attached — but critically, `_afrLoop` itself is not one of the
//      client-computed values: it's a literal the SERVER already baked
//      into this response's own JS source
//      (`_addParam(query, "_afrLoop", "<value>")`), extractable with a
//      plain regex, no JS execution required.
//   2. Replaying the URL with that scraped `_afrLoop` (+ the session
//      cookie from step 1) gets a real 302 back, to a URL carrying a
//      *fresh*, server-issued `_afrLoop` and a real `_adf.ctrl-state` —
//      still no browser involved, just reading a redirect header.
//   3. Following that redirect (same cookie) returns the actual
//      data-filled page — the solicitation table is server-rendered
//      HTML, not loaded via a separate XHR/REST call (confirmed via a
//      real browser's own network capture: zero XHR/fetch requests
//      fired beyond the document navigations and a few icon images).
// This means cheerio (jaa.ts's approach) works fine here too, once that
// three-request sequence replaces the single fetch() — no headless
// Chromium, no @sparticuz/chromium, no Node.js-runtime-only function.
// Deliberately never hardcodes an `_afrLoop`/`_adf.ctrl-state` value —
// both are scraped fresh on every run, since they're per-request,
// server-issued tickets (confirmed: a fabricated `_afrLoop` value is
// rejected and just re-served the loopback shell).
async function fetchRenderedHtml(url: string): Promise<string> {
  let cookie = "";

  const res1 = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res1.ok) {
    throw new Error(`COJ loopback request failed: ${res1.status} ${res1.statusText}`);
  }
  const html1 = await res1.text();
  cookie = mergeCookies(cookie, res1);

  const afrLoopMatch = html1.match(/_addParam\(query,\s*"_afrLoop",\s*"(\d+)"\)/);
  if (!afrLoopMatch) {
    // The loopback script's shape changed, or Oracle reworked the page —
    // fail loudly rather than silently returning zero opportunities,
    // which the scrape route would otherwise log identically to "no new
    // listings today."
    throw new Error("COJ scraper: couldn't find _afrLoop in the loopback response — Oracle may have changed the page.");
  }
  const afrLoop = afrLoopMatch[1];

  const loopbackUrl = `${url}&_afrLoop=${afrLoop}&_afrWindowMode=0&_afrWindowId=null`;
  const res2 = await fetch(loopbackUrl, {
    headers: { "User-Agent": USER_AGENT, Cookie: cookie },
    redirect: "manual",
  });
  cookie = mergeCookies(cookie, res2);
  const location = res2.headers.get("location");
  if (res2.status !== 302 || !location) {
    throw new Error(`COJ scraper: expected a redirect after the loopback replay, got ${res2.status}.`);
  }

  const res3 = await fetch(location, { headers: { "User-Agent": USER_AGENT, Cookie: cookie } });
  if (!res3.ok) {
    throw new Error(`COJ final request failed: ${res3.status} ${res3.statusText}`);
  }
  return res3.text();
}

// Node's fetch (undici) exposes every Set-Cookie header via
// getSetCookie() — plain headers.get("set-cookie") would silently
// collapse multiple cookies (JSESSIONID, ORA_FUSION_PREFS,
// ORA_FND_SESSION_*, all three are actually set) into one malformed
// value. Merges into whatever cookie string is already held, rather
// than replacing it, since step 3 needs cookies from both step 1 and 2.
function mergeCookies(existing: string, response: Response): string {
  const jar = new Map<string, string>();
  for (const pair of existing.split("; ")) {
    if (!pair) continue;
    const [key, ...rest] = pair.split("=");
    if (key) jar.set(key, rest.join("="));
  }
  for (const raw of response.headers.getSetCookie()) {
    const [pair] = raw.split(";");
    const [key, ...rest] = pair.split("=");
    if (key) jar.set(key.trim(), rest.join("=").trim());
  }
  return Array.from(jar.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

export async function scrapeCoj(): Promise<ScrapedOpportunity[]> {
  const html = await fetchRenderedHtml(COJ_URL);
  const $ = cheerio.load(html);

  const opportunities: ScrapedOpportunity[] = [];

  // Columns confirmed via direct inspection 2026-09-03 (unchanged by
  // this rewrite): Solicitation Number, Title, Type, Status, Posting
  // Date, Open Date, Close Date, Details (icon-only, always empty text).
  // summary="Search Results" is ADF's own semantic attribute on the
  // result grid — deliberately not keyed off the surrounding CSS classes
  // (e.g. "x1hg x1i4" on the table, "xem"/"xen"/"x2ey" on rows/cells),
  // which are auto-generated by ADF's skin renderer and the more likely
  // thing to actually change if Oracle ever re-skins or upgrades this
  // app.
  $('table[summary="Search Results"] tbody tr').each((_, tr) => {
    const cells = $(tr)
      .find("td")
      .map((_, td) => $(td).text().trim())
      .get();
    const [solicitationNumber, title, , status, , , closeDate] = cells;
    if (!title) return;

    // Only "Active" is a real open opportunity to bid on — Closed,
    // Amended, and Awarded rows are all still returned by the same query
    // (this listing is a running log, not just open bids) and would
    // otherwise pollute matched_opportunities with things there's
    // nothing to do with. Amended is deliberately excluded too even
    // though it sounds active: on this page it means the amendment
    // itself needs review against whichever earlier row it amends, not
    // that this row is a fresh, unseen opportunity.
    if (status !== "Active") return;

    opportunities.push({
      source_title: title,
      source_agency: SOURCE_AGENCY,
      source_url: COJ_URL,
      due_date: parseCojDate(closeDate),
      solicitation_number: solicitationNumber || null,
    });
  });

  return opportunities;
}

// Listing shows "US Eastern Time" (page's own timezone label) as
// "9/17/26 9:58 AM" — M/D/YY h:mm AM/PM. Parsed as a plain local
// timestamp rather than precisely accounting for Eastern Time's exact
// UTC offset (which shifts with DST) — same tolerance jaa.ts already has
// for due_date (it leaves it null rather than guess); this is already
// strictly better than that, and an admin verifies the exact time by
// opening source_url regardless.
function parseCojDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;

  const [, monthStr, dayStr, yearStr, hourStr, minuteStr, meridiem] = match;
  const month = Number(monthStr);
  const day = Number(dayStr);
  const year = 2000 + Number(yearStr);
  let hour = Number(hourStr) % 12;
  if (meridiem.toUpperCase() === "PM") hour += 12;
  const minute = Number(minuteStr);

  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
