// Builds the pre-filled text for "Request info from client"
// (RequestInfoForm) — deliberately separate from generate-fit-check's
// assessFit(), which produces third-person analysis text for admin's own
// reading ("Palmetto Grounds & Facility Care, LLC has NAICS codes on file
// ..."). That text was never meant to be read by the client it's about,
// so this builds its own second-person, plain-language draft straight
// from the same underlying facts instead of reusing or rewriting
// assessFit's prose. Same 8th-grade reading level as every other
// client-facing template (lib/email/templates.ts).
//
// Only surfaces genuine gaps — nothing is said about facts already on
// file, since this drives a message asking the client for more info, not
// a status summary. Returns "" when nothing's missing, so the textarea
// starts blank and the admin writes their own message.

export function buildClientInfoRequestDraft(input: {
  naicsCodes: string[];
  scope: string | null;
  hasLicense: boolean;
  hasInsurance: boolean;
  hasVerifiedCertification: boolean;
}): string {
  const asks: string[] = [];

  if (input.naicsCodes.length === 0) {
    asks.push("Your NAICS codes — could you add them to your Company Profile?");
  }
  if (!input.scope || input.scope.trim().length < 40) {
    asks.push("A bit more detail on the scope of work for this bid — what you have now is pretty brief.");
  }
  if (!input.hasLicense) {
    asks.push("Your license number — you can add it under Company Profile.");
  }
  if (!input.hasInsurance) {
    asks.push("Your insurance details (provider and general liability coverage) — also under Company Profile.");
  }
  if (!input.hasVerifiedCertification) {
    asks.push(
      "If you hold a certification like WOSB, 8(a), or SDVOSB, upload it under Company Profile so our team can verify it."
    );
  }

  if (asks.length === 0) return "";

  return ["To keep moving on this bid, could you send us a few things:", ...asks.map((ask) => `- ${ask}`)].join("\n");
}
