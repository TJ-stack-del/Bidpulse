// Shared checkbox option lists for the three client profile fields that used
// to be free-text comma lists (small_business_statuses, set_asides,
// naics_codes) — used by the intake wizard, the Company Profile page, and
// the document-extraction prompt, so all three stay in sync on exact label
// text instead of drifting into near-duplicate strings.

// Matches the client_certifications.cert_type values (schema.sql) where they
// overlap, so a status checked here reads the same as a certification typed
// there.
export const SMALL_BUSINESS_STATUSES = [
  "Small Business",
  "8(a)",
  "HUBZone",
  "WOSB",
  "EDWOSB",
  "SDVOSB",
  "VOSB",
  "MBE",
  "DBE",
  "SDB",
] as const;

// Only the set-asides common enough to be worth a checkbox everywhere else —
// local/regional set-asides (e.g. Jacksonville's JSEB) vary too much by
// jurisdiction to hardcode, so those go through the free-text "Other" field.
export const COMMON_SET_ASIDES = ["Total Small Business Set-Aside", "SDB Set-Aside"] as const;

// Scoped to this client base's actual trades (janitorial/HVAC/landscaping)
// plus the codes commonly bundled with them in government service
// contracts — not an attempt to cover all ~1,000 NAICS codes, hence the
// free-text "Other" fallback.
export const COMMON_NAICS_CODES: { code: string; label: string }[] = [
  { code: "561720", label: "Janitorial Services" },
  { code: "561790", label: "Other Services to Buildings and Dwellings" },
  { code: "561740", label: "Carpet and Upholstery Cleaning Services" },
  { code: "561730", label: "Landscaping Services" },
  { code: "238220", label: "Plumbing, Heating, and Air-Conditioning Contractors" },
  { code: "238290", label: "Other Building Equipment Contractors" },
  { code: "561210", label: "Facilities Support Services" },
];
