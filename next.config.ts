import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Suppress noisy env var warnings during build
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Realtime needs long-lived connections — allow longer timeout on edge
  experimental: {},
};

export default nextConfig;
