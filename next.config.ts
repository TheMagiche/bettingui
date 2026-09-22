import type { NextConfig } from "next";

const dockerBuild = process.env.DOCKER_BUILD === "1";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_IS_VERCEL: process.env.VERCEL === "1" ? "1" : "",
  },
  output: process.env.VERCEL ? undefined : "standalone",
  serverExternalPackages: ["chrome-remote-interface", "@sparticuz/chromium"],
  ...(dockerBuild
    ? {
        outputFileTracingExcludes: {
          "/api/games": ["./node_modules/@sparticuz/chromium/**/*"],
        },
      }
    : {
        outputFileTracingIncludes: {
          "/api/games": ["./node_modules/@sparticuz/chromium/**/*"],
        },
      }),
};

export default nextConfig;
