// Derived, not a table of its own -- a record is "expiring soon" only if
// it's both verified and within the window. An unverified record is
// incomplete, not expiring: surfacing it here would conflate two different
// problems (missing verification vs. a real document lapsing) under one
// banner.
const DEFAULT_WINDOW_DAYS = 30;

export type ExpiringRecord = {
  id: string;
  label: string;
  expiration_date: string;
};

// expiration_date is a DATE column ("2026-09-20", no time/zone) -- parsing
// it with plain `new Date(str)` reads it as UTC midnight, which silently
// shifts "today" by a day for any timezone behind UTC (this app's whole US
// market). Parsing the y/m/d parts directly and building a local-midnight
// Date keeps "expires today" meaning the viewer's own calendar day.
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = parseLocalDate(dateStr);
  return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

// Callers (app/dashboard/compliance/page.tsx) concatenate this across
// several tables and sort once over the combined list -- sorting here too
// would be redundant work over a list that's about to be re-sorted anyway.
export function getExpiringSoon<
  T extends { id: string; verified: boolean; expiration_date: string | null }
>(records: T[], toLabel: (record: T) => string, windowDays = DEFAULT_WINDOW_DAYS): ExpiringRecord[] {
  return records
    .filter((r) => r.verified && !!r.expiration_date && daysUntil(r.expiration_date) <= windowDays)
    .map((r) => ({ id: r.id, label: toLabel(r), expiration_date: r.expiration_date as string }));
}
