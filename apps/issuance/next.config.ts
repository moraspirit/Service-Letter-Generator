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
};

export default nextConfig;
