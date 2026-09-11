import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth/session";

/**
 * Authenticated layout — everything inside the approved desktop shell.
 *
 * README §13: Phase 1 implements the authentication foundation (login screen,
 * layout protection, logout, session handling). Gating lives here rather than
 * in middleware so the approved screens stay reachable while Supabase is
 * unconfigured — in mock mode `requireUser()` resolves to the seeded profile
 * and never redirects; with a real project it sends a signed-out visitor to
 * /login.
 */
export default async function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();

  return <AppShell user={user}>{children}</AppShell>;
}
