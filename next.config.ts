import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["esbuild-wasm"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.cloudfront.net",
      },
      {
        protocol: "https",
        hostname: "dgalywyr863hv.cloudfront.net",
      },
    ],
  },
};

export default nextConfig;
