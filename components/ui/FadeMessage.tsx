"use client";

import { useEffect, useState } from "react";

// Keeps the message mounted long enough for the opacity transition to
// finish before actually removing it — a plain `{show && <p>...}` snaps
// in/out instantly since React unmounts on the same render as the state
// change, before any CSS transition gets a chance to run.
export function FadeMessage({
  show,
  children,
  className = "",
}: {
  show: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [mounted, setMounted] = useState(show);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setMounted(true);
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    setVisible(false);
    const timeout = setTimeout(() => setMounted(false), 200);
    return () => clearTimeout(timeout);
  }, [show]);

  if (!mounted) return null;

  return (
    <span className={`transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"} ${className}`}>
      {children}
    </span>
  );
}
