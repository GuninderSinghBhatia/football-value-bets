import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray package-lock.json higher up makes Next guess the wrong workspace root.
  outputFileTracingRoot: __dirname,
  // Hide the floating "N" dev-tools button (dev only; error overlays still appear).
  devIndicators: false,
};

export default nextConfig;
