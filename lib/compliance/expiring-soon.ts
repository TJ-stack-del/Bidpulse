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

export function getExpiringSoon<
  T extends { id: string; verified: boolean; expiration_date: string | null }
>(records: T[], toLabel: (record: T) => string, windowDays = DEFAULT_WINDOW_DAYS): ExpiringRecord[] {
  const horizon = Date.now() + windowDays * 24 * 60 * 60 * 1000;
  return records
    .filter((r) => r.verified && !!r.expiration_date && new Date(r.expiration_date).getTime() <= horizon)
    .map((r) => ({ id: r.id, label: toLabel(r), expiration_date: r.expiration_date as string }))
    .sort((a, b) => new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime());
}
