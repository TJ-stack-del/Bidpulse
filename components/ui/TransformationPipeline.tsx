"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { PipelineArrow } from "./PipelineArrow";

type SheetContent = {
  rawLabel: string;
  rawMeta: string;
  rawFlag: string;
  rawBarColor: string;
  cleanLabel: string;
  cleanNote: string;
};

const SHEETS: SheetContent[] = [
  {
    rawLabel: "RAW RFP SPEC",
    rawMeta: "Sec 3.1",
    rawFlag: "Prevailing Wage",
    rawBarColor: "#fb718599",
    cleanLabel: "Capability Statement",
    cleanNote: "100% Compliant",
  },
  {
    rawLabel: "INSURANCE COV",
    rawMeta: "Page 18",
    rawFlag: "Mandatory Bond",
    rawBarColor: "#fbbf2499",
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
// Fixed dark "console" palette throughout (slate/rose/amber/emerald),
// not this app's theme-reactive tokens -- deliberate, matching a
// provided reference design exactly; this one component is meant to
// look the same in both site themes, the same reasoning
// tailwind.config.ts's own "-fixed" tokens already use elsewhere.
//
// One component rather than several independent pieces, because its
// effects need to read as one continuous system: the left card's scan
// beam runs its own 4s loop, while the flying document sheets and the
// READY badges' breathing glow share a separate 2.8s loop (see
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
      className="relative w-full max-w-5xl rounded-2xl p-space-base sm:p-10 shadow-2xl overflow-hidden mt-8"
      style={{ backgroundColor: "#0c1427", border: "1px solid #1e293bcc" }}
    >
      <div
        className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-8"
        style={{ borderBottom: "1px solid #1e293b" }}
      >
        <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#f59e0b" }}>
          <span className="relative flex h-2 w-2" aria-hidden="true">
            {!reduceMotion && (
              <span
                className="tp-anim tp-ping absolute inline-flex h-full w-full rounded-full"
                style={{ backgroundColor: "#fbbf24" }}
              />
            )}
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: "#f59e0b" }} />
          </span>
          Transformation pipeline: RFP spec to ready-to-send packet
        </span>
        <span
          className="inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-medium"
          style={{ backgroundColor: "#022c22b3", border: "1px solid #10b98150", color: "#34d399" }}
        >
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
            layer at all. Each sheet's own flight fills the first half
            of the shared 10s cycle (see globals.css's tp-sheet-flight),
            then sits idle+invisible for the second half -- the second
            sheet is delayed by exactly half that cycle, so the two
            genuinely take turns (one finishes landing, then the other
            starts) rather than both being mid-flight at once. Each
            shows a different real deliverable's own before/after
            rather than identical generic content. Not removed for
            prefers-reduced-motion (rather than frozen mid-transform at
            a random, potentially confusing pose). */}
        {!reduceMotion && (
          <div
            className="hidden lg:block absolute inset-0 z-30 pointer-events-none [perspective:1200px]"
            aria-hidden="true"
          >
            {SHEETS.map((sheet, i) => {
              const delay = i * 5;
              return (
                <div
                  key={sheet.cleanLabel}
                  className="tp-anim tp-sheet absolute w-36 h-40 sm:w-40 sm:h-44 rounded-lg border-2 shadow-2xl [transform-style:preserve-3d]"
                  style={{ animationDelay: `${delay}s` }}
                >
                  {/* Raw face */}
                  <span
                    className="tp-anim tp-sheet-raw absolute inset-0 flex flex-col justify-between p-3"
                    style={{ animationDelay: `${delay}s` }}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#fb7185" }}>
                          {sheet.rawLabel}
                        </span>
                        <span className="text-[9px]" style={{ color: "#94a3b8" }}>{sheet.rawMeta}</span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="h-1.5 w-full rounded" style={{ backgroundColor: "#475569" }} />
                        <span className="h-1.5 w-4/5 rounded" style={{ backgroundColor: sheet.rawBarColor }} />
                        <span className="h-1.5 w-3/4 rounded" style={{ backgroundColor: "#475569" }} />
                      </div>
                    </div>
                    <span className="text-[8px] font-bold" style={{ color: "#f59e0b" }}>&#9679; {sheet.rawFlag}</span>
                  </span>

                  {/* Clean face */}
                  <span
                    className="tp-anim tp-sheet-clean absolute inset-0 flex flex-col justify-between p-3 rounded-lg"
                    style={{ animationDelay: `${delay}s`, backgroundColor: "#064e3bf2" }}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#6ee7b7" }}>
                          Tailored Package
                        </span>
                        <span
                          className="text-[9px] font-bold px-1 rounded"
                          style={{ color: "#34d399", backgroundColor: "#022c22" }}
                        >
                          READY
                        </span>
                      </div>
                      <p className="text-[10px] font-bold leading-tight mb-2" style={{ color: "#ffffff" }}>
                        {sheet.cleanLabel}
                      </p>
                      <div className="flex flex-col gap-1.5">
                        <span className="h-1.5 w-full rounded" style={{ backgroundColor: "#34d39966" }} />
                        <span className="h-1.5 w-5/6 rounded" style={{ backgroundColor: "#6ee7b74d" }} />
                        <span className="h-1.5 w-4/6 rounded" style={{ backgroundColor: "#34d39966" }} />
                      </div>
                    </div>
                    <span className="text-[8px] font-bold" style={{ color: "#6ee7b7" }}>&#10003; {sheet.cleanNote}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Left: incoming RFP */}
        <div
          className="relative z-10 overflow-hidden rounded-xl p-space-base sm:p-6 shadow-inner"
          style={{ backgroundColor: "#0f172a", border: "1px solid #4c051d66" }}
        >
          <div
            className={tp("absolute top-0 bottom-0 w-[3px] pointer-events-none", "tp-scan-beam")}
            style={{
              background: "linear-gradient(to bottom, transparent, rgba(245, 158, 11, 0.9), transparent)",
              boxShadow: "0 0 12px 2px rgba(245, 158, 11, 0.6)",
            }}
            aria-hidden="true"
          />
          <div className="flex items-center justify-between gap-2 mb-3 text-xs">
            <span
              className="rounded px-2 py-0.5 font-bold tracking-wider text-[11px]"
              style={{ backgroundColor: "#f43f5e1a", color: "#fb7185", border: "1px solid #f43f5e33" }}
            >
              Incoming raw RFP
            </span>
            <span style={{ color: "#94a3b8" }}>Sample PDF</span>
          </div>
          <h3 className="text-base sm:text-lg font-bold mb-2" style={{ color: "#ffffff" }}>Sample Solicitation</h3>
          <p className="text-xs leading-relaxed mb-4" style={{ color: "#94a3b8" }}>
            Dense procurement language, buried insurance covenants, prevailing wage rate sheets, bonding
            certifications, and confusing submission checklists.
          </p>
          <div
            className="flex flex-col gap-2 rounded-lg p-3.5 mb-4"
            style={{ backgroundColor: "#00000066", border: "1px solid #1e293b" }}
          >
            {[
              { width: "w-3/4", color: "#475569" },
              { width: "w-full", color: "#33415580" },
              { width: "w-5/6", color: "#f43f5e4d" },
              { width: "w-1/2", color: "#f59e0b4d" },
            ].map((line, i) => (
              <span
                key={i}
                className={tp(`h-2 rounded ${line.width}`, "tp-line")}
                style={{
                  backgroundColor: line.color,
                  ...(animating ? { animationDelay: `${i * 0.1}s` } : {}),
                }}
              />
            ))}
          </div>
          <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold">
            <span style={{ color: "#fbbf24" }}>&#9679; Needs review</span>
            <span style={{ color: "#fb7185" }}>&#9679; Prevailing wage flagged</span>
          </div>
        </div>

        {/* Middle: portal arrow */}
        <div className="relative z-10 flex flex-col items-center justify-center gap-2.5 py-4 lg:py-0">
          <PipelineArrow />
          <span className="text-xs font-bold tracking-wide" style={{ color: "#fbbf24" }}>BidPulse Pipeline</span>
        </div>

        {/* Right: ready package */}
        <div
          className="relative z-10 rounded-xl p-space-base sm:p-6 shadow-inner"
          style={{ backgroundColor: "#0f172a", border: "1px solid #022c2266" }}
        >
          <div className="flex items-center justify-between gap-2 mb-3 text-xs">
            <span
              className="rounded px-2 py-0.5 font-bold tracking-wider text-[11px]"
              style={{ backgroundColor: "#10b9811a", color: "#34d399", border: "1px solid #10b98133" }}
            >
              Ready to submit
            </span>
            <span style={{ color: "#94a3b8" }}>3 clean files</span>
          </div>
          <h3 className="text-base sm:text-lg font-bold mb-4" style={{ color: "#ffffff" }}>
            Tailored Bid Submission Package
          </h3>
          <div className="flex flex-col gap-2.5 mb-4">
            {DELIVERABLE_LABELS.map((label, i) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-lg px-3.5 py-2.5 text-xs"
                style={{ border: "1px solid #1e293b", backgroundColor: "#162036" }}
              >
                <span className="flex items-center gap-2" style={{ color: "#e2e8f0" }}>
                  <span className="font-mono text-[11px]" style={{ color: "#94a3b8" }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-medium">{label}</span>
                </span>
                <span
                  className={tp(
                    "rounded px-2 py-0.5 font-mono text-[10px] font-bold",
                    "tp-badge"
                  )}
                  style={{
                    backgroundColor: "#34d3991a",
                    color: "#34d399",
                    border: "1px solid #34d39933",
                    boxShadow: "0 0 8px rgba(52, 211, 153, 0.2)",
                    ...(animating ? { animationDelay: `${i * 0.3}s` } : {}),
                  }}
                >
                  READY
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-[11px] font-semibold" style={{ color: "#94a3b8" }}>
            <span style={{ color: "#34d399" }}>&#10003; You submit it</span>
            <span>No jargon</span>
          </div>
        </div>
      </div>
    </div>
  );
}
