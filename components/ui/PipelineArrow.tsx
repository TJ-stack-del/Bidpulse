"use client";

import { motion, useReducedMotion } from "motion/react";

// Continuous float + glow-ring pulse on the landing page's "Transformation
// pipeline" arrow (app/page.tsx). useReducedMotion (not a raw CSS media
// query) is motion's own accessibility hook -- it also reacts live if the
// OS setting changes mid-session, which a one-shot @media check wouldn't.
export function PipelineArrow() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center shrink-0"
      animate={
        reduceMotion
          ? undefined
          : {
              x: [0, 4, 0],
              boxShadow: [
                "0 0 0 0 rgb(var(--color-primary) / 0.35)",
                "0 0 0 7px rgb(var(--color-primary) / 0)",
                "0 0 0 0 rgb(var(--color-primary) / 0.35)",
              ],
            }
      }
      transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
    >
      <span className="material-symbols-outlined text-on-primary-container">arrow_forward</span>
    </motion.div>
  );
}
