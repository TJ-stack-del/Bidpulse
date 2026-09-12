"use client";

import { motion, useReducedMotion } from "motion/react";

// Landing page "Transformation pipeline" portal circle. Used a fixed
// amber/slate palette until this redesign brought it onto the site's
// own theme-reactive primary token (which is itself a warm amber/brown
// in both themes, so the accent feel carries over) instead of a
// hardcoded hex disconnected from the rest of the page. The glow is an
// inset + outset box-shadow pulse plus a slight scale, now built from
// primary at a reduced, less "neon" intensity than the original.
export function PipelineArrow() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary-container text-on-primary-container"
      animate={
        reduceMotion
          ? undefined
          : {
              scale: [1, 1.05, 1],
              boxShadow: [
                "0 0 14px rgb(var(--color-primary) / 0.25), inset 0 0 10px rgb(var(--color-primary) / 0.12)",
                "0 0 24px rgb(var(--color-primary) / 0.4), inset 0 0 16px rgb(var(--color-primary) / 0.2)",
                "0 0 14px rgb(var(--color-primary) / 0.25), inset 0 0 10px rgb(var(--color-primary) / 0.12)",
              ],
            }
      }
      transition={{ duration: 2.1, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* Below lg the pipeline's grid stacks to one column (left card,
          arrow, right card top-to-bottom), so the arrow needs to point
          down instead of right to still read as "flows into the next
          card." */}
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        className="rotate-90 lg:rotate-0 transition-transform duration-300"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
      </svg>
    </motion.div>
  );
}
