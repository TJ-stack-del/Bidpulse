import type { MetadataRoute } from "next";

// Next's file-convention manifest route -- serves at /manifest.webmanifest.
// Icon uses app/icon.svg directly (sizes: "any" is the standard way to
// declare a scalable vector icon in a manifest) rather than a rasterized
// PNG set, since that's the only format the new brand assets ship in.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BidPulse",
    short_name: "BidPulse",
    description:
      "Done-for-you bid prep for small trade contractors bidding on local government contracts.",
    start_url: "/",
    display: "standalone",
    background_color: "#0A182F",
    theme_color: "#0A182F",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
