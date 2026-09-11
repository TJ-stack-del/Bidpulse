"use client";

import { motion, useReducedMotion } from "motion/react";

const DELIVERABLE_LABELS = ["Capability statement", "Compliance matrix", "Technical narrative"];

// Staggered fade-in + slide-up for the landing page's "Transformation
// pipeline" card (app/page.tsx), the moment it actually scrolls into
// view -- motion's whileInView + viewport={{ once: true }} replaces what
// used to be a hand-rolled IntersectionObserver here. Also owns the READY
// badges' continuous breathing-opacity pulse, since it's the same rows.
export function DeliverableRowsReveal() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex flex-col gap-1.5">
      {DELIVERABLE_LABELS.map((label, i) => (
        <motion.div
          key={label}
          className="flex items-center justify-between bg-surface-container px-2.5 py-1.5 rounded"
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: i * 0.14 }}
        >
          <span className="flex items-center gap-2 text-body-sm text-on-surface">
            <span className="font-code text-label-sm text-on-surface-variant">
              {String(i + 1).padStart(2, "0")}
            </span>
            {label}
          </span>
          <motion.span
            className="text-label-sm text-secondary font-bold uppercase tracking-wider"
            animate={reduceMotion ? undefined : { opacity: [1, 0.72, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          >
            Ready
          </motion.span>
        </motion.div>
      ))}
    </div>
  );
}
