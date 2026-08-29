import type { Config } from "tailwindcss";

// Design tokens updated to the new BidPulse mockups (green #006c49 accent,
// Inter + JetBrains Mono, sharper corners, neutral-gray surfaces replacing
// the old blue-tinted ones). This is a shared, global file — the token
// values below affect every page in the app, not just the ones the new
// mockups cover (home, pricing, gallery, intake). `full` is deliberately
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
        surface: "#f7f9fb",
        "surface-dim": "#d8dadc",
        "surface-bright": "#f7f9fb",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f2f4f6",
        "surface-container": "#eceef0",
        "surface-container-high": "#e6e8ea",
        "surface-container-highest": "#e0e3e5",
        "on-surface": "#191c1e",
        "on-surface-variant": "#44474d",
        "inverse-surface": "#2d3133",
        "inverse-on-surface": "#eff1f3",
        outline: "#75777e",
        "outline-variant": "#c5c6cd",
        "surface-tint": "#515f78",
        primary: "#000000",
        "on-primary": "#ffffff",
        "primary-container": "#0d1c32",
        "on-primary-container": "#76849f",
        "inverse-primary": "#b9c7e4",
        secondary: "#006c49",
        "on-secondary": "#ffffff",
        "secondary-container": "#6cf8bb",
        "on-secondary-container": "#00714d",
        tertiary: "#000000",
        "on-tertiary": "#ffffff",
        "tertiary-container": "#0b1c30",
        "on-tertiary-container": "#75859d",
        error: "#ba1a1a",
        "on-error": "#ffffff",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a",
        "primary-fixed": "#d6e3ff",
        "primary-fixed-dim": "#b9c7e4",
        "on-primary-fixed": "#0d1c32",
        "on-primary-fixed-variant": "#39475f",
        "secondary-fixed": "#6ffbbe",
        "secondary-fixed-dim": "#4edea3",
        "on-secondary-fixed": "#002113",
        "on-secondary-fixed-variant": "#005236",
        "tertiary-fixed": "#d3e4fe",
        "tertiary-fixed-dim": "#b7c8e1",
        "on-tertiary-fixed": "#0b1c30",
        "on-tertiary-fixed-variant": "#38485d",
        background: "#f7f9fb",
        "on-background": "#191c1e",
        "surface-variant": "#e0e3e5",
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
