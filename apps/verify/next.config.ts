import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Workspace packages ship TypeScript source and are compiled by the app.
  transpilePackages: [
    "@moraspirit/db",
    "@moraspirit/shared",
    "@moraspirit/certificate-render",
    "@moraspirit/ui",
  ],
  async headers() {
    return [
      {
        // Never cached anywhere: a revocation or edit must show on the very next scan
        // (architecture §6 D). Not indexed, and the certificate id in the URL is not leaked
        // through the Referer header.
        source: "/verify/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        // The full certificate renders inside a sandboxed iframe (opaque origin), which can only
        // load these fonts and images with CORS. They are public letterhead artwork.
        source: "/certificate-assets/:path*",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
    ];
  },
};

export default nextConfig;
