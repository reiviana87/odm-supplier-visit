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
 * Send a password reset email — README §1.1.
 *
 * This exists because an account can legitimately have no password at all: a
 * user created by `create-admin` is invited rather than given one, and if that
 * invitation never arrives there is otherwise no way into the application.
 *
 * The reply is deliberately the same whether or not the address is registered.
 * Telling a stranger which corporate addresses exist is a disclosure the reset
 * flow does not need to make.
 */
export async function requestPasswordReset(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter your work email so we know where to send the link." };

  if (isMockMode()) return { ok: true };

  const supabase = await getServerSupabase();
  if (!supabase) return { error: SERVER_UNAVAILABLE };

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getSiteUrl()}/auth/callback?next=/set-password`,
  });

  return { ok: true };
}

/**
 * Set the password of the signed-in user.
 *
 * Reached from the reset link, which lands with a session already established,
 * so the only thing left is to choose the password. It is also reachable from
 * Settings by anyone who simply wants to change theirs.
 */
export async function setPassword(formData: FormData): Promise<AuthResult> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 10) {
    return { error: "Use at least 10 characters. Length is what makes a password hard to guess." };
  }
  if (password !== confirm) {
    return { error: "The two passwords do not match." };
  }

  if (isMockMode()) redirect("/");

  const supabase = await getServerSupabase();
  if (!supabase) return { error: SERVER_UNAVAILABLE };

  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return {
      error: "That reset link has expired. Ask for a new one from the sign-in screen.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: "The password could not be set. Try a different one." };
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
