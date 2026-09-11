"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSiteUrl, isMockMode } from "@/lib/supabase/env";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Authentication server actions — README §1.1 (Login).
 *
 * The login card has two buttons: "Sign in" (work email + password) and
 * "Continue with Microsoft 365" (Entra ID, the `azure` provider in Supabase).
 *
 * Nothing here throws at the caller: every failure comes back as a typed
 * result so the form can render the message in place, per README §22
 * ("never blame the user, always say what happened to their data"). The one
 * non-return is `redirect()`, which is how Next signals navigation.
 */

export type AuthResult = { ok: true } | { error: string };

/** README §22 — the approved copy for an unreachable backend. */
const SERVER_UNAVAILABLE =
  "The server is not responding. Work continues locally and will sync when it returns.";

/**
 * Email + password sign-in.
 *
 * In mock mode there is no backend to authenticate against, so the action
 * simply opens the dashboard — Phase 1 renders the approved screens from the
 * seeded data.
 */
export async function signInWithPassword(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your work email and password to continue." };
  }

  if (isMockMode()) {
    redirect("/");
  }

  const supabase = await getServerSupabase();
  if (!supabase) return { error: SERVER_UNAVAILABLE };

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "Those credentials were not accepted. Check the email and password, then try again." };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Microsoft 365 (Entra ID) single sign-on. Supabase returns the provider URL
 * and the browser is redirected to it; the provider then calls back to
 * `${NEXT_PUBLIC_SITE_URL}/auth/callback`, which exchanges the code for a
 * session.
 */
export async function signInWithAzure(): Promise<AuthResult> {
  if (isMockMode()) {
    redirect("/");
  }

  const supabase = await getServerSupabase();
  if (!supabase) return { error: SERVER_UNAVAILABLE };

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "azure",
    options: {
      redirectTo: `${getSiteUrl()}/auth/callback`,
      scopes: "email offline_access",
    },
  });

  if (error || !data.url) {
    return {
      error: "Microsoft 365 sign-in is unavailable right now. Sign in with your work email instead.",
    };
  }

  redirect(data.url);
}

/** End the session and return to the login screen. */
export async function signOut(): Promise<AuthResult> {
  const supabase = await getServerSupabase();

  if (supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return { error: "Sign out failed. You are still signed in — try again." };
    }
  }

  revalidatePath("/", "layout");
  redirect("/login");
}
