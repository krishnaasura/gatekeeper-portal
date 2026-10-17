import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    const scoutOrigin = process.env.PRICE_SCOUT_ORIGIN || "http://127.0.0.1:8091";
    return [{
      source: "/price-scout/:path*",
      destination: `${scoutOrigin}/price-scout/:path*`,
    }];
  },
};

export default nextConfig;
