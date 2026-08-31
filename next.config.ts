import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["chrome-remote-interface", "@sparticuz/chromium"],
  outputFileTracingIncludes: {
    "/api/games": ["./node_modules/@sparticuz/chromium/**/*"],
  },
};

export default nextConfig;
