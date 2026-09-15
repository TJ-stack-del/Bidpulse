import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sampleDeliverableContent } from "@/lib/pdf/deliverable-sample";

// Called by PacketButtons.tsx only when viewerRole === "client" -- admin's
// own QC preview keeps calling buildDoc() directly, unchanged, full
// content, no gate (this route is never involved).
//
// The real reason this has to be a server route and not client-side
// truncation of an already-fetched result: "clients read their own
// deliverables" (schema.sql) has no payment condition in the policy
// itself -- an unpaid client's session can already SELECT full
// deliverables.content directly. Client-side truncation would only hide
// what's rendered; the full text would still cross the network in the
// fetch response, inspectable via devtools by exactly the audience with a
// reason to look. Using the service client here and checking payment
// status explicitly, before any content leaves the server, is what
// actually makes "sample until paid" true rather than cosmetic.
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

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!client) {
    return NextResponse.json({ error: "Client access required." }, { status: 403 });
  }

  const service = createServiceClient();

  const { data: submission } = await service
    .from("submissions")
    .select(
      "agency, solicitation_number, due_date, scope, package_id, client_id, clients!submissions_client_id_fkey(company_name, contact_name, email, phone, naics_codes, set_asides, license_number, years_in_business, business_address, business_phone, insurance_provider, insurance_policy_number, general_liability_coverage, workers_comp_coverage, client_certifications(cert_type, other_label, verified))"
    )
    .eq("id", submissionId)
    .maybeSingle();

  if (!submission || submission.client_id !== client.id) {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }

  const { data: deliverablesRaw } = await service
    .from("deliverables")
    .select("deliverable_type, content, file_url")
    .eq("submission_id", submissionId);

  const pkg = submission.package_id
    ? (
        await service
          .from("packages")
          .select("paid, package_type")
          .eq("id", submission.package_id)
          .maybeSingle()
      ).data
    : null;
  const isPaidOrPilot = !!pkg && (pkg.paid || pkg.package_type === "pilot");

  const deliverables = (deliverablesRaw ?? []).map((d) => {
    if (isPaidOrPilot) return d;
    const sample = sampleDeliverableContent(d.deliverable_type, d.content);
    // file_url stripped too, not just content -- an unpaid client's
    // browser has no reason to hold a real file's storage path at all,
    // even though nothing in the current preview modal signs/opens it.
    return { deliverable_type: d.deliverable_type, content: sample.text, file_url: null };
  });

  // package_id/client_id were only needed for this route's own ownership/
  // payment check -- never returned to the browser, same as every other
  // field this endpoint doesn't have a reason to expose.
  const { package_id: _packageId, client_id: _clientId, ...submissionForClient } = submission;

  return NextResponse.json({ submission: submissionForClient, deliverables, isPaidOrPilot });
}
