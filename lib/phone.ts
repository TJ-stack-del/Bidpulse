// Shared by the intake wizard (account creation) and the login form
// (password and passwordless sign-in) — both let a client type either an
// email or a phone number into one field, so both need the same "which one
// is this" detection and the same phone normalization before it reaches
// Supabase auth.

export function isEmail(value: string): boolean {
  return value.includes("@");
}

// Best-effort normalization to E.164 for Supabase phone auth. Assumes a US
// number when no country code is given, since this client base is US-based
// local trade contractors — good enough for a first pass; a client entering
// a genuinely non-US number can still type it with a leading "+".
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}
