"use client";

import { useEffect, useRef, useState } from "react";

const DELIVERABLE_LABELS = ["Capability statement", "Compliance matrix", "Technical narrative"];

// The only piece of the landing page's "Transformation pipeline" card that
// genuinely needs JS -- the arrow float/glow and the READY badge breathe
// are continuous ambient loops (plain CSS, see globals.css), but a
// staggered reveal-*when-scrolled-into-view* needs to know when that
// actually happens, which CSS alone can't do without scroll-driven
// animation support this app doesn't otherwise rely on. Reveals once
// (unobserves itself after triggering) rather than re-animating every
// time the card scrolls in and out of view, which reads as flicker on a
// page a visitor scrolls up and down while reading.
export function DeliverableRowsReveal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="flex flex-col gap-1.5">
      {DELIVERABLE_LABELS.map((label, i) => (
        <div
          key={label}
          className="flex items-center justify-between bg-surface-container px-2.5 py-1.5 rounded transition-all duration-500 ease-out"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(10px)",
            transitionDelay: visible ? `${i * 140}ms` : "0ms",
          }}
        >
          <span className="flex items-center gap-2 text-body-sm text-on-surface">
            <span className="font-code text-label-sm text-on-surface-variant">
              {String(i + 1).padStart(2, "0")}
            </span>
            {label}
          </span>
          <span className="animate-ready-badge text-label-sm text-secondary font-bold uppercase tracking-wider">
            Ready
          </span>
        </div>
      ))}
    </div>
  );
}
