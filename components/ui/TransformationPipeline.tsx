import { PipelineArrow } from "./PipelineArrow";
import { Reveal } from "./Reveal";

// Same three deliverable types, same icons DeliverablesSection.tsx already
// uses for them on the client dashboard -- reusing the exact mapping here
// (rather than inventing a second one) is what makes this landing-page
// visual read as "the same product" instead of a disconnected marketing
// mockup.
const DELIVERABLES = [
  { label: "Capability statement", icon: "badge" },
  { label: "Compliance matrix", icon: "fact_check" },
  { label: "Technical narrative", icon: "description" },
];

// Landing page "before/after" panel: messy RFP in, clean 3-file package
// out -- same idea as the "before/after" panel in the printed
// deliverable itself (see lib/pdf/deliverables-packet.ts), just rendered
// live. Deliberately illustrative-only text throughout (generic "Sample
// Solicitation," no named agency/client) -- same discipline the Gallery
// page's own "synthetic samples only" notice already applies. The 48h
// figure is the same real internal turnaround target
// app/api/daily-digest/route.ts already tracks.
//
// Third pass. First version was a fixed-dark "console" mockup with a
// perpetually-animating flying-document effect -- replaced because (1) its
// fixed dark palette never matched the rest of the page once this session
// brought everything else onto the site's own warm, theme-reactive tokens,
// and (2) the perpetual "live processing" animation oversold what the
// product actually is (a person on the team prepares each document by
// hand, not a live automated pipeline -- see the FAQ's "our team
// prepares..." copy this section's middle label still echoes). The second
// version fixed both of those but still read as amateurish: unicode
// glyphs (&#9679; &#10003;) standing in for a real icon system, decorative
// 01/02/03 numbering on three parallel (non-sequential) deliverables, and
// -- the biggest one -- abstract gray skeleton bars standing in for the
// "before" document's actual content. Real, specific (if still
// illustrative) text reads as premium; placeholder bars read as a
// wireframe nobody finished. This version keeps the same honest, static,
// theme-reactive comparison and the same real content, but replaces every
// one of those with the site's own real icon system (material-symbols,
// the same font every other page already uses) and real illustrative
// prose with the actual flagged phrases highlighted inline, rather than
// abstracted away.
export function TransformationPipeline() {
  return (
    <div className="relative w-full max-w-5xl rounded-2xl p-space-base sm:p-10 shadow-2xl shadow-primary/5 overflow-hidden mt-8 bg-surface-container-low border border-outline-variant">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-8 border-b border-outline-variant">
        <span className="flex items-center gap-2.5 text-title-sm font-bold text-primary">
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
            compare_arrows
          </span>
          One real RFP, turned into a ready-to-send packet
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold bg-secondary-container text-on-secondary-container">
          <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
            bolt
          </span>
          48-hour turnaround
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-space-lg lg:gap-8 items-center">
        {/* Left: incoming RFP -- real illustrative prose with the actual
            flagged phrases highlighted inline, not abstract skeleton
            bars standing in for "there's text here." */}
        <Reveal className="rounded-xl p-space-base sm:p-6 shadow-md shadow-error/5 bg-surface border border-outline-variant">
          <div className="flex items-center justify-between gap-2 mb-3 text-xs">
            <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 font-bold tracking-wide text-[11px] bg-error/10 text-error border border-error/25">
              <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                description
              </span>
              Incoming raw RFP
            </span>
            <span className="text-on-surface-variant">Sample PDF</span>
          </div>
          <h3 className="text-base sm:text-lg font-bold mb-2 text-primary">Sample Solicitation</h3>
          <p className="text-xs leading-relaxed rounded-lg p-3.5 mb-4 bg-surface-container-high border border-outline-variant text-on-surface-variant">
            Contractor shall maintain commercial general liability coverage of not less than
            $2,000,000 per occurrence. All work performed under this agreement is subject to{" "}
            <mark className="rounded-sm bg-error/15 px-1 py-0.5 text-error font-semibold">
              prevailing wage determinations
            </mark>{" "}
            issued by the Department of Labor. Contractor shall furnish a{" "}
            <mark className="rounded-sm bg-primary/15 px-1 py-0.5 text-primary font-semibold">
              100% performance and payment bond
            </mark>{" "}
            prior to notice to proceed.
          </p>
          <div className="flex items-center flex-wrap gap-2 text-[11px] font-bold">
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 bg-surface-container-high text-on-surface-variant">
              <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                visibility
              </span>
              Needs review
            </span>
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 bg-error/10 text-error">
              <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                flag
              </span>
              Prevailing wage flagged
            </span>
          </div>
        </Reveal>

        {/* Middle: the transformation itself -- a plain, calm circle
            rather than a pulsing "live processing" indicator, labeled
            with the same "our team" language the FAQ already uses for
            this step, so the visual doesn't claim more automation than
            the product actually does. */}
        <Reveal variant="scale" delay={0.15} className="flex flex-col items-center justify-center gap-2.5 py-4 lg:py-0">
          <PipelineArrow />
          <span className="text-xs font-bold tracking-wide text-primary text-center">Prepared by our team</span>
        </Reveal>

        {/* Right: ready package */}
        <Reveal delay={0.3} className="rounded-xl p-space-base sm:p-6 shadow-md shadow-secondary/5 bg-surface border border-outline-variant">
          <div className="flex items-center justify-between gap-2 mb-3 text-xs">
            <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 font-bold tracking-wide text-[11px] bg-secondary-container text-on-secondary-container">
              <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                check_circle
              </span>
              Ready to submit
            </span>
            <span className="text-on-surface-variant">3 clean files</span>
          </div>
          <h3 className="text-base sm:text-lg font-bold mb-4 text-primary">Tailored Bid Submission Package</h3>
          {/* Hairline-divided rows, not separately boxed ones -- matches
              the same manifest/ledger convention the Trades and Pricing
              sections use elsewhere on this page. */}
          <div className="flex flex-col divide-y divide-outline-variant mb-4">
            {DELIVERABLES.map((d) => (
              <div key={d.label} className="flex items-center justify-between py-2.5 text-xs">
                <span className="flex items-center gap-2.5 text-on-surface">
                  <span className="material-symbols-outlined text-primary text-[16px]" aria-hidden="true">
                    {d.icon}
                  </span>
                  <span className="font-medium">{d.label}</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold bg-secondary-container text-on-secondary-container">
                  <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
                    check
                  </span>
                  Ready
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="inline-flex items-center gap-1 text-secondary">
              <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                task_alt
              </span>
              You submit it
            </span>
            <span className="text-on-surface-variant">No jargon</span>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
