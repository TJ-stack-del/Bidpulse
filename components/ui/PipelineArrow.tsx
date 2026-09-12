"use client";

import { motion, useReducedMotion } from "motion/react";

// Landing page "Transformation pipeline" portal circle -- a fixed
// amber/slate palette (not this app's theme-reactive tokens) to match
// the reference preview's "console" aesthetic exactly, which is
// intentionally the same in both site themes. The glow is an inset +
// outset box-shadow pulse plus a slight scale, matching the reference's
// own portalGlow keyframe rather than a separate expanding ring.
export function PipelineArrow() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="relative flex h-16 w-16 items-center justify-center rounded-full"
      style={{ backgroundColor: "#f59e0b", color: "#0f172a" }}
      animate={
        reduceMotion
          ? undefined
          : {
              scale: [1, 1.05, 1],
              boxShadow: [
                "0 0 20px rgba(245, 158, 11, 0.4), inset 0 0 15px rgba(245, 158, 11, 0.2)",
                "0 0 35px rgba(245, 158, 11, 0.7), inset 0 0 25px rgba(245, 158, 11, 0.4)",
                "0 0 20px rgba(245, 158, 11, 0.4), inset 0 0 15px rgba(245, 158, 11, 0.2)",
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
