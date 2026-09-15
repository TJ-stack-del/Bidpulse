// A separate metric from computeProfileCompleteness() (that one is
// presence-based across 8 fixed clients columns, already driving the
// dashboard's "X% complete" badge -- see app/dashboard/page.tsx). This one
// answers a different question: of the compliance records a client has
// actually added (certifications, insurance policies, bonding), how many
// has our team verified. A client with zero records is 0% ready, not
// 100% -- there's nothing to have verified yet, which is a real gap, not
// a completed state.
export type VerifiableRecord = { verified: boolean };

export function computeReadinessScore(records: VerifiableRecord[]): {
  percent: number;
  verifiedCount: number;
  total: number;
} {
  const total = records.length;
  const verifiedCount = records.filter((r) => r.verified).length;
  const percent = total === 0 ? 0 : Math.round((verifiedCount / total) * 100);
  return { percent, verifiedCount, total };
}
