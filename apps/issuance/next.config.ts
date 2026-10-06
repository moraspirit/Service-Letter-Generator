import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Docker runtime image (Phase 8) copies only this self-contained bundle.
  output: "standalone",
  reactCompiler: true,
  // Workspace packages ship TypeScript source and are compiled by the app.
  transpilePackages: [
    "@moraspirit/db",
    "@moraspirit/shared",
    "@moraspirit/certificate-render",
    "@moraspirit/certificate-templates",
    "@moraspirit/ui",
  ],
  // Node-only browser driver: keep it out of the bundle.
  serverExternalPackages: ["puppeteer-core"],
  // Spreadsheet uploads arrive as Server Action bodies; the importer itself caps files at 5 MB.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  async headers() {
    return [
      {
        // The live preview renders inside a sandboxed iframe (opaque origin), which can only
        // load these fonts and images with CORS. They are public letterhead artwork.
        source: "/certificate-assets/:path*",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
    ];
  },
};

export default nextConfig;
