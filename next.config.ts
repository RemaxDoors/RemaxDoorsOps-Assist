import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // mssql is a native, node-only driver: keep it out of the client bundle.
  serverExternalPackages: ["mssql"],
};

export default nextConfig;
