import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // mssql is a native, node-only driver: keep it out of the client bundle.
  serverExternalPackages: ["mssql"],

  /**
   * Hosts allowed to load dev resources (hot reload) cross-origin. Needed to
   * open the dev server from a phone or another PC on the office network.
   *
   * Development only — `next build` / `next start` ignore this, so it is not a
   * production exposure. Keep it to the LAN ranges actually used for testing.
   */
  allowedDevOrigins: [
    "192.168.254.*", // Barracuda VPN interface
    "192.168.68.*", // Wi-Fi
    "192.168.0.*",
    "192.168.1.*",
  ],
};

export default nextConfig;
