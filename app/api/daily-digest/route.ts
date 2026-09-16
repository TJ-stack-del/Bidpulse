import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/send";
import { getDailyDigestEmail } from "@/lib/email/templates";

// Cron-triggered (see vercel.json) — no browser session exists to check
// RLS against, so this uses the service_role key exactly like
// app/api/scrape/route.ts, never exposed outside a server route.
//
// The "48-hour promise" clock: starts at submitted_at (set the moment a
// client finishes intake — see IntakeWizard.tsx), or created_at as a
// fallback for submissions an admin creates directly from a matched
// opportunity (MatchesPanel.tsx never sets submitted_at). It's breached
// once a submission has sat in 'submitted' or 'in_review' — i.e. hasn't
// reached deliverables_ready yet — for more than 48 hours from that point.
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = serviceClient();

  // Single-tenant model (see schema.sql's RLS comments) — same one-org
  // assumption app/api/scrape/route.ts already makes.
  const { data: org, error: orgError } = await supabase.from("organizations").select("id").limit(1).single();
  if (orgError || !org) {
    return NextResponse.json({ error: "No organization set up yet." }, { status: 500 });
  }

  const { data: admins } = await supabase
    .from("team_members")
    .select("email")
    .eq("org_id", org.id)
    .eq("role", "admin");

  if (!admins || admins.length === 0) {
    return NextResponse.json({ sent: false, reason: "no_admins" });
  }

  const { data: submissions } = await supabase
    .from("submissions")
    .select("id, agency, stage, due_date, submitted_at, created_at, clients!inner(company_name, org_id)")
    .eq("is_test", false)
    .neq("stage", "closed")
    .eq("clients.org_id", org.id);

  // "Ghost signups": a clients row (a real account -- see IntakeWizard.tsx's
  // handleAboutYouNext) with zero NON-DRAFT submissions. Deliberately not
  // "zero submissions at all" -- handleAboutBidNext inserts a submission
  // row with draft: true the moment "About the bid" is filled in, before
  // the client ever finishes intake, so "any submission disqualifies" would
  // silently exclude someone who abandoned one step later than step 0 and
  // never actually submitted anything. app/admin/inbox/page.tsx already
  // treats draft rows as "not yet actionable" (its own .eq("draft", false)
  // filter) -- mirroring that same cutoff here is what actually closes the
  // gap instead of just moving it. Checked independently of the stale-items
  // logic below (not gated behind "only if there are open submissions") so
  // a quiet day with zero active bids doesn't also hide a real signup
  // sitting unnoticed. `clients` has no `is_test` column of its own (only
  // `submissions` does), so this can't filter out test client rows the
  // same way -- acceptable for now since test data is normally created
  // together with a test submission, which would disqualify it here anyway.
  const { data: allClientsInOrg } = await supabase
    .from("clients")
    .select("id, company_name, contact_name, email, phone, created_at")
    .eq("org_id", org.id);
  const { data: nonDraftSubmissionClientIds } = await supabase
    .from("submissions")
    .select("client_id")
    .eq("draft", false);
  const clientIdsWithNonDraftSubmission = new Set((nonDraftSubmissionClientIds ?? []).map((r) => r.client_id));
  const signupCheckNow = Date.now();
  const ghostSignups = (allClientsInOrg ?? [])
    .filter((c) => !clientIdsWithNonDraftSubmission.has(c.id))
    .map((c) => ({
      companyName: c.company_name,
      contactName: c.contact_name,
      email: c.email as string | null,
      phone: c.phone as string | null,
      daysSinceSignup: Math.floor((signupCheckNow - new Date(c.created_at).getTime()) / DAY_MS),
    }));

  if ((!submissions || submissions.length === 0) && ghostSignups.length === 0) {
    return NextResponse.json({ sent: false, reason: "nothing_open" });
  }

  const submissionIds = (submissions ?? []).map((s) => s.id);
  // .in() with an empty array is invalid SQL ("IN ()") -- guard rather
  // than let a ghost-signups-only day (no open submissions at all) throw
  // here instead of just skipping straight to an empty activity map.
  const { data: activity } =
    submissionIds.length > 0
      ? await supabase
          .from("audit_log")
          .select("submission_id, created_at")
          .in("submission_id", submissionIds)
          .order("created_at", { ascending: false })
      : { data: [] };

  const lastActivityBySubmission = new Map<string, string>();
  for (const row of activity ?? []) {
    if (!lastActivityBySubmission.has(row.submission_id)) {
      lastActivityBySubmission.set(row.submission_id, row.created_at);
    }
  }

  const now = Date.now();
  const staleItems = (submissions ?? [])
    .map((s) => {
      const client = s.clients as unknown as { company_name: string };
      const lastActivity = lastActivityBySubmission.get(s.id) ?? s.created_at;
      const daysSinceUpdate = Math.floor((now - new Date(lastActivity).getTime()) / DAY_MS);
      const daysUntilDue = s.due_date ? Math.ceil((new Date(s.due_date).getTime() - now) / DAY_MS) : null;

      const clockStart = s.submitted_at ?? s.created_at;
      const stillBeforeDeliverables = s.stage === "submitted" || s.stage === "in_review";
      const breachedTurnaround =
        stillBeforeDeliverables && now - new Date(clockStart).getTime() > FORTY_EIGHT_HOURS_MS;

      return {
        companyName: client.company_name,
        agency: s.agency,
        stage: s.stage,
        daysSinceUpdate,
        daysUntilDue,
        breachedTurnaround,
      };
    })
    // "Needs attention" = actually stale, OR urgent regardless of recency
    // (already breached the promise, or due soon) — matches the urgency
    // framing the digest template itself sorts by.
    .filter(
      (item) =>
        item.breachedTurnaround ||
        (item.daysUntilDue !== null && item.daysUntilDue <= 5) ||
        item.daysSinceUpdate * DAY_MS >= TWO_DAYS_MS
    );

  if (staleItems.length === 0 && ghostSignups.length === 0) {
    return NextResponse.json({ sent: false, reason: "nothing_stale" });
  }

  const email = getDailyDigestEmail(staleItems, ghostSignups);

  const results = await Promise.allSettled(
    admins.map((a) => sendEmail({ to: a.email, subject: email.subject, html: email.html }))
  );
  const failures = results
    .map((r, i) => (r.status === "rejected" ? { to: admins[i].email, error: String(r.reason) } : null))
    .filter((f): f is { to: string; error: string } => f !== null);

  return NextResponse.json({
    sent: failures.length < admins.length,
    recipients: admins.length,
    staleCount: staleItems.length,
    ghostSignupCount: ghostSignups.length,
    ...(failures.length > 0 ? { failures } : {}),
  });
}
