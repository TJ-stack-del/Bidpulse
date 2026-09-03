import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import "./globals.css";

export const metadata: Metadata = {
  // Required for opengraph-image.tsx's generated image to resolve to an
  // absolute URL in production rather than falling back to localhost.
  metadataBase: new URL("https://bidpulse.co"),
  title: {
    default: "BidPulse",
    template: "%s — BidPulse",
  },
  description: "Done-for-you bid prep for small trade contractors — HVAC, janitorial, and landscaping businesses bidding on local government contracts.",
};

export const viewport: Viewport = {
  themeColor: "#0A182F",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning is next-themes' documented requirement: it
    // sets the "dark"/"light" class on <html> via an inline script that
    // runs before React hydrates, specifically to avoid a flash of the
    // wrong theme — which necessarily makes the server-rendered and
    // first-client-render <html> attributes differ. Only suppresses the
    // warning on this one element, not real mismatches elsewhere.
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@500&display=swap"
        />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
