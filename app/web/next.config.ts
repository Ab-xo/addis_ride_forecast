import type { NextConfig } from "next";

// Static export: the FastAPI server in app/app.py serves the built files from app/web/out/.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  // Fixed, lowercase build id so rebuilds produce stable file names.
  generateBuildId: async () => "addis-ride-demand",
};

export default nextConfig;
