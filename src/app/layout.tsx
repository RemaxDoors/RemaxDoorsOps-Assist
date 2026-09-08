import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Montserrat } from "next/font/google";
import { CookieConsent } from "@/components/layout/CookieConsent";
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
      <body>
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
