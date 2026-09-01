import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Montserrat } from "next/font/google";
import { CookieConsent } from "@/components/layout/CookieConsent";
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
    <html lang="en" className={montserrat.variable}>
      <body>
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
