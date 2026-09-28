import type { Metadata, Viewport } from "next";
import { APP_NAME } from "@/lib/version";
import type { ReactNode } from "react";
/**
 * Montserrat, self-hosted.
 *
 * next/font/google downloaded these files during the build, which made every
 * deploy depend on the CI runner reaching fonts.googleapis.com. It stopped
 * being reachable and the build failed with twenty module-not-found errors
 * that said nothing about the network. Shipping the font as a dependency
 * removes that failure mode, and stops every visitor's browser calling Google.
 */
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/montserrat/800.css";
import { CookieConsent } from "@/components/layout/CookieConsent";
import { Footer } from "@/components/layout/Footer";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  /**
   * The template is what stops the name being typed into every page's
   * metadata: a page supplies only its own title and gets "Dashboard · NCR".
   */
  title: {
    default: `${APP_NAME} — remax DOORS`,
    template: `%s · ${APP_NAME}`,
  },
  description: "Non-conformance reporting for remax DOORS",
  // manifest.ts supplies the rest; iOS ignores it and needs these directly.
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

/**
 * Two entries so the browser chrome follows the theme rather than always
 * showing brand red — on a dark phone a red status bar looks like an alert.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1f1f1f" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Applies the saved theme before anything paints. Doing it in React
          would render light first and flip on hydrate, which is a visible
          flash on every navigation for anyone using dark.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      {/*
        The footer lives here rather than in AppShell so it reaches every page,
        including the sign-in screen and anything Next renders itself. Children
        take the remaining height, so it sits at the bottom of a short page and
        below the content of a long one.
      */}
      <body className="flex min-h-screen flex-col">
        <div className="flex flex-1 flex-col">{children}</div>
        <Footer />
        <CookieConsent />
      </body>
    </html>
  );
}
