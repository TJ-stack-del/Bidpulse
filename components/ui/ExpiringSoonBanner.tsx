import type { ExpiringRecord } from "@/lib/compliance/expiring-soon";

// Same visual pattern as the "note about your trade" tertiary banner on
// app/dashboard/SubmissionCard.tsx -- a heads-up, not an error, so it uses
// tertiary (already this app's "in progress"/attention color) rather than
// the error-container treatment reserved for actual failures.
function daysUntil(dateStr: string): number {
  const ms = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function ExpiringSoonBanner({ records }: { records: ExpiringRecord[] }) {
  if (records.length === 0) return null;

  return (
    <div className="bg-surface-container-high border border-tertiary/30 rounded-xl p-space-base flex gap-space-md">
      <span className="material-symbols-outlined text-tertiary text-[20px] shrink-0">event_busy</span>
      <div className="flex flex-col gap-2 min-w-0">
        <p className="text-label-sm text-on-surface font-bold uppercase tracking-wider">
          {records.length} expiring soon
        </p>
        <ul className="flex flex-col gap-1">
          {records.map((r) => {
            const days = daysUntil(r.expiration_date);
            return (
              <li key={r.id} className="text-body-md text-on-surface-variant">
                <span className="text-on-surface font-semibold">{r.label}</span>
                {" — "}
                {days < 0
                  ? "expired"
                  : days === 0
                    ? "expires today"
                    : `expires in ${days} day${days === 1 ? "" : "s"}`}
                {" "}
                ({new Date(r.expiration_date).toLocaleDateString()})
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
