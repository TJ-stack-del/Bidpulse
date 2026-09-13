import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrExtractBidEstimationFacts, estimateContractValue } from "@/lib/bid-estimation";

// Same reasoning as extract-from-document/route.ts and generate-draft/
// route.ts's compliance-matrix path: this can trigger a real Claude
// document-extraction call against the submission's uploaded RFP file(s),
// which routinely takes past Vercel's default 10s serverless timeout.
export const runtime = "nodejs";
export const maxDuration = 60;

// Admin-only "Estimate from RFP" action for EstimatedValueInput.tsx. Never
// writes submissions.estimated_value itself -- returns a suggested number
// (or null, with a reason) for the admin to review and explicitly Save,
// same "never automatic" rule that field has always had. See
// lib/bid-estimation.ts's own header comment for why this can currently
// only ever surface a real, agency-stated ceiling rather than a
// benchmark-derived guess.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const submissionId = body?.submissionId;
  if (typeof submissionId !== "string") {
    return NextResponse.json({ error: "Invalid submissionId." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: member } = await supabase
    .from("team_members")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { data: submission } = await supabase
    .from("submissions")
    .select("id, bid_estimation_facts, bid_estimation_facts_extracted_at")
    .eq("id", submissionId)
    .maybeSingle();
  if (!submission) {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }

  const facts = await getOrExtractBidEstimationFacts(supabase, submission);
  if (!facts) {
    return NextResponse.json({ estimatedValue: null, reason: "no_rfp_document" });
  }

  const estimatedValue = estimateContractValue(facts);
  return NextResponse.json({
    estimatedValue,
    reason: estimatedValue === null ? "no_stated_ceiling" : undefined,
    facts,
  });
}
