import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";

import { ToastProvider } from "@/components/ui/toast";

import "./globals.css";

/**
 * README §3.1 — Barlow (body) and Barlow Condensed (headings), 400/600.
 * The design system's stylesheet links them from Google Fonts; next/font
 * self-hosts the same faces so there is no render-blocking third-party
 * request and no layout shift.
 */
const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ODM Supplier Visit",
    template: "%s · ODM Supplier Visit",
  },
  description:
    "Factory visit documentation, supplier intelligence and corporate report generation for the EBARA Global Sourcing Office.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1d2d3d",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${barlow.variable} ${barlowCondensed.variable}`}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
