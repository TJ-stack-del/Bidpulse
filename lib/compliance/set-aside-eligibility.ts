// Detects set-aside restriction language in a bid's own scope text and
// checks it against the client's VERIFIED certifications only (an
// unverified upload is a claim, never treated as fact here — same rule as
// generate-draft and the rest of generate-fit-check).
//
// This never states a fact about eligibility ("you are disqualified") — it
// only ever names the specific restriction text found and asks the admin to
// check it, because a set-aside phrase can be worded in ways this simple
// keyword match won't fully capture (partial set-asides, tiered
// preferences, etc.) and because certification status can change after the
// admin's last verification pass.

export type SetAsideRestriction = {
  id: string;
  label: string;
  // The client_certifications.cert_type this restriction is satisfied by,
  // or null when the restriction is about SBA business-size status, which
  // this app doesn't track anywhere and so can never be confirmed or ruled
  // out from client data alone.
  certType: string | null;
  matcher: RegExp;
};

// Matches the acronym/term near the words "set-aside" in either order
// (real postings write both "SDVOSB Set-Aside" and "Set-Aside Type: SDVOSB"),
// tolerating punctuation in between (e.g. "(SDVOSB) Set-Aside"). Anchored on
// \b so e.g. "vosb" never matches inside "sdvosb" — plain substring
// containment would (an earlier version of this file had exactly that bug:
// "sdvosb" ends in the letters "vosb").
function nearSetAside(term: string): RegExp {
  return new RegExp(`\\b${term}\\b[^a-z0-9]{0,20}set[- ]?aside|set[- ]?aside[^a-z0-9]{0,20}\\b${term}\\b`, "i");
}

export const SET_ASIDE_RESTRICTIONS: SetAsideRestriction[] = [
  { id: "8a-set-aside", label: "8(a) Set-Aside", certType: "8(a)", matcher: /8\s*\(\s*a\s*\)[^a-z0-9]{0,20}set[- ]?aside|set[- ]?aside[^a-z0-9]{0,20}8\s*\(\s*a\s*\)/i },
  { id: "hubzone-set-aside", label: "HUBZone Set-Aside", certType: "HUBZone", matcher: nearSetAside("hubzone") },
  { id: "edwosb-set-aside", label: "EDWOSB Set-Aside", certType: "EDWOSB", matcher: nearSetAside("edwosb") },
  { id: "wosb-set-aside", label: "WOSB Set-Aside", certType: "WOSB", matcher: nearSetAside("wosb") },
  { id: "sdvosb-set-aside", label: "SDVOSB Set-Aside", certType: "SDVOSB", matcher: nearSetAside("sdvosb") },
  { id: "vosb-set-aside", label: "VOSB Set-Aside", certType: "VOSB", matcher: nearSetAside("vosb") },
  {
    id: "total-small-business-set-aside",
    // Anchored to "total"/"100%" specifically (not bare "small business
    // set-aside") so this generic bucket doesn't also fire on every named
    // socioeconomic set-aside above, whose spelled-out forms often end in
    // the same words ("...small business set-aside").
    label: "Total Small Business Set-Aside",
    certType: null,
    matcher: /\btotal\b[^a-z0-9]{0,10}small business[^a-z0-9]{0,10}set[- ]?aside|100\s*%[^a-z0-9]{0,20}small business[^a-z0-9]{0,10}set[- ]?aside/i,
  },
];

export type EligibilityResult = { concern: boolean; explanation: string | null };

export function assessSetAsideEligibility(
  bidText: string,
  verifiedCerts: { cert_type: string; other_label: string | null }[]
): EligibilityResult {
  const verifiedCertTypes = new Set(verifiedCerts.map((c) => c.cert_type));
  const verifiedOtherLabels = new Set(
    verifiedCerts
      .filter((c): c is { cert_type: string; other_label: string } => c.cert_type === "Other" && !!c.other_label)
      .map((c) => c.other_label.toUpperCase())
  );

  const notes: string[] = [];
  for (const restriction of SET_ASIDE_RESTRICTIONS) {
    const match = bidText.match(restriction.matcher);
    if (!match) continue;
    const hit = match[0];

    if (restriction.certType === null) {
      notes.push(
        `The bid text references a "${restriction.label}" (matched: "${hit}") — this restricts eligibility to businesses that qualify as small under the SBA size standard for this solicitation's NAICS code. We don't track business-size status, so check this before pursuing: confirm the client's company actually qualifies as small under that standard.`
      );
      continue;
    }

    const hasMatchingCert =
      verifiedCertTypes.has(restriction.certType) || verifiedOtherLabels.has(restriction.certType.toUpperCase());
    if (!hasMatchingCert) {
      notes.push(
        `The bid text references a "${restriction.label}" (matched: "${hit}") — check this: there's no verified ${restriction.certType} certification on file for this client. Confirm whether the client actually holds this certification before pursuing the bid.`
      );
    }
  }

  return { concern: notes.length > 0, explanation: notes.length > 0 ? notes.join(" ") : null };
}
