import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["esbuild-wasm"],
};

export default nextConfig;
