import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFederalAward } from "@/lib/compliance/verify-federal-award";

export const runtime = "nodejs";

// Client-triggered ("Check federal records" button, PastPerformanceSection.tsx)
// real-time check against USASpending.gov's public API -- kept server-side
// so the external call and the deterministic matching logic
// (lib/compliance/verify-federal-award.ts) live in one place, not
// duplicated client-side, and so a client can never spoof their own
// verification_status by writing it directly (RLS on client_past_performance
// still allows a client to update their own row generally, but this route
// is the only path that ever writes 'confirmed_federal_award').
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const id = body?.id;
  if (typeof id !== "string") {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  const { data: client } = await supabase
    .from("clients")
    .select("id, company_name")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!client) {
    return NextResponse.json({ error: "No client record." }, { status: 403 });
  }

  const { data: entry } = await supabase
    .from("client_past_performance")
    .select("id, reference_client_name, contract_value")
    .eq("id", id)
    .eq("client_id", client.id)
    .maybeSingle();
  if (!entry) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const result = await checkFederalAward({
    companyName: client.company_name,
    referenceClientName: entry.reference_client_name,
    contractValue: entry.contract_value,
  });

  const nowIso = new Date().toISOString();
  const update =
    result.status === "confirmed_federal_award"
      ? { verification_status: "confirmed_federal_award" as const, verification_source: result.source, verification_checked_at: nowIso }
      : { verification_status: result.status, verification_source: null, verification_checked_at: nowIso };

  const { error: updateError } = await supabase.from("client_past_performance").update(update).eq("id", id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ status: update.verification_status });
}
