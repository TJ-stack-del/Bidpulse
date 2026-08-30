"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

const OPTIONS: { value: "light" | "dark" | "system"; icon: string; label: string }[] = [
  { value: "light", icon: "light_mode", label: "Light theme" },
  { value: "dark", icon: "dark_mode", label: "Dark theme" },
  { value: "system", icon: "computer", label: "Match system theme" },
];

// next-themes reads the persisted theme from localStorage on the client
// only — on the server (and on the very first client render, before
// hydration) it doesn't know the real value yet. Rendering the active
// segment before that would either guess wrong or mismatch what the
// server sent, so this stays visually neutral (no segment marked active)
// until mounted, same pattern next-themes' own docs recommend.
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="flex items-center rounded-lg border border-outline-variant bg-surface p-0.5 gap-0.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setTheme(opt.value)}
          aria-label={opt.label}
          aria-pressed={mounted && theme === opt.value}
          title={opt.label}
          className={`p-1.5 rounded-md transition ${
            mounted && theme === opt.value
              ? "bg-secondary-container text-on-secondary-container"
              : "text-on-surface-variant hover:bg-surface-container-high"
          }`}
        >
          <span className="material-symbols-outlined text-[18px] block">{opt.icon}</span>
        </button>
      ))}
    </div>
  );
}
