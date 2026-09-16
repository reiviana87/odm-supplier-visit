"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { MockModeBanner } from "@/components/layout/mock-mode-banner";
import { signOut } from "@/lib/auth/actions";
import type { Profile } from "@/types/domain";

import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

/**
 * The approved application shell — README §2.
 *
 *   App wrapper: display flex · min-width 1280px · min-height 100vh
 *                background var(--color-bg)
 *
 * The 1280px minimum is deliberate: the approved design is desktop-first and
 * README §18 specifies only the desktop row. Narrower viewports scroll the
 * shell horizontally rather than reflowing it, so nothing about the approved
 * layout changes. Phones get Visit Mode (/visit), which is the mobile product.
 *
 * Prototype: design-handoff/ODM Supplier Visit.dc.html lines 111..180.
 */
export function AppShell({
  user,
  children,
}: {
  user: Profile;
  children: ReactNode;
}) {
  const router = useRouter();

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
      <div
        className="flex items-stretch"
        style={{ minWidth: "var(--shell-min-width)", minHeight: "100vh" }}
      >
        <Sidebar
          user={user}
          onSignOut={() => {
            void signOut();
          }}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* README §1 — /reports/new is the wizard's own address. The picker
              it opens with is read on the server, so the shell sends the user
              to the route rather than mounting a second copy of the wizard on
              every screen with nothing to populate it from. */}
          <TopBar onNewReport={() => router.push("/reports/new")} />
          {/* Renders nothing once a Supabase project is connected. */}
          <MockModeBanner />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </div>
  );
}
