import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

/**
 * Visit Mode lives outside the desktop app shell — README §17: "A deliberately
 * small surface for use inside a factory: **not** the desktop editor", and
 * README §18: "Visit Mode is the mobile product". So this route gets its own
 * layout: no sidebar, no top bar, no 1280px minimum, and phone viewport
 * metadata instead.
 *
 * Zoom is pinned at 1× because the screen is used one-handed on a factory
 * floor and a stray pinch on the viewfinder should not scale the chrome.
 */
export const metadata: Metadata = {
  // Absolute: the phone tab shows the product surface, not the suite name.
  title: { absolute: "Visit Mode" },
  description:
    "Field capture for an open factory visit: photos, notes and observations, queued locally.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // var(--color-accent-900) — metadata cannot read a custom property.
  themeColor: "#1d2d3d",
};

export default function VisitLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
