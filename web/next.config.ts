import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: process.env.NODE_ENV === "production",
  /** Smaller self-hosted deploy (Linode/VPS) — run `.next/standalone/web/server.js`. */
  output: "standalone",
};

export default nextConfig;
