import type { NextConfig } from "next";
import { MAX_UPLOAD_BODY_LIMIT } from "./lib/upload-limits";

const nextConfig: NextConfig = {
  experimental: {
    // Statement PDFs and receipt photos exceed the 1MB Server Action default.
    // The ceiling is Vercel's 4.5MB request-body cap, not a preference — see
    // lib/upload-limits.ts, which the import form quotes from too.
    serverActions: { bodySizeLimit: MAX_UPLOAD_BODY_LIMIT },
  },
};

export default nextConfig;
