import type { MetadataRoute } from "next";

// Makes the site installable as a real app (icon, name, full-screen).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Jamie's Money",
    short_name: "Money",
    description: "A simple view of how you're doing.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f5f1",
    theme_color: "#f6f5f1",
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
