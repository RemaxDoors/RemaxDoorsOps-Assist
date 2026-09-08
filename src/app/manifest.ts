import type { MetadataRoute } from "next";

/**
 * Makes the app installable to a phone's home screen.
 *
 * The point is a one-tap entry for technicians without rebuilding anything.
 * Installed, it launches in a top-level browser context with no address bar —
 * which matters more than it sounds: App Service Authentication signs people
 * in by redirecting to Microsoft, and a redirect cannot complete inside an
 * iframe. Anything that frames the app (a Teams tab, for instance) would need
 * its own token exchange and would put application-level authentication back.
 * This route keeps the platform as the only login boundary.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Operation Help — remax DOORS",
    // What fits under an icon; the long name is truncated on most launchers.
    short_name: "Operation Help",
    description:
      "Raise and resolve non-conformances against M1, from the floor or the field.",

    // Opens on the dashboard rather than the sign-in page: an installed app
    // that lands on a landing page feels like a bookmark, not an app.
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",

    // White, matching the icon plate, so the splash screen does not flash a
    // colour the brand does not use.
    background_color: "#ffffff",
    theme_color: "#ea0029",

    categories: ["business", "productivity"],
    lang: "en-AU",
    dir: "ltr",

    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      /**
       * Android crops maskable icons to a circle or squircle, so this one
       * keeps the chevron inside the 80% safe zone. Without it the launcher
       * pads the square icon and the mark ends up small and off-centre.
       */
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],

    shortcuts: [
      {
        name: "Raise an NCR",
        short_name: "Add NCR",
        description: "Start a new non-conformance report",
        url: "/ncr/new",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
