"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { PipelineArrow } from "./PipelineArrow";

type SheetContent = {
  rawLabel: string;
  rawMeta: string;
  rawFlag: string;
  cleanLabel: string;
  cleanNote: string;
};

const SHEETS: SheetContent[] = [
  {
    rawLabel: "RAW RFP SPEC",
    rawMeta: "Sec 3.1",
    rawFlag: "Prevailing Wage",
    cleanLabel: "Capability Statement",
    cleanNote: "100% Compliant",
  },
  {
    rawLabel: "INSURANCE COV",
    rawMeta: "Page 18",
    rawFlag: "Mandatory Bond",
    cleanLabel: "Compliance Matrix",
    cleanNote: "Fully Cross-Checked",
  },
];

const DELIVERABLE_LABELS = ["Capability statement", "Compliance matrix", "Technical narrative"];

// Landing page "Transformation pipeline" card: messy RFP in, clean 3-file
// package out -- same idea as the "before/after" panel in the printed
// deliverable itself (see lib/pdf/deliverables-packet.ts), just rendered
// live. Deliberately illustrative-only labels throughout (generic "Sample
// Solicitation", no named agency/client) -- same discipline the Gallery
// page's own "synthetic samples only" notice already applies. The 3
// package rows are the real core deliverable types
// (capability_statement/compliance_matrix/technical_narrative); the 48h
// figure is the same real internal turnaround target
// app/api/daily-digest/route.ts already tracks.
//
// Originally a fixed dark "console" palette (slate/rose/amber/emerald)
// matching a provided reference design exactly, deliberately locked to
// look the same in both site themes. Redesigned onto this app's own
// theme-reactive tokens (border/surface/error/secondary/primary) after a
// real user report that it read as a bolted-on SaaS-dashboard mockup
// once the rest of the marketing page settled into a warm, calm, ledger-
// style visual language -- it should look like the same product, not a
// different one demoing itself. The concept (raw RFP in, clean package
// out) and the flying-sheet mechanic are unchanged; only the palette and
// glow intensity moved onto the site's real system.
//
// One component rather than several independent pieces, because its
// effects need to read as one continuous system: the flying document
// sheets and the READY badges' breathing glow share a 10s loop (see
// globals.css's tp-* keyframes) -- components mounted independently
// would each start their own clock at a slightly different moment.
// useInView pauses everything off-screen (via a `data-tp-paused`
// attribute CSS keys off) rather than unmounting it, so resuming
// doesn't restart mid-phase; reduced-motion skips the animation
// classes/layers entirely rather than freezing them mid-transform at a
// random, potentially confusing pose.
export function TransformationPipeline() {
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { amount: 0.2 });
  // useReducedMotion() reads the OS's actual `prefers-reduced-motion`
  // setting, which the server has no way to know -- SSR always renders
  // as if it were false. Using its raw value directly (for conditional
  // rendering, not just a style tweak) would make a real client whose OS
  // actually has it enabled hydrate to different markup than the server
  // sent, a genuine hydration-mismatch error, not just a hypothetical
  // one (caught by testing with Playwright's own reducedMotion context
  // option). Gating on `mounted` keeps the FIRST client render identical
  // to the server's regardless of the real setting, then swaps to the
  // correct reduced-motion markup a tick later, after hydration -- the
  // standard fix for any client-only media query used in render output.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const prefersReducedMotion = useReducedMotion(); // called unconditionally, every render -- Rules of Hooks
  const reduceMotion = mounted && prefersReducedMotion;
  const animating = inView && !reduceMotion;

  const tp = (base: string, cls: string) => (reduceMotion ? base : `${base} ${cls} tp-anim`);

  return (
    <div
      ref={containerRef}
      data-tp-paused={animating ? "false" : "true"}
      className="relative w-full max-w-5xl rounded-2xl p-space-base sm:p-10 shadow-2xl overflow-hidden mt-8 bg-surface-container-low border border-outline-variant"
      // `overflow-hidden` alone doesn't reliably clip the flying sheets:
      // they use `transform-style: preserve-3d` inside a `perspective`
      // wrapper, and browsers have a long-standing rendering quirk where
      // overflow clipping on an ancestor OUTSIDE a nested 3D transform
      // context fails to clip descendants INSIDE it -- confirmed via a
      // real screenshot showing a sheet's corner rendering past the
      // card's own rounded corner, sitting directly on the page
      // background. `clip-path` uses a separate rendering path that
      // clips correctly regardless of descendant 3D transforms; kept
      // alongside `overflow-hidden` (harmless) rather than replacing it.
      style={{ clipPath: "inset(0 round 1rem)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-8 border-b border-outline-variant">
        <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-primary">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            {!reduceMotion && <span className="tp-anim tp-ping absolute inline-flex h-full w-full rounded-full bg-primary/70" />}
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          Transformation pipeline: RFP spec to ready-to-send packet
        </span>
        <span className="inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-medium bg-secondary-container text-on-secondary-container">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Turnaround: 48 hours
        </span>
      </div>

      <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-space-lg lg:gap-8 items-center lg:min-h-[360px]">
        {/* Flying document sheets: peel off the left card, arc through
            3D space (perspective on this wrapper), morph from raw-RFP
            styling to clean-package styling as they cross the portal,
            and land in the right card. lg: and up only, per spec --
            mobile/tablet keep the plain stacked layout with no 3D
            layer at all. Both sheets share the same 4.2s cycle
            (globals.css's tp-sheet-flight), the second delayed by only
            1.4s -- matching the reference preview's literal timing, so
            the two are often mid-flight at once rather than strictly
            taking turns. Each shows a different real deliverable's own
            before/after rather than identical generic content. Not
            removed for prefers-reduced-motion (rather than frozen
            mid-transform at a random, potentially confusing pose). */}
        {!reduceMotion && (
          <div
            className="hidden lg:block absolute inset-0 z-10 pointer-events-none [perspective:1200px]"
            aria-hidden="true"
          >
            {SHEETS.map((sheet, i) => {
              const delay = i * 1.4;
              return (
                <div
                  key={sheet.cleanLabel}
                  className="tp-anim tp-sheet absolute w-48 h-56 rounded-lg border-2 shadow-2xl [transform-style:preserve-3d]"
                  style={{ animationDelay: `${delay}s` }}
                >
                  {/* Raw face */}
                  <span
                    className="tp-anim tp-sheet-raw absolute inset-0 flex flex-col justify-between p-3"
                    style={{ animationDelay: `${delay}s` }}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-error">{sheet.rawLabel}</span>
                        <span className="text-[9px] text-on-surface-variant">{sheet.rawMeta}</span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="h-1.5 w-full rounded bg-outline-variant" />
                        <span className="h-1.5 w-4/5 rounded bg-error/40" />
                        <span className="h-1.5 w-3/4 rounded bg-outline-variant" />
                      </div>
                    </div>
                    <span className="text-[8px] font-bold text-error">&#9679; {sheet.rawFlag}</span>
                  </span>

                  {/* Clean face */}
                  <span className="tp-anim tp-sheet-clean absolute inset-0 flex flex-col justify-between p-3 rounded-lg bg-secondary-container">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-on-secondary-container">
                          Tailored Package
                        </span>
                        <span className="text-[9px] font-bold px-1 rounded bg-secondary text-on-secondary">READY</span>
                      </div>
                      <p className="text-[10px] font-bold leading-tight mb-2 text-on-secondary-container">
                        {sheet.cleanLabel}
                      </p>
                      <div className="flex flex-col gap-1.5">
                        <span className="h-1.5 w-full rounded bg-on-secondary-container/25" />
                        <span className="h-1.5 w-5/6 rounded bg-on-secondary-container/15" />
                        <span className="h-1.5 w-4/6 rounded bg-on-secondary-container/25" />
                      </div>
                    </div>
                    <span className="text-[8px] font-bold text-on-secondary-container">&#10003; {sheet.cleanNote}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Left: incoming RFP */}
        <div className="relative z-10 overflow-hidden rounded-xl p-space-base sm:p-6 shadow-inner bg-surface border border-outline-variant">
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
        </div>

        {/* Middle: portal arrow */}
        <div className="relative z-10 flex flex-col items-center justify-center gap-2.5 py-4 lg:py-0">
          <PipelineArrow />
          <span className="text-xs font-bold tracking-wide text-primary">BidPulse Pipeline</span>
        </div>

        {/* Right: ready package */}
        <div className="relative z-20 rounded-xl p-space-base sm:p-6 shadow-inner bg-surface border border-outline-variant">
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
                <span
                  className={tp("rounded px-2 py-0.5 font-mono text-[10px] font-bold bg-secondary-container text-on-secondary-container", "tp-badge")}
                  style={animating ? { animationDelay: `${i * 0.3}s` } : undefined}
                >
                  READY
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-[11px] font-semibold text-on-surface-variant">
            <span className="text-secondary">&#10003; You submit it</span>
            <span>No jargon</span>
          </div>
        </div>
      </div>
    </div>
  );
}
