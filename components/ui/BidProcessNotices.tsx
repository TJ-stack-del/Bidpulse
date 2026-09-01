// Static, always-true bid-process warnings — no AI, no per-bid detection.
// Deferred items #1 and (the standing-education half of) #2 from
// PROJECT-STATUS.md. Framed as "here's what typically applies," not a
// legal quote — clients should still confirm specifics with the agency or
// their own counsel for anything that matters.
export function BidProcessNotices() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3">
        <span className="material-symbols-outlined text-on-surface-variant text-[20px] shrink-0 mt-0.5">gavel</span>
        <div>
          <p className="text-label-md text-on-surface font-bold mb-1">Cone of Silence</p>
          <p className="text-body-md text-on-surface-variant">
            Most public agencies enforce a &quot;Cone of Silence&quot; once a bid is posted — you can&apos;t contact
            agency staff or evaluators about it directly, even with a quick question. Any questions have to go
            through the agency&apos;s official Q&amp;A process or Procurement Officer instead. Breaking this rule
            can get your bid disqualified, or worse.
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <span className="material-symbols-outlined text-on-surface-variant text-[20px] shrink-0 mt-0.5">visibility</span>
        <div>
          <p className="text-label-md text-on-surface font-bold mb-1">Public records (Sunshine Law)</p>
          <p className="text-body-md text-on-surface-variant">
            In Florida, your submitted bid — including cost sheets and scores — becomes public record once the
            agency announces its decision (or 30 days after bid opening, if sooner), and anyone, including
            competitors, can request to see it. If any part of your bid is proprietary, like custom software or
            sensitive financial details, it must be clearly labeled &quot;Exempt / Proprietary Trade Secret&quot; at
            the time you submit — not after. Marking it too late means losing that protection for good.
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <span className="material-symbols-outlined text-on-surface-variant text-[20px] shrink-0 mt-0.5">payments</span>
        <div>
          <p className="text-label-md text-on-surface font-bold mb-1">Government agencies pay slowly</p>
          <p className="text-body-md text-on-surface-variant">
            Expect 30 to 45 days after you submit an invoice before payment clears, usually billed once a month
            for the prior month&apos;s work — not weekly, and not on delivery. Plan to have working capital or a
            credit line to cover 60 to 90 days of payroll and supplies before your first government payment
            arrives.
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <span className="material-symbols-outlined text-on-surface-variant text-[20px] shrink-0 mt-0.5">event_available</span>
        <div>
          <p className="text-label-md text-on-surface font-bold mb-1">Budget time to mobilize</p>
          <p className="text-body-md text-on-surface-variant">
            Most contracts have a 15 to 30 day mobilization window between signing and your official Notice to
            Proceed. Use it to line up equipment, staff, background checks, and supplies — that gap needs to be
            budgeted for before your first billable day, not paid for out of it.
          </p>
        </div>
      </div>
    </div>
  );
}
