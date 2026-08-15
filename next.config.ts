import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  // Server Actions cap the request body at 1MB by default, which a resume PDF
  // or a scanned lease can pass on its own. Raised so uploads land instead of
  // failing with a size error. The action itself holds files to 5MB, leaving
  // room for what multipart adds around the file.
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
  // Bakes the deploying commit's SHA into the client bundle so the app can
  // detect when a newer deploy has gone live (see components/UpdateNotice.tsx).
  env: {
    GIT_SHA: (process.env.VERCEL_GIT_COMMIT_SHA || "local").slice(0, 7),
  },
};

export default nextConfig;
