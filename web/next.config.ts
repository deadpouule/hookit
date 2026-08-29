import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: process.env.NODE_ENV === "production",
  // Standalone is for Linode/VPS only — Vercel expects the default output (NFT trace).
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
};

export default nextConfig;
