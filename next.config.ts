import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  // Bakes the deploying commit's SHA into the client bundle so the app can
  // detect when a newer deploy has gone live (see components/UpdateNotice.tsx).
  env: {
    GIT_SHA: (process.env.VERCEL_GIT_COMMIT_SHA || "local").slice(0, 7),
  },
};

export default nextConfig;
