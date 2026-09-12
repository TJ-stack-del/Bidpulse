import { PipelineArrow } from "./PipelineArrow";
import { Reveal } from "./Reveal";

const DELIVERABLE_LABELS = ["Capability statement", "Compliance matrix", "Technical narrative"];

// Landing page "before/after" panel: messy RFP in, clean 3-file package
// out -- same idea as the "before/after" panel in the printed
// deliverable itself (see lib/pdf/deliverables-packet.ts), just rendered
// live. Deliberately illustrative-only labels throughout (generic "Sample
// Solicitation", no named agency/client) -- same discipline the Gallery
// page's own "synthetic samples only" notice already applies. The 3
// package rows are the real core deliverable types
// (capability_statement/compliance_matrix/technical_narrative); the 48h
// figure is the same real internal turnaround target
// app/api/daily-digest/route.ts already tracks.
//
// Twice-redesigned from an original fixed dark "console" mockup with a
// perpetually-animating flying-document effect (peeling, 3D-flying
// document cards; pulsing status dots; breathing "READY" badges). Two
// separate, real problems with that version: (1) it used a fixed dark
// palette that never matched the rest of the page once this session
// brought everything else onto the site's own warm, theme-reactive
// tokens, and (2) the perpetual "live system processing" animation
// oversold what the product actually is -- a person on the team
// prepares each document by hand (see the FAQ's "our team prepares..."
// copy this section's middle label now echoes), not a live automated
// pipeline. This version keeps the same real content and the same
// before/after concept, but presents it as a calm, static comparison
// that fades in once via the shared Reveal primitive (the same
// mechanic every other section on this page uses), rather than an
// indefinitely-looping animation demonstrating "processing."
export function TransformationPipeline() {
  return (
    <div className="relative w-full max-w-5xl rounded-2xl p-space-base sm:p-10 shadow-2xl overflow-hidden mt-8 bg-surface-container-low border border-outline-variant">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-8 border-b border-outline-variant">
        <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-primary">
          <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
          Before and after: one real RFP, turned into a ready-to-send packet
        </span>
        <span className="inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-medium bg-secondary-container text-on-secondary-container">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Turnaround: 48 hours
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-space-lg lg:gap-8 items-center">
        {/* Left: incoming RFP */}
        <Reveal className="rounded-xl p-space-base sm:p-6 shadow-inner bg-surface border border-outline-variant">
          <div className="flex items-center justify-between gap-2 mb-3 text-xs">
            <span className="rounded px-2 py-0.5 font-bold tracking-wider text-[11px] bg-error/10 text-error border border-error/25">
              Incoming raw RFP
            </span>
            <span className="text-on-surface-variant">Sample PDF</span>
          </div>
          <h3 className="text-base sm:text-lg font-bold mb-2 text-primary">Sample Solicitation</h3>
          <p className="text-xs leading-relaxed mb-4 text-on-surface-variant">
            Dense procurement language, buried insurance covenants, prevailing wage rate sheets, bonding
            certifications, and confusing submission checklists.
          </p>
          <div className="flex flex-col gap-2 rounded-lg p-3.5 mb-4 bg-surface-container-high border border-outline-variant">
            {[
              { width: "w-3/4", color: "bg-outline-variant" },
              { width: "w-full", color: "bg-outline-variant/70" },
              { width: "w-5/6", color: "bg-error/30" },
              { width: "w-1/2", color: "bg-primary/25" },
            ].map((line, i) => (
              <span key={i} className={`h-2 rounded ${line.width} ${line.color}`} />
            ))}
          </div>
          <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold">
            <span className="text-on-surface-variant">&#9679; Needs review</span>
            <span className="text-error">&#9679; Prevailing wage flagged</span>
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
        <Reveal delay={0.3} className="rounded-xl p-space-base sm:p-6 shadow-inner bg-surface border border-outline-variant">
          <div className="flex items-center justify-between gap-2 mb-3 text-xs">
            <span className="rounded px-2 py-0.5 font-bold tracking-wider text-[11px] bg-secondary-container text-on-secondary-container">
              Ready to submit
            </span>
            <span className="text-on-surface-variant">3 clean files</span>
          </div>
          <h3 className="text-base sm:text-lg font-bold mb-4 text-primary">Tailored Bid Submission Package</h3>
          {/* Hairline-divided rows, not separately boxed ones -- matches
              the same manifest/ledger convention the Trades and Pricing
              sections use elsewhere on this page. */}
          <div className="flex flex-col divide-y divide-outline-variant mb-4">
            {DELIVERABLE_LABELS.map((label, i) => (
              <div key={label} className="flex items-center justify-between py-2.5 text-xs">
                <span className="flex items-center gap-2 text-on-surface">
                  <span className="font-mono text-[11px] text-on-surface-variant">{String(i + 1).padStart(2, "0")}</span>
                  <span className="font-medium">{label}</span>
                </span>
                <span className="rounded px-2 py-0.5 font-mono text-[10px] font-bold bg-secondary-container text-on-secondary-container">
                  READY
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-[11px] font-semibold text-on-surface-variant">
            <span className="text-secondary">&#10003; You submit it</span>
            <span>No jargon</span>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
