// Shared between app/dashboard/compliance/page.tsx (on-screen display) and
// app/api/compliance/export/route.ts (zip entry names) -- these started as
// separate private copies in each file and had already visibly diverged
// (the export route's own fallback used the raw `policy_type` enum value
// instead of a human label, e.g. "general_liability" instead of "General
// Liability" in a zip filename) by the time a review caught it. One source
// of truth for what to call each record type.
export const POLICY_TYPE_LABELS: Record<string, string> = {
  general_liability: "General Liability",
  workers_comp: "Workers' Comp",
  commercial_auto: "Commercial Auto",
  professional_liability: "Professional Liability",
  umbrella: "Umbrella",
};

export function certificationLabel(c: {
  record_type: string;
  cert_type: string;
  other_label: string | null;
}): string {
  return c.record_type === "small_business_cert" && c.cert_type === "Other" ? c.other_label || "Other" : c.cert_type;
}

export function policyLabel(p: { policy_type: string }): string {
  return POLICY_TYPE_LABELS[p.policy_type] ?? p.policy_type;
}

export function bondingLabel(b: { surety_name: string | null }): string {
  return `Bond${b.surety_name ? ` — ${b.surety_name}` : ""}`;
}
