import { ImageResponse } from "next/og";

// Simple text-based favicon — "BP" on the brand green — until a real
// designed logo exists. Next.js picks this up automatically as the
// favicon/app icon for every route (file-based convention, no <link> tag
// or static asset needed).
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f6e7a",
          color: "#ffffff",
          fontSize: 18,
          fontWeight: 700,
          fontFamily: "sans-serif",
          borderRadius: 6,
        }}
      >
        BP
      </div>
    ),
    { ...size }
  );
}
