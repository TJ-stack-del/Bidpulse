// Broad, best-effort category tag for a matched opportunity's title/scope
// -- separate from lib/compliance/known-trades.ts's KNOWN_TRADES, which is
// specifically the narrower list of trades this app has real compliance
// coverage for. A matched opportunity can be almost any category a real
// government solicitation covers, most of which this app never builds
// compliance content for at all -- this exists purely so an admin scanning
// the Matched Opportunities queue can tell at a glance what kind of client
// a listing might fit, without reading the full scope text. Same
// never-guess discipline as everything else this app generates: returns
// null rather than a wrong or generic label when nothing actually matches,
// checked against the title first (most opportunities name their own
// category there) and the scope text only as a fallback.
const OPPORTUNITY_TRADE_TAGS: { label: string; keywords: string[] }[] = [
  { label: "Custodial / Janitorial", keywords: ["janitorial", "custodial", "day porter", "cleaning services"] },
  {
    label: "Landscaping / Grounds",
    keywords: ["landscap", "mowing", "mower", "turf", "lawn care", "grounds maintenance", "irrigation", "tree trim"],
  },
  {
    label: "Drainage / Civil",
    keywords: ["drainage", "stormwater", "culvert", "paving", "roadway", "sidewalk", "grading", "civil engineering"],
  },
  {
    label: "Medical Transport",
    keywords: ["medical transport", "ambulance", " ems ", "patient transport", "non-emergency transport"],
  },
  {
    label: "HVAC / Mechanical",
    keywords: ["hvac", "air condition", "chiller", "heat pump", "ductwork", "mechanical system"],
  },
  { label: "Electrical", keywords: ["electrical", "electrician", "switchgear", "lighting retrofit", "conduit"] },
  { label: "Plumbing", keywords: ["plumbing", "plumber", "backflow", "water line"] },
  { label: "Roofing", keywords: ["roofing", "roof replacement", "roof repair"] },
  { label: "Security Services", keywords: ["security guard", "security services", "access control system"] },
  {
    label: "IT / Software",
    keywords: [
      "software",
      "computer support",
      "network administ",
      "cybersecurity",
      "it support",
      "subscription",
      "application development",
      "help desk",
    ],
  },
  { label: "Food Service", keywords: ["food service", "catering", "cafeteria", "vending"] },
  { label: "Aquatics / Pool", keywords: ["swimming pool", "aquatic", "pool maintenance", "pool resurfac"] },
  { label: "Fleet / Equipment", keywords: ["fleet vehicle", "tractor", "equipment purchase", "vehicle purchase"] },
  { label: "Construction / Renovation", keywords: ["renovation", "remodel", "construction of", "building addition"] },
  {
    label: "Professional Services",
    keywords: ["consulting services", "professional services", "payroll", "tax services", "accounting services", "staffing services"],
  },
];

export function opportunityTradeTag(input: { title: string; scope?: string | null }): string | null {
  const title = input.title.toLowerCase();
  for (const tag of OPPORTUNITY_TRADE_TAGS) {
    if (tag.keywords.some((k) => title.includes(k))) return tag.label;
  }
  const scope = (input.scope ?? "").toLowerCase();
  if (scope) {
    for (const tag of OPPORTUNITY_TRADE_TAGS) {
      if (tag.keywords.some((k) => scope.includes(k))) return tag.label;
    }
  }
  return null;
}
