import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SetPasswordForm } from "@/components/auth/set-password-form";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Set your password",
};

/**
 * Set or change a password — README §1.1.
 *
 * Two ways in. A reset link lands here with a session already established, so
 * the user only has to choose the password; and anyone signed in can reach it
 * to change theirs.
 *
 * It sits outside the `(app)` group on purpose: somebody arriving from a reset
 * link should not be shown the sidebar and a dashboard they have not asked for
 * before they have finished getting in.
 */
export default async function SetPasswordPage() {
  const user = await getCurrentUser();

  // No session means the link expired or was already used. Saying so on the
  // sign-in screen is more useful than a blank form that cannot succeed.
  if (!user) redirect("/login?error=link-expired");

  return (
    <div
      className="flex items-center justify-center"
      style={{ minHeight: "100vh", background: "var(--color-bg)", padding: 24 }}
    >
      <SetPasswordForm email={user.email} />
    </div>
  );
}
