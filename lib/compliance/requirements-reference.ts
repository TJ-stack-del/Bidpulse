// Reference data for the compliance-matrix generator (app/api/generate-draft/route.ts,
// compliance_matrix branch). Three tiers:
//
//   ALWAYS_MANDATORY        — appears on every compliance matrix regardless of scope text.
//                              Standard paperwork almost every FL local/state/federal bid
//                              requires from a small trade contractor.
//   CONDITIONAL_REQUIREMENTS — only appears when its trigger phrase is actually present in
//                              the bid's own scope text. Never defaulted to required.
//   TRADE_SPECIFIC_CERTIFICATIONS — same trigger-gated rule as conditional, scoped to
//                              trade/facility-type keywords (landscaping/pesticide, HVAC
//                              refrigerant handling, detention/medical facility).
//
// None of this asserts a requirement is confirmed or that the client meets it — every row
// this produces stays "NEEDS VERIFICATION" with a bracketed instruction to confirm against
// the real RFP, same fabrication safeguard as the rest of buildDraft().

export type RequirementCategory = "mandatory" | "conditional" | "trade_specific";

type RequirementDefinition = {
  id: string;
  label: string;
  verificationNote: string;
};

type TriggeredRequirementDefinition = RequirementDefinition & {
  triggerKeywords: string[];
};

export const ALWAYS_MANDATORY: RequirementDefinition[] = [
  {
    id: "general-liability-insurance",
    label: "General Liability Insurance Certificate",
    verificationNote: "[Confirm a current certificate of insurance meets the agency's minimum coverage amount before submission]",
  },
  {
    id: "workers-comp-insurance",
    label: "Workers' Compensation Insurance Certificate (or exemption)",
    verificationNote: "[Confirm current workers' comp coverage or a valid FL exemption is on file before submission]",
  },
  {
    id: "w9",
    label: "W-9 / Taxpayer ID Certification",
    verificationNote: "[Confirm a current signed W-9 is on file before submission]",
  },
  {
    id: "local-business-tax-receipt",
    label: "Local Business Tax Receipt / Occupational License",
    verificationNote: "[Confirm the business tax receipt is current and covers the jurisdiction where work will be performed]",
  },
  {
    id: "signed-bid-form",
    label: "Signed Bid/Proposal Form",
    verificationNote: "[Confirm the agency's own bid/proposal form is signed by an authorized representative before submission]",
  },
  {
    id: "addenda-acknowledgment",
    label: "Acknowledgment of All Addenda",
    verificationNote: "[Confirm every addendum issued for this solicitation has been acknowledged in writing before submission]",
  },
  {
    id: "references",
    label: "References / Past Performance",
    verificationNote: "[Confirm the agency's required number of references are gathered and formatted per the RFP's instructions]",
  },
];

export const CONDITIONAL_REQUIREMENTS: TriggeredRequirementDefinition[] = [
  {
    id: "bid-bond",
    label: "Bid Bond",
    triggerKeywords: ["bid bond"],
    verificationNote: "[Confirm the required bid bond amount/percentage and arrange it with a surety before submission]",
  },
  {
    id: "performance-payment-bond",
    label: "Performance & Payment Bond",
    triggerKeywords: ["performance bond", "payment bond", "performance and payment bond"],
    verificationNote: "[Confirm performance and payment bond amounts and arrange them with a surety before contract award]",
  },
  {
    id: "prevailing-wage",
    label: "Prevailing Wage / Davis-Bacon Wage Certification",
    triggerKeywords: ["prevailing wage", "davis-bacon", "davis bacon"],
    verificationNote: "[Confirm the applicable wage determination and certified payroll requirements before submission]",
  },
  {
    id: "e-verify",
    label: "E-Verify Enrollment / Affidavit",
    triggerKeywords: ["e-verify", "e verify", "everify"],
    verificationNote: "[Confirm E-Verify enrollment and complete the required affidavit before submission]",
  },
  {
    id: "background-check",
    label: "Employee Background Check",
    triggerKeywords: ["background check", "background screening"],
    verificationNote: "[Confirm the specific background-check standard required (e.g. Level 2) and screen assigned staff before work begins]",
  },
  {
    id: "mandatory-site-visit",
    label: "Mandatory Pre-Bid Site Visit Acknowledgment",
    triggerKeywords: ["mandatory site visit", "mandatory pre-bid", "pre-bid conference"],
    verificationNote: "[Confirm attendance at the mandatory site visit/pre-bid conference is documented — missing it can disqualify the bid]",
  },
];

export const TRADE_SPECIFIC_CERTIFICATIONS: TriggeredRequirementDefinition[] = [
  {
    id: "pesticide-applicator-license",
    label: "Florida Pesticide Applicator License (Limited Landscape/Ornamental & Turf)",
    triggerKeywords: ["pesticide", "herbicide", "fertiliz", "landscap", "turf", "lawn care", "ornamental", "weed control"],
    verificationNote: "[Confirm the assigned applicator holds a current FDACS Limited Landscape/Ornamental & Turf license before treatments begin]",
  },
  {
    id: "irrigation-contractor-registration",
    label: "Irrigation Contractor Registration",
    triggerKeywords: ["irrigation"],
    verificationNote: "[Confirm irrigation work is performed by a registered/licensed irrigation contractor per local requirements]",
  },
  {
    id: "epa-608-refrigerant",
    label: "EPA Section 608 Refrigerant Handling Certification",
    triggerKeywords: ["hvac", "refrigerant", "air condition", "chiller"],
    verificationNote: "[Confirm assigned technicians hold current EPA Section 608 certification before servicing refrigerant equipment]",
  },
  {
    id: "bloodborne-pathogen-training",
    label: "Bloodborne Pathogen Exposure Control Training",
    triggerKeywords: ["detention", "correctional", "jail", "inmate", "medical facility", "healthcare", "clinic", "hospital"],
    verificationNote: "[Confirm assigned staff complete bloodborne pathogen exposure control training before entering the facility]",
  },
  {
    id: "prea-compliance",
    label: "PREA (Prison Rape Elimination Act) Compliance Acknowledgment",
    triggerKeywords: ["detention", "correctional", "jail", "inmate"],
    verificationNote: "[Confirm PREA training/acknowledgment requirements for contractor staff with facility access before work begins]",
  },
  {
    id: "hipaa-awareness",
    label: "HIPAA Privacy/Security Awareness",
    triggerKeywords: ["medical facility", "healthcare", "hipaa", "clinic", "hospital", "patient"],
    verificationNote: "[Confirm assigned staff complete HIPAA privacy/security awareness training before servicing areas with patient information]",
  },
];

export type MatchedRequirement = {
  id: string;
  label: string;
  category: RequirementCategory;
  matchedKeyword: string | null;
  verificationNote: string;
};

function findKeywordMatch(text: string, keywords: string[]): string | null {
  return keywords.find((keyword) => text.includes(keyword)) ?? null;
}

// Matches strictly against the client's own scope text — same rule as the
// rest of buildDraft(): never invents a requirement, only surfaces one that
// the bid text (mandatory tier) or the client's own words (conditional/trade
// tiers) actually support.
export function matchRequirements(bidText: string): MatchedRequirement[] {
  const text = bidText.toLowerCase();
  const matched: MatchedRequirement[] = ALWAYS_MANDATORY.map((req) => ({
    id: req.id,
    label: req.label,
    category: "mandatory" as const,
    matchedKeyword: null,
    verificationNote: req.verificationNote,
  }));

  for (const req of CONDITIONAL_REQUIREMENTS) {
    const hit = findKeywordMatch(text, req.triggerKeywords);
    if (hit) {
      matched.push({ id: req.id, label: req.label, category: "conditional", matchedKeyword: hit, verificationNote: req.verificationNote });
    }
  }

  for (const req of TRADE_SPECIFIC_CERTIFICATIONS) {
    const hit = findKeywordMatch(text, req.triggerKeywords);
    if (hit) {
      matched.push({ id: req.id, label: req.label, category: "trade_specific", matchedKeyword: hit, verificationNote: req.verificationNote });
    }
  }

  return matched;
}

const CATEGORY_STATUS_LABEL: Record<RequirementCategory, string> = {
  mandatory: "MANDATORY — NEEDS VERIFICATION",
  conditional: "CONDITIONAL — NEEDS VERIFICATION",
  trade_specific: "TRADE-SPECIFIC — NEEDS VERIFICATION",
};

// Formats matchRequirements() output as the same strict pipe-delimited rows
// (Requirement | Status | Methodology & Verification) the rest of buildDraft()
// produces, so the packet PDF's autoTable parser (lib/pdf/deliverables-packet.ts)
// renders these identically to every other row in the matrix. The category
// goes in the Status column so mandatory items read distinctly from
// conditional/trade-specific ones instead of being lumped together.
export function referenceRequirementRows(bidText: string): string[] {
  return matchRequirements(bidText).map((req) => {
    const status = CATEGORY_STATUS_LABEL[req.category];
    const note =
      req.category === "mandatory"
        ? req.verificationNote
        : `${req.verificationNote} (flagged because the scope text mentions "${req.matchedKeyword}")`;
    return `${req.label} | ${status} | ${note}`;
  });
}
