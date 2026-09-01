// Single source of truth for "is this bid in a trade BidPulse actually has
// real compliance coverage for" — used by both the admin-facing flag
// (app/admin/inbox/[id]/page.tsx) and the client-facing notes (the
// compliance_matrix deliverable content in generate-draft/route.ts, and the
// intake-time dashboard heads-up in app/dashboard/page.tsx), so all three
// check the exact same list instead of drifting independently.
//
// Update this list whenever a new vertical brief (like the IT/computer
// support one) ships real TRADE_SPECIFIC_CERTIFICATIONS coverage.
//
// Two signals, either one is sufficient:
//   naicsCodes  — the client's own Company Profile NAICS codes, but ONLY
//                 for codes that are unambiguous for this one trade. NAICS
//                 238220 ("Plumbing, Heating, and Air-Conditioning
//                 Contractors") is deliberately NOT listed under HVAC here —
//                 it's the same shared code a pure plumbing contractor would
//                 pick from the Company Profile dropdown (there's no
//                 separate plumbing checkbox), so it can't by itself confirm
//                 HVAC. HVAC is confirmed by scope-text keywords only.
//   keywords    — checked against the SUBMISSION's own scope text (same
//                 plain-substring matching TRADE_SPECIFIC_CERTIFICATIONS
//                 uses), since that's specific to this bid rather than the
//                 client's general profile.
export const KNOWN_TRADES: { id: string; label: string; naicsCodes: string[]; keywords: string[] }[] = [
  {
    id: "hvac",
    label: "HVAC",
    naicsCodes: [],
    keywords: ["hvac", "air condition", "refrigerant", "chiller", "heat pump", "ductwork", "heating and cooling"],
  },
  {
    id: "janitorial",
    label: "Janitorial",
    naicsCodes: ["561720"],
    keywords: ["janitorial", "custodial", "day porter", "cleaning services"],
  },
  {
    id: "landscaping",
    label: "Landscaping / Grounds Maintenance",
    naicsCodes: ["561730"],
    keywords: ["landscap", "turf", "lawn care", "ornamental", "irrigation", "grounds maintenance", "mowing"],
  },
  {
    id: "it-computer-support",
    label: "IT / Computer Support",
    naicsCodes: ["541512", "541519", "518210"],
    keywords: [
      "computer support",
      "it support",
      "information technology",
      "network administ",
      "help desk",
      "software development",
      "web application",
      "cybersecurity",
      "desktop support",
    ],
  },
];

// naicsCodes: the client's Company Profile codes (clients.naics_codes).
// scopeText: this specific submission's scope, not the client's profile —
// a bid's own wording is what TRADE_SPECIFIC_CERTIFICATIONS reacts to, so
// this check reasons about the same text.
export function isKnownTrade(input: { naicsCodes: string[]; scopeText: string }): boolean {
  const text = input.scopeText.toLowerCase();
  return KNOWN_TRADES.some(
    (trade) =>
      trade.naicsCodes.some((code) => input.naicsCodes.includes(code)) ||
      trade.keywords.some((keyword) => text.includes(keyword))
  );
}
