import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.productName,
    short_name: brand.shortName,
    description: brand.tagline,
    start_url: "/app",
    display: "standalone",
    background_color: "#F6F7F2",
    theme_color: "#4169FF",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
    shortcuts: [{ name: "Capture", url: "/app/capture", description: "Photo, problem, test, decision" }],
  };
}
