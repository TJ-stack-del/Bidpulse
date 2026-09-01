// Same keyword-matching approach as lib/federal-agency.ts — pattern against
// the agency name only, never scope text (free-form client input would
// produce false positives no one asked for).
//
// Shared so every place that reacts to agency type (the compliance-matrix
// generator and the fit-check practical-requirement flags) uses the
// identical determination for a given submission.
const AIRPORT_AGENCY_PATTERN = /\b(aviation|airports?|jaa)\b/i;
const SCHOOL_AGENCY_PATTERN = /\b(schools?|board of education|district)\b/i;
const TRANSIT_AGENCY_PATTERN = /\b(transit|transportation authority|jta)\b/i;

// Deliberately NOT a bare \bva\b — "VA" alone is also the USPS state
// abbreviation for Virginia, which shows up in ordinary agency names
// ("City of Richmond, VA") with nothing to do with the Department of
// Veterans Affairs. Full "veterans affairs"/"veterans health
// administration" and the distinctive VAMC/VISN acronyms avoid that
// collision. This is intentionally narrower than "federal IT" — VA
// Handbook 6500.6 etc. are VA-specific policy, not something a generic
// DoD or other federal IT contract is bound by.
const VA_AGENCY_PATTERN = /\b(veterans affairs|veterans health administration|va medical center|vamc|va health care system|visn)\b/i;

export type AgencyType = "airport" | "school" | "transit" | "va";

export function detectAgencyTypes(agency: string): AgencyType[] {
  const types: AgencyType[] = [];
  if (AIRPORT_AGENCY_PATTERN.test(agency)) types.push("airport");
  if (SCHOOL_AGENCY_PATTERN.test(agency)) types.push("school");
  if (TRANSIT_AGENCY_PATTERN.test(agency)) types.push("transit");
  if (VA_AGENCY_PATTERN.test(agency)) types.push("va");
  return types;
}

// Unlike the agency-name-only patterns above, federal-funding language
// (a grant program name, or a plain statement that the project is
// federally funded) shows up in the bid's own scope/RFP text, not the
// agency's name — a transit/airport authority's name rarely says "FTA" or
// "FAA" in it even when a specific project is federally funded. Callers
// should pass scope text here, not the agency name.
//
// This distinguishes which set-aside program actually applies: JSEB is
// Jacksonville's own local certification, while DBE/SDB is the program
// federal transit/aviation funding requires — they are not interchangeable
// (lib/compliance/set-aside-eligibility.ts).
const FEDERAL_FUNDING_PATTERN =
  /\b(fta|faa|aip|federal transit administration|federal aviation administration|airport improvement program|federally funded|federal funding|federal grant)\b/i;

export function isFederallyFunded(bidText: string): boolean {
  return FEDERAL_FUNDING_PATTERN.test(bidText);
}
