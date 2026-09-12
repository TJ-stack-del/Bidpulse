"use client";

import { useEffect, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

// Shared entrance-motion primitive for the marketing page -- one easing
// curve and one duration everywhere (Emil Kowalski's "200-300ms sweet
// spot", an ease-out-quint-ish curve), varied only by *when* it fires
// (mode) and *how* it moves (variant), so every section reads as the
// same authored system rather than a grab-bag of scroll-fade effects.
// Same mount-gated useReducedMotion pattern as TransformationPipeline
// (see its own comment): the server always renders as if reduced motion
// were off, so gating on `mounted` keeps the first client render
// identical to the server's, then swaps to the plain, unanimated
// element a tick after hydration if the OS actually asks for it --
// never a fade the user asked to not see.
const EASE = [0.22, 1, 0.36, 1] as const;

type RevealProps = {
  children: ReactNode;
  as?: "div" | "li";
  className?: string;
  /** "view" (default) fires once the element scrolls into view; "mount" fires immediately, for above-the-fold content. */
  mode?: "view" | "mount";
  /** "rise" is a small fade + upward drift; "scale" is a fade + slight scale-in, for the numbered step badges. */
  variant?: "rise" | "scale";
  delay?: number;
};

export function Reveal({ children, as = "div", className, mode = "view", variant = "rise", delay = 0 }: RevealProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const prefersReducedMotion = useReducedMotion();
  const reduceMotion = mounted && prefersReducedMotion;

  if (reduceMotion) {
    return as === "li" ? <li className={className}>{children}</li> : <div className={className}>{children}</div>;
  }

  const hidden = variant === "scale" ? { opacity: 0, scale: 0.92 } : { opacity: 0, y: 16 };
  const shown = { opacity: 1, y: 0, scale: 1 };
  const Component = as === "li" ? motion.li : motion.div;
  const trigger =
    mode === "mount"
      ? { initial: hidden, animate: shown }
      : { initial: hidden, whileInView: shown, viewport: { once: true, amount: 0.3 } };

  return (
    <Component className={className} {...trigger} transition={{ duration: 0.5, delay, ease: EASE }}>
      {children}
    </Component>
  );
}
