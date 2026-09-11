import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray lockfile in the home directory otherwise makes Turbopack pick the wrong root.
  turbopack: { root: __dirname },
  // The browser learns at build time whether files over 50 MB have somewhere
  // to go, from the same R2 variable the server reads. Restart `pnpm dev`
  // after adding R2_* to .env.local.
  env: { NEXT_PUBLIC_LARGE_UPLOADS: process.env.R2_BUCKET ? "1" : "" },
};

export default nextConfig;
