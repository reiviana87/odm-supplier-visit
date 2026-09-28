"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getBrowserSupabase } from "@/lib/supabase/client";

/**
 * Completes a password-recovery link — README §1.1.
 *
 * Supabase returns a recovery session in the URL *fragment*
 * (`#access_token=…&type=recovery`), not as a `?code=` query parameter. A
 * fragment is never sent to the server, so `/auth/callback` cannot see it and
 * bounces the user to `/login` with the tokens still stuck on the URL. That is
 * where this runs: in the browser, where the fragment is readable.
 *
 * It hands the tokens to the browser client, which writes the session cookies
 * `@supabase/ssr` shares with the server, and then sends the user on to choose
 * a password. Without this the reset link appears to fail for no reason.
 */
export function RecoveryHandoff() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "working" | "failed">("idle");

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("access_token")) return;

    const params = new URLSearchParams(hash.slice(1));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (!access_token || !refresh_token) return;

    let cancelled = false;

    // Everything that touches state happens after an await, so nothing is set
    // synchronously while the effect is still running.
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setState("working");

      const client = getBrowserSupabase();
      if (!client) {
        setState("failed");
        return;
      }

      const { error } = await client.auth.setSession({ access_token, refresh_token });

      // Clear the tokens off the address bar either way: they are credentials,
      // and leaving them in history or a copied URL is careless.
      window.history.replaceState(null, "", window.location.pathname);
      if (cancelled) return;

      if (error) {
        setState("failed");
        return;
      }
      // `recovery` means "choose a password"; any other type is an ordinary
      // sign-in that belongs on the dashboard.
      router.replace(params.get("type") === "recovery" ? "/set-password" : "/");
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (state === "idle") return null;

  return (
    <p
      role="status"
      style={{
        fontSize: 11.5,
        color: state === "failed" ? "var(--color-danger-ink)" : "var(--color-accent-800)",
        background:
          state === "failed" ? "var(--color-danger-bg)" : "var(--color-accent-100)",
        border: `1px solid ${
          state === "failed" ? "var(--color-danger-border)" : "var(--color-accent-300)"
        }`,
        padding: "8px 10px",
        marginBottom: 14,
      }}
    >
      {state === "working"
        ? "Opening your reset link…"
        : "That reset link has already been used or has expired. Ask for a new one below."}
    </p>
  );
}
