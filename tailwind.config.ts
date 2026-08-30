import type { Config } from "tailwindcss";

// Design tokens matched to the BidPulse logo (deep teal #0f6e7a accent,
// navy #0c1524/#101a30 ink and containers, burnt-orange #a84d0f tertiary
// pulled from the logo's bolt), Inter + JetBrains Mono, sharper corners,
// neutral-gray surfaces. This is a shared, global file — the token values
// below affect every page in the app, not just the ones the original
// mockups covered (home, pricing, gallery, intake). `full` is deliberately
// NOT overridden to the mockup's 0.75rem: that value only reads as a circle
// for one specific 24px element in the mockup itself, and overriding
// Tailwind's real "fully rounded" keyword globally would flatten every
// actual circle elsewhere in the app (e.g. AppShell's avatar placeholder).
const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Variable-backed — see app/globals.css for the light (:root) and
        // dark (.dark) values. `<alpha-value>` keeps opacity modifiers
        // (bg-secondary/50) working the same as with plain hex.
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        "surface-dim": "rgb(var(--color-surface-dim) / <alpha-value>)",
        "surface-bright": "rgb(var(--color-surface-bright) / <alpha-value>)",
        "surface-container-lowest": "rgb(var(--color-surface-container-lowest) / <alpha-value>)",
        "surface-container-low": "rgb(var(--color-surface-container-low) / <alpha-value>)",
        "surface-container": "rgb(var(--color-surface-container) / <alpha-value>)",
        "surface-container-high": "rgb(var(--color-surface-container-high) / <alpha-value>)",
        "surface-container-highest": "rgb(var(--color-surface-container-highest) / <alpha-value>)",
        "on-surface": "rgb(var(--color-on-surface) / <alpha-value>)",
        "on-surface-variant": "rgb(var(--color-on-surface-variant) / <alpha-value>)",
        "inverse-surface": "rgb(var(--color-inverse-surface) / <alpha-value>)",
        "inverse-on-surface": "rgb(var(--color-inverse-on-surface) / <alpha-value>)",
        outline: "rgb(var(--color-outline) / <alpha-value>)",
        "outline-variant": "rgb(var(--color-outline-variant) / <alpha-value>)",
        "surface-tint": "rgb(var(--color-surface-tint) / <alpha-value>)",
        primary: "rgb(var(--color-primary) / <alpha-value>)",
        "on-primary": "rgb(var(--color-on-primary) / <alpha-value>)",
        "primary-container": "rgb(var(--color-primary-container) / <alpha-value>)",
        "on-primary-container": "rgb(var(--color-on-primary-container) / <alpha-value>)",
        "inverse-primary": "rgb(var(--color-inverse-primary) / <alpha-value>)",
        secondary: "rgb(var(--color-secondary) / <alpha-value>)",
        "on-secondary": "rgb(var(--color-on-secondary) / <alpha-value>)",
        "secondary-container": "rgb(var(--color-secondary-container) / <alpha-value>)",
        "on-secondary-container": "rgb(var(--color-on-secondary-container) / <alpha-value>)",
        tertiary: "rgb(var(--color-tertiary) / <alpha-value>)",
        "on-tertiary": "rgb(var(--color-on-tertiary) / <alpha-value>)",
        "tertiary-container": "rgb(var(--color-tertiary-container) / <alpha-value>)",
        "on-tertiary-container": "rgb(var(--color-on-tertiary-container) / <alpha-value>)",
        error: "rgb(var(--color-error) / <alpha-value>)",
        "on-error": "rgb(var(--color-on-error) / <alpha-value>)",
        "error-container": "rgb(var(--color-error-container) / <alpha-value>)",
        "on-error-container": "rgb(var(--color-on-error-container) / <alpha-value>)",
        background: "rgb(var(--color-background) / <alpha-value>)",
        "on-background": "rgb(var(--color-on-background) / <alpha-value>)",
        "surface-variant": "rgb(var(--color-surface-variant) / <alpha-value>)",
        // "-fixed" tokens are the same color in both themes by M3 design
        // (a badge/chip that should look identical regardless of theme) —
        // plain static hex, no CSS variable indirection needed.
        "primary-fixed": "#d6e3ff",
        "primary-fixed-dim": "#b9c7e4",
        "on-primary-fixed": "#101a30",
        "on-primary-fixed-variant": "#39475f",
        "secondary-fixed": "#6ff0e2",
        "secondary-fixed-dim": "#45d6c8",
        "on-secondary-fixed": "#00201e",
        "on-secondary-fixed-variant": "#0a4e52",
        "tertiary-fixed": "#ffddb8",
        "tertiary-fixed-dim": "#ffb870",
        "on-tertiary-fixed": "#351a00",
        "on-tertiary-fixed-variant": "#7a3c00",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        code: ["JetBrains Mono", "monospace"],
      },
      fontSize: {
        "display-lg": ["48px", { lineHeight: "56px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-lg": ["32px", { lineHeight: "40px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "headline-lg-mobile": ["24px", { lineHeight: "32px", fontWeight: "600" }],
        "headline-md": ["24px", { lineHeight: "32px", fontWeight: "600" }],
        "title-lg": ["18px", { lineHeight: "28px", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "28px", fontWeight: "400" }],
        "body-md": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "body-sm": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "label-md": ["12px", { lineHeight: "16px", letterSpacing: "0.05em", fontWeight: "500" }],
        "label-sm": ["10px", { lineHeight: "14px", letterSpacing: "0.05em", fontWeight: "500" }],
        "label-md-mobile": ["11px", { lineHeight: "14px", fontWeight: "500" }],
        "code-sm": ["12px", { lineHeight: "16px", fontWeight: "400" }],
      },
      borderRadius: {
        sm: "0.125rem",
        DEFAULT: "0.125rem",
        md: "0.1875rem",
        lg: "0.25rem",
        xl: "0.5rem",
      },
      spacing: {
        "margin-mobile": "16px",
        "margin-desktop": "40px",
        gutter: "24px",
        "section-gap": "64px",
        base: "8px",
      },
      maxWidth: {
        container: "1440px",
        "container-max": "1280px",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};

export default config;
