import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    nodeMiddleware: true as any,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com" },
    ],
  },
};

export default nextConfig;
