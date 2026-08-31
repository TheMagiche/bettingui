import type { NextConfig } from "next";

const dockerBuild = process.env.DOCKER_BUILD === "1";

const nextConfig: NextConfig = {
  output: "standalone",
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
