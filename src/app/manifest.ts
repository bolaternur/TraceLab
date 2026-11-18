import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.productName,
    short_name: brand.shortName,
    description: brand.tagline,
    start_url: "/app",
    display: "standalone",
    background_color: "#0b0b0e",
    theme_color: "#0b0b0e",
    icons: [
      { src: "/brand/iznera-mark.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/brand/iznera-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/iznera-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
    shortcuts: [{ name: "Capture", url: "/app/capture", description: "Photo, problem, test, decision" }],
  };
}
