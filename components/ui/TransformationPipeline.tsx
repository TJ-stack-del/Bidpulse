"use client";

import { useRef } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { PipelineArrow } from "./PipelineArrow";

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
// Consolidated into one component (rather than three independently
// animated pieces) because the scan/conduit/stamp effects below all
// share one 4s CSS cycle (see globals.css's tp-* keyframes) -- three
// separately-mounted components would each start their own clock at a
// slightly different moment, breaking the "one continuous pipeline"
// illusion. useInView pauses the whole cycle off-screen rather than
// unmounting it, so resuming doesn't restart mid-phase; reduced-motion
// skips the animation classes entirely and shows the settled end state.
export function TransformationPipeline() {
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { amount: 0.2 });
  const reduceMotion = useReducedMotion();
  const animating = inView && !reduceMotion;

  const tp = (base: string, cls: string) => (reduceMotion ? base : `${base} ${cls} tp-anim`);

  return (
    <div
      ref={containerRef}
      data-tp-paused={animating ? "false" : "true"}
      className="w-full max-w-4xl bg-surface-container-low rounded-xl shadow-lg p-space-base md:p-8 flex flex-col gap-space-base mt-8"
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-label-sm font-code text-tertiary uppercase tracking-wide flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary" aria-hidden="true" />
          Transformation pipeline: RFP spec to ready-to-send packet
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container text-label-sm font-bold">
          <span className="material-symbols-outlined text-[16px]">check_circle</span>
          Turnaround: 48 hours
        </span>
      </div>

      <div className="relative grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-space-base items-center">
        {/* Center conduit -- absolutely positioned behind the whole row so
            its pulses can travel from the left card's edge, past the
            arrow, into the right card's edge. Desktop only: the mobile
            single-column stack has no shared horizontal axis for it to
            travel along, and a decorative cross-axis effect there isn't
            worth the added complexity or the extra animation cost on a
            narrower, more bandwidth-conscious viewport. */}
        <div
          className="hidden md:block absolute inset-x-0 top-1/2 -translate-y-1/2 h-px z-0 pointer-events-none"
          aria-hidden="true"
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to right, rgb(var(--color-primary) / 0.35) 0 6px, transparent 6px 14px)",
            }}
          />
          {[0, 0.5].map((delayOffset) => (
            <span
              key={delayOffset}
              className={tp(
                "absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_2px_rgb(var(--color-primary)/0.7)]",
                "tp-pulse-dot"
              )}
              style={animating ? { animationDelay: `${delayOffset}s` } : undefined}
            />
          ))}
        </div>

        {/* Left: incoming RFP */}
        <div className="relative z-10 overflow-hidden bg-surface-container-lowest dark:bg-surface-container-low rounded-lg p-space-base flex flex-col gap-space-sm text-left">
          <div
            className={tp(
              "absolute top-0 bottom-0 w-[3px] pointer-events-none",
              "tp-scan-beam"
            )}
            style={{
              background:
                "linear-gradient(to bottom, transparent, rgb(var(--color-primary) / 0.9), transparent)",
              boxShadow: "0 0 12px 2px rgb(var(--color-primary) / 0.6)",
            }}
            aria-hidden="true"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="px-2 py-0.5 rounded bg-error-container/30 text-error text-label-sm font-bold uppercase tracking-wider">
              Incoming raw RFP
            </span>
            <span className="text-label-sm text-on-surface-variant">Sample PDF</span>
          </div>
          <h3 className="text-title-lg text-on-surface font-bold">Sample Solicitation</h3>
          <p className="text-body-sm text-on-surface-variant">
            Dense procurement language, buried insurance covenants, prevailing wage rate sheets, bonding
            certifications, and confusing submission checklists.
          </p>
          <div className="border border-outline-variant rounded p-2 flex flex-col gap-1.5">
            {[
              { width: "w-full", color: "bg-outline-variant" },
              { width: "w-4/5", color: "bg-outline-variant" },
              { width: "w-3/5", color: "bg-primary/60" },
              { width: "w-2/5", color: "bg-error/60" },
            ].map((line, i) => (
              <span
                key={i}
                className={tp(`h-1.5 rounded ${line.width} ${line.color}`, "tp-line")}
                style={animating ? { animationDelay: `${i * 0.1}s` } : undefined}
              />
            ))}
          </div>
          <div className="flex items-center flex-wrap gap-2 text-label-sm">
            <span className="px-2 py-0.5 rounded bg-primary-container text-on-primary-container font-bold uppercase tracking-wider">
              Needs review
            </span>
            <span className="px-2 py-0.5 rounded bg-error-container/20 text-error font-bold uppercase tracking-wider">
              Prevailing wage flagged
            </span>
          </div>
        </div>

        {/* Middle: arrow (own independent ambient float/glow, unsynced --
            the conduit pulses arriving from either side are the thing
            tied to the shared cycle). */}
        <div className="relative z-10 flex md:flex-col items-center justify-center gap-2 py-1">
          <PipelineArrow />
          <span className="text-label-sm text-on-surface-variant font-code whitespace-nowrap">BidPulse Pipeline</span>
        </div>

        {/* Right: ready package */}
        <div className="relative z-10 bg-surface-container-lowest dark:bg-surface-container-low rounded-lg p-space-base flex flex-col gap-space-sm text-left">
          <div className="flex items-center justify-between gap-2">
            <span className="px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container text-label-sm font-bold uppercase tracking-wider">
              Ready to submit
            </span>
            <span className="text-label-sm text-on-surface-variant">3 clean files</span>
          </div>
          <h3 className="text-title-lg text-on-surface font-bold">Tailored Bid Submission Package</h3>
          <div className="flex flex-col gap-1.5">
            {DELIVERABLE_LABELS.map((label, i) => {
              const delay = animating ? { animationDelay: `${i * 0.08}s` } : undefined;
              return (
                <div
                  key={label}
                  className={tp(
                    "flex items-center justify-between bg-surface-container px-2.5 py-1.5 rounded",
                    "tp-row"
                  )}
                  style={delay}
                >
                  <span className="flex items-center gap-2 text-body-sm text-on-surface">
                    <span className="font-code text-label-sm text-on-surface-variant">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {label}
                  </span>
                  <span
                    className={tp(
                      "text-label-sm text-secondary font-bold uppercase tracking-wider",
                      "tp-badge"
                    )}
                    style={delay}
                  >
                    Ready
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-label-sm">
            <span className="text-primary font-bold">You submit it</span>
            <span className="text-on-surface-variant">No jargon</span>
          </div>
        </div>
      </div>
    </div>
  );
}
