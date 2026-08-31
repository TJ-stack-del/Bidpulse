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

export type AgencyType = "airport" | "school" | "transit";

export function detectAgencyTypes(agency: string): AgencyType[] {
  const types: AgencyType[] = [];
  if (AIRPORT_AGENCY_PATTERN.test(agency)) types.push("airport");
  if (SCHOOL_AGENCY_PATTERN.test(agency)) types.push("school");
  if (TRANSIT_AGENCY_PATTERN.test(agency)) types.push("transit");
  return types;
}
