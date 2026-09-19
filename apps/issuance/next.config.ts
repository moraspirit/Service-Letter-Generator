import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Workspace packages ship TypeScript source and are compiled by the app.
  transpilePackages: [
    "@moraspirit/db",
    "@moraspirit/shared",
    "@moraspirit/certificate-render",
    "@moraspirit/certificate-templates",
  ],
  // Node-only browser driver: keep it out of the bundle.
  serverExternalPackages: ["puppeteer-core"],
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
