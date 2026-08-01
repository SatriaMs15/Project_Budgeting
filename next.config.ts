import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Statement PDFs and receipt photos exceed the 1MB Server Action default.
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
