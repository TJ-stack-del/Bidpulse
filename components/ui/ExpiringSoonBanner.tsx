import { daysUntil, parseLocalDate, type ExpiringRecord } from "@/lib/compliance/expiring-soon";

// Same visual pattern as the tertiary "note about your trade" banner on
// app/dashboard/SubmissionCard.tsx for the not-yet-due case. An already-
// expired *verified* record is a real compliance failure happening right
// now, not a heads-up -- that gets the app's error treatment instead
// (bg-error-container/10 border-error/30, same as SubmissionCard's one
// genuine-failure banner), both at the container level (if anything here
// has already lapsed) and per-row.
export function ExpiringSoonBanner({ records }: { records: ExpiringRecord[] }) {
  if (records.length === 0) return null;

  const expiredCount = records.filter((r) => daysUntil(r.expiration_date) < 0).length;
  const upcomingCount = records.length - expiredCount;
  const hasExpired = expiredCount > 0;

  const heading =
    expiredCount > 0 && upcomingCount > 0
      ? `${records.length} need attention (${expiredCount} expired)`
      : expiredCount > 0
        ? `${expiredCount} expired`
        : `${upcomingCount} expiring soon`;

  return (
    <div
      className={`bg-surface-container-high border rounded-xl p-space-base flex gap-space-md ${
        hasExpired ? "border-error/30" : "border-tertiary/30"
      }`}
    >
      <span
        className={`material-symbols-outlined text-[20px] shrink-0 ${hasExpired ? "text-error" : "text-tertiary"}`}
      >
        event_busy
      </span>
      <div className="flex flex-col gap-2 min-w-0">
        <p className="text-label-sm text-on-surface font-bold uppercase tracking-wider">{heading}</p>
        <ul className="flex flex-col gap-1">
          {records.map((r) => {
            const days = daysUntil(r.expiration_date);
            const isExpired = days < 0;
            return (
              <li key={r.id} className="text-body-md text-on-surface-variant">
                <span className={`font-semibold ${isExpired ? "text-error" : "text-on-surface"}`}>{r.label}</span>
                {" — "}
                {isExpired
                  ? "expired"
                  : days === 0
                    ? "expires today"
                    : `expires in ${days} day${days === 1 ? "" : "s"}`}
                {" "}
                ({parseLocalDate(r.expiration_date).toLocaleDateString()})
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
