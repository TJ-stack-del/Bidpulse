// UEI/CAGE codes are SAM.gov federal-registration identifiers — asking for
// them by default made every draft look federal even for a city/county/
// authority bid (the common case for this app's actual clients so far).
// Keyword match against the agency name, defaulting to false (i.e. drop
// them) unless the agency clearly signals federal — a municipality, school
// district, or local authority name never matches any of these.
//
// Shared (not server-only) since both the generate-draft route and the
// client-bundled PDF packet generator need the identical determination —
// a federal bid must never show CAGE/UEI in one place and omit it in the
// other.
const FEDERAL_AGENCY_PATTERN =
  /\b(federal|u\.?s\.?\s+(government|department|army|navy|air force|marine corps|coast guard)|department of (defense|veterans affairs|homeland security|energy|justice|state|treasury|agriculture|labor|commerce|education|interior|transportation|housing and urban development)|\bGSA\b|general services administration|\bNASA\b|veterans affairs|army corps of engineers|defense logistics agency|sam\.gov)\b/i;

export function isFederalAgency(agency: string): boolean {
  return FEDERAL_AGENCY_PATTERN.test(agency);
}
