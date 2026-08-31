import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { detectAgencyTypes, type AgencyType } from "@/lib/agency-type";

// Called by the intake wizard right after the client's own final submit —
// no LLM wired up (same as generate-draft/route.ts), so this is a
// transparent readiness heuristic, not a prediction of winning. It answers
// "is this a well-formed, workable submission for us to start on," not
// "will you win this contract" — the two are deliberately kept distinct in
// both the logic and the copy below.
const DAY_MS = 24 * 60 * 60 * 1000;

type FitResult = { alignment: "strong" | "moderate" | "weak"; explanation: string };

// Same agency-type detection as the compliance matrix (lib/agency-type.ts) —
// one plain-language flag per signal, appended to the explanation. These are
// purely informational: never scored into the strong/moderate/weak tier,
// never blocking, and never a claim that the contractor does or doesn't
// meet the requirement — just naming a real thing to go confirm.
function agencyTypeFitNotes(agencyTypes: AgencyType[]): string[] {
  const notes: string[] = [];
  if (agencyTypes.includes("airport")) {
    notes.push(
      "This job is at a secured airport facility. Before pursuing this, confirm your team can pass TSA background checks and get SIDA badged."
    );
  }
  if (agencyTypes.includes("school")) {
    notes.push(
      "This job is with a school district. Before pursuing this, confirm your team can pass Level 2 background checks and meet the district's badging requirements."
    );
  }
  if (agencyTypes.includes("transit")) {
    notes.push(
      "This job is with a transit agency. Before pursuing this, confirm whether DBE (Disadvantaged Business Enterprise) participation goals apply to this project and whether your team can meet them."
    );
  }
  return notes;
}

function assessFit(input: {
  naicsCodes: string[];
  scope: string | null;
  dueDate: string | null;
  hasLicense: boolean;
  hasInsurance: boolean;
  verifiedCertLabels: string[];
  agencyTypes: AgencyType[];
}): FitResult {
  const hasProfile = input.naicsCodes.length > 0;
  const hasDetailedScope = !!input.scope && input.scope.trim().length >= 40;
  const daysUntilDue = input.dueDate ? Math.ceil((new Date(input.dueDate).getTime() - Date.now()) / DAY_MS) : null;
  const hasRunway = daysUntilDue === null || daysUntilDue >= 5;

  // The strong/moderate/weak tier stays scoped to exactly these three
  // submission-specific readiness signals, unchanged from before — that's
  // "is this particular bid well-formed enough for us to start on."
  // License/insurance/certifications are answered further down as
  // supplementary facts about the client's overall profile instead of
  // folded into this score, since a missing GL policy number doesn't mean
  // "this submission is a bad fit" the way a missing scope does.
  const passCount = [hasProfile, hasDetailedScope, hasRunway].filter(Boolean).length;
  const alignment: FitResult["alignment"] = passCount === 3 ? "strong" : passCount === 2 ? "moderate" : "weak";

  const notes: string[] = [];
  notes.push(
    hasProfile
      ? "You've given us your NAICS codes, which helps our team place this bid in the right context right away."
      : "We don't have your NAICS codes on file yet — adding them helps us tailor the paperwork faster."
  );
  notes.push(
    hasDetailedScope
      ? "The scope you described gives us enough detail to start preparing your paperwork."
      : "The scope description is pretty brief — we may follow up with a few questions before we can prepare a strong capability statement."
  );
  if (daysUntilDue !== null) {
    notes.push(
      hasRunway
        ? `With ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"} until the due date, there's reasonable time to prepare this properly.`
        : `The due date is only ${daysUntilDue <= 0 ? "very close" : `${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"} away`} — we'll move fast, but a tight timeline makes thorough prep harder.`
    );
  }

  // Company Profile completeness — informational, not scored. Only a
  // verified certification is ever named here; an unverified upload isn't
  // mentioned as if it were a fact.
  const missingProfileItems = [!input.hasLicense && "license number", !input.hasInsurance && "insurance details"].filter(
    (x): x is string => !!x
  );
  if (missingProfileItems.length > 0) {
    notes.push(`Adding your ${missingProfileItems.join(" and ")} to your Company Profile speeds up how quickly we can prepare your paperwork.`);
  }
  notes.push(
    input.verifiedCertLabels.length > 0
      ? `We also have your verified certification${input.verifiedCertLabels.length === 1 ? "" : "s"} on file (${input.verifiedCertLabels.join(", ")}), which we'll put to use where it strengthens this bid.`
      : "No verified certifications on file yet — if you hold any (WOSB, 8(a), SDVOSB, etc.), add them to your Company Profile so our team can confirm and use them."
  );

  notes.push(...agencyTypeFitNotes(input.agencyTypes));

  return { alignment, explanation: notes.join(" ") };
}

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

  // RLS-respecting read — only resolves if the caller is the owning client
  // or an admin in the org, which is exactly who's allowed to trigger this.
  const { data: submission } = await supabase
    .from("submissions")
    .select(
      "id, agency, scope, due_date, client_id, clients(naics_codes, license_number, insurance_provider, general_liability_coverage)"
    )
    .eq("id", submissionId)
    .maybeSingle();

  if (!submission) {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }

  const client = submission.clients as unknown as {
    naics_codes: string[] | null;
    license_number: string | null;
    insurance_provider: string | null;
    general_liability_coverage: string | null;
  } | null;

  // Same verified-only rule as generate-draft: an unverified certification
  // upload is a claim, never treated as fact here either.
  const { data: verifiedCerts } = await supabase
    .from("client_certifications")
    .select("cert_type, other_label")
    .eq("client_id", submission.client_id)
    .eq("verified", true);
  const verifiedCertLabels = (verifiedCerts ?? []).map((cert) =>
    cert.cert_type === "Other" ? cert.other_label || "Other" : cert.cert_type
  );

  const result = assessFit({
    naicsCodes: client?.naics_codes ?? [],
    scope: submission.scope,
    dueDate: submission.due_date,
    hasLicense: !!client?.license_number,
    hasInsurance: !!(client?.insurance_provider || client?.general_liability_coverage),
    verifiedCertLabels,
    agencyTypes: detectAgencyTypes(submission.agency ?? ""),
  });

  // The intake wizard calls this right after the client's own final submit,
  // which in that same action already flips draft to false — submissions'
  // RLS update policy only lets a client write while draft = true, so
  // persisting the result needs the service role even though the read
  // above already proved the caller is allowed to see this exact row.
  const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { error: updateError } = await service
    .from("submissions")
    .update({ fit_alignment: result.alignment, fit_explanation: result.explanation })
    .eq("id", submissionId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ fit_alignment: result.alignment, fit_explanation: result.explanation });
}
