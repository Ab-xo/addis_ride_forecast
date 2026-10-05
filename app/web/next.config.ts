import type { NextConfig } from "next";

// Two ways to ship the same front end:
// • Local / judges' demo (default): a static export in out/, served by the FastAPI app (python app/app.py),
//   which answers /api/* itself.
// • Vercel (VERCEL=1 is set by Vercel during the build, or NEXT_OUTPUT=server locally): a normal Next.js build
//   whose route handlers (app/api/**/route.server.ts) answer /api/* from data/*.json, the FastAPI responses
//   pre-computed by `python app/export_static_api.py`.
const serverMode = Boolean(process.env.VERCEL) || process.env.NEXT_OUTPUT === "server";

const nextConfig: NextConfig = serverMode
  ? {
      // route.server.ts files are only picked up in this mode.
      pageExtensions: ["tsx", "ts", "server.ts"],
      images: { unoptimized: true },
      env: { NEXT_PUBLIC_SERVER_MODE: "1" },
    }
  : {
      output: "export",
      images: { unoptimized: true },
      trailingSlash: true,
      // Fixed, lowercase build id so rebuilds produce stable file names.
      generateBuildId: async () => "addis-ride-demand",
    };

export default nextConfig;
