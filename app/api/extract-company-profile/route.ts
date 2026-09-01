import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { COMMON_NAICS_CODES } from "@/lib/business-options";
import { detectDocumentKind, buildDocumentContent, UNSUPPORTED_FILE_TYPE_MESSAGE } from "@/lib/document-parsing";

export const runtime = "nodejs";

// Called from the Company Profile page and (optionally) the intake wizard's
// "About you" step — a client uploads a company-profile-type document
// (capability statement, business license packet, insurance certificates,
// certification letters, etc.) instead of hand-typing every Company Profile
// field. Separate route from extract-from-document/route.ts: that one reads
// an agency's RFP for bid-specific fields; this one reads the CLIENT's own
// paperwork for company facts. Different documents, different schemas,
// different consumers — kept as two routes rather than one branching on a
// "document type" flag.
const MAX_FILE_BYTES = 20 * 1024 * 1024;

// Matches CertificationsSection.tsx's actual list, not just the six federal
// SBA program types — JSEB and DBE/SDB are real first-class values already
// in use there (added for the JSEB/DBE-SDB funding-source hardening work),
// so extracted rows need to line up with what a client can already pick by
// hand rather than introducing a second, parallel vocabulary.
const CERT_TYPES = ["8(a)", "WOSB", "EDWOSB", "HUBZone", "SDVOSB", "VOSB", "JSEB", "DBE/SDB", "Other"] as const;

// The license_number/business_registration_number distinction is the one
// real fabrication risk here: a document that only states a Sunbiz Document
// Number could tempt a model into filling license_number with it just
// because "some number" was found. The prompt is deliberately explicit
// about the two being different things, not just differently named.
const SYSTEM_PROMPT = `You extract structured company-profile information from documents a small-business government contractor provides about their OWN company (capability statements, business license packets, insurance certificates, certification letters, corporate filings) — not from an agency's solicitation.

Read the provided document and respond with ONLY a single JSON object with exactly these keys:
- "companyName": the company's legal/business name, or null if not found
- "contactName": the name of a person associated with the business (owner, principal, authorized representative), or null if not found
- "businessPhone": the business phone number, or null if not found
- "businessAddress": the full business address, or null if not found
- "yearsInBusiness": a number, or null if not stated or not calculable from a founding date
- "naicsCodes": an array of JSON strings (e.g. "561720", not the bare number) for each NAICS code explicitly stated that exactly matches one of these codes: ${COMMON_NAICS_CODES.map((n) => n.code).join(", ")}. Empty array if none match.
- "naicsOther": if the document states a NAICS code NOT in that list, that one code as a string, otherwise null.
- "licenseNumber": the company's TRADE or OCCUPATIONAL license number (e.g. a contractor's license, a specialty trade license) — this is DIFFERENT from a state business-registration/incorporation number. Only fill this if the document explicitly labels a number as a trade/occupational/contractor license. Null if not found — do NOT put a Sunbiz Document Number, corporate filing number, or any other kind of registration number here.
- "businessRegistrationNumber": the company's STATE business-registration or corporate-filing number (e.g. a Florida Sunbiz Document Number, a Secretary of State filing number) — this is DIFFERENT from a trade license. Null if not found — do NOT put a trade/occupational license number here.
- "insuranceProvider": the insurance carrier/underwriter name, or null if not found.
- "insurancePolicyNumber": an insurance policy number, or null if not found.
- "generalLiabilityCoverage": the General Liability coverage amount as written in the document (e.g. "$1,000,000 per occurrence / $2,000,000 aggregate"), or null if not found.
- "workersCompCoverage": the Workers' Compensation coverage description as written, or null if not found.
- "commercialAutoCoverage": the Commercial Auto coverage description as written, or null if not found.
- "certifications": an array of objects, one per small-business/socioeconomic certification or industry accreditation actually stated in the document, each with:
  - "certType": exactly one of ${CERT_TYPES.join(", ")}. Use "JSEB" for a local/regional Jacksonville-area small or emerging business certification. Use "DBE/SDB" when the document states a Disadvantaged Business Enterprise and/or Small Disadvantaged Business certification (either term, or both). Use "Other" for anything else (a state MBE/WBE, an industry accreditation, any other local program).
  - "otherLabel": required when certType is "Other" — the certification's actual name/abbreviation (e.g. "MBE", "CIMS-GB"), otherwise null
  - "certificationNumber": the certification number if stated, otherwise null
  - "expirationDate": the expiration date in YYYY-MM-DD format if stated, otherwise null
  Empty array if no certifications are mentioned. Include EVERY certification actually stated — a document commonly lists more than one.

Only fill a field if the document actually states it — never guess or infer from context. Respond with nothing but that JSON object — no markdown code fences, no commentary.`;

type ExtractedCertification = {
  certType: (typeof CERT_TYPES)[number];
  otherLabel: string | null;
  certificationNumber: string | null;
  expirationDate: string | null;
};

type ExtractedProfile = {
  companyName: string | null;
  contactName: string | null;
  businessPhone: string | null;
  businessAddress: string | null;
  yearsInBusiness: number | null;
  naicsCodes: string[];
  naicsOther: string | null;
  licenseNumber: string | null;
  businessRegistrationNumber: string | null;
  insuranceProvider: string | null;
  insurancePolicyNumber: string | null;
  generalLiabilityCoverage: string | null;
  workersCompCoverage: string | null;
  commercialAutoCoverage: string | null;
  certifications: ExtractedCertification[];
};

function coerceFields(parsed: unknown): ExtractedProfile {
  const obj = (parsed ?? {}) as Record<string, unknown>;
  const asString = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null;
  const asNumber = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const knownNaics = COMMON_NAICS_CODES.map((n) => n.code);
  const asKnownArray = (v: unknown, known: readonly string[]) =>
    Array.isArray(v)
      ? v
          .map((x) => (typeof x === "string" ? x : typeof x === "number" ? String(x) : null))
          .filter((x): x is string => x !== null && known.includes(x))
      : [];

  const certifications: ExtractedCertification[] = Array.isArray(obj.certifications)
    ? obj.certifications
        .map((c): ExtractedCertification | null => {
          if (typeof c !== "object" || c === null) return null;
          const cc = c as Record<string, unknown>;
          const certType = typeof cc.certType === "string" && (CERT_TYPES as readonly string[]).includes(cc.certType)
            ? (cc.certType as ExtractedCertification["certType"])
            : null;
          if (!certType) return null;
          return {
            certType,
            otherLabel: asString(cc.otherLabel),
            certificationNumber: asString(cc.certificationNumber),
            expirationDate: asString(cc.expirationDate),
          };
        })
        .filter((c): c is ExtractedCertification => c !== null)
    : [];

  return {
    companyName: asString(obj.companyName),
    contactName: asString(obj.contactName),
    businessPhone: asString(obj.businessPhone),
    businessAddress: asString(obj.businessAddress),
    yearsInBusiness: asNumber(obj.yearsInBusiness),
    naicsCodes: asKnownArray(obj.naicsCodes, knownNaics),
    naicsOther: asString(obj.naicsOther),
    licenseNumber: asString(obj.licenseNumber),
    businessRegistrationNumber: asString(obj.businessRegistrationNumber),
    insuranceProvider: asString(obj.insuranceProvider),
    insurancePolicyNumber: asString(obj.insurancePolicyNumber),
    generalLiabilityCoverage: asString(obj.generalLiabilityCoverage),
    workersCompCoverage: asString(obj.workersCompCoverage),
    commercialAutoCoverage: asString(obj.commercialAutoCoverage),
    certifications,
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File is too large (20MB max)." }, { status: 400 });
  }

  const kind = detectDocumentKind(file.type, file.name);
  if (!kind) {
    return NextResponse.json({ error: UNSUPPORTED_FILE_TYPE_MESSAGE }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const built = await buildDocumentContent(kind, buffer, "Extract the fields described in the system prompt from this document.");
  if ("error" in built) {
    return NextResponse.json({ error: built.error }, { status: 400 });
  }

  const anthropic = new Anthropic();
  let message: Anthropic.Message;
  try {
    message = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 1536,
      output_config: { effort: "low" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: built.content }],
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Extraction is busy right now — try again shortly." }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      console.error("[extract-company-profile] APIError", err.status, err.message);
      return NextResponse.json({ error: "Extraction failed." }, { status: 502 });
    }
    throw err;
  }

  const textBlock = message.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!textBlock) {
    return NextResponse.json({ error: "Couldn't extract anything from that document." }, { status: 502 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(textBlock.text.trim());
  } catch {
    return NextResponse.json({ error: "Couldn't parse the extraction result." }, { status: 502 });
  }

  return NextResponse.json(coerceFields(parsed));
}
