import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { scrapeJaa, type ScrapedOpportunity } from "@/lib/scrapers/jaa";

// BUILD-ORDER-BIDPULSE.md Step 8: runs the scrapers and inserts whatever
// they find into matched_opportunities with assigned_client_id left null,
// so they show up unassigned in app/admin/matches/ for manual review —
// nothing here auto-assigns a client.
//
// JEA (jea.com) is deliberately not included: every URL on that domain,
// including the root, returns a CAPTCHA challenge page (confirmed against
// two independent fetch methods) — a server-side scraper can never get
// past that. Revisit if JEA ever offers a real feed/API.
const SCRAPERS: { name: string; run: () => Promise<ScrapedOpportunity[]> }[] = [
  { name: "jaa", run: scrapeJaa },
];

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

// Uses the service_role key, not the publishable/anon key from
// lib/supabase/*: this route is called by Vercel's cron, not a browser, so
// there's no user session for RLS's is_admin() to check against.
// service_role bypasses RLS entirely and must only ever be used
// server-side, in a route like this one — never in client.ts.
function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = serviceClient();

  const { data: org, error: orgError } = await supabase.from("organizations").select("id").limit(1).single();

  if (orgError || !org) {
    return NextResponse.json({ error: "No organization set up yet." }, { status: 500 });
  }

  const results: Record<
    string,
    { found: number; inserted: number; skipped: number; errors?: string[] }
  > = {};

  for (const scraper of SCRAPERS) {
    try {
      const found = await scraper.run();
      let inserted = 0;
      let skipped = 0;
      const insertErrors: string[] = [];

      for (const item of found) {
        // Re-running daily shouldn't create duplicate rows for a listing
        // that's still posted — skip anything already logged with the same
        // title + agency for this org.
        const { data: existing } = await supabase
          .from("matched_opportunities")
          .select("id")
          .eq("org_id", org.id)
          .eq("source_title", item.source_title)
          .eq("source_agency", item.source_agency)
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }

        const { error: insertError } = await supabase.from("matched_opportunities").insert({
          org_id: org.id,
          assigned_client_id: null,
          source_title: item.source_title,
          source_agency: item.source_agency,
          source_url: item.source_url,
          due_date: item.due_date,
          status: "new",
        });

        // Previously discarded silently on failure — a bad insert (e.g. a
        // missing column) looked identical to "nothing new found" in the
        // response, which is exactly what let this go unnoticed.
        if (insertError) {
          insertErrors.push(`${item.source_title}: ${insertError.message}`);
        } else {
          inserted++;
        }
      }

      results[scraper.name] = {
        found: found.length,
        inserted,
        skipped,
        ...(insertErrors.length > 0 ? { errors: insertErrors } : {}),
      };
    } catch (err) {
      results[scraper.name] = {
        found: 0,
        inserted: 0,
        skipped: 0,
        errors: [err instanceof Error ? err.message : "Unknown error"],
      };
    }
  }

  return NextResponse.json({ ok: true, results });
}
