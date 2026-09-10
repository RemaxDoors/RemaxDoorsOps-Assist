import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Montserrat } from "next/font/google";
import { CookieConsent } from "@/components/layout/CookieConsent";
import { Footer } from "@/components/layout/Footer";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

/** Montserrat 400/700 — the typeface used on remaxdoors.com. */
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Operation Help — remax DOORS",
  description: "Operations workspace for remax DOORS",
  // manifest.ts supplies the rest; iOS ignores it and needs these directly.
  appleWebApp: {
    capable: true,
    title: "Operation Help",
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
    <html lang="en" className={montserrat.variable} suppressHydrationWarning>
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
