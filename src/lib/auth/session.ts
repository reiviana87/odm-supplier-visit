import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { CURRENT_USER } from "@/lib/mock-data";
import { isMockMode } from "@/lib/supabase/env";
import { getServerSupabase } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";
import { USER_ROLES, type Profile, type UserRole } from "@/types/domain";

/**
 * Who is signed in — server side (README §25).
 *
 * SERVER ONLY. In Phase 1 the app runs on mock data, so this resolves to the
 * seeded `CURRENT_USER` and no network call is made. With a project
 * configured it reads the Supabase session and merges the `profiles` row onto
 * the `Profile` shape the UI renders.
 */

/** "Reinaldo Viana Alves Filho" → "RA". Falls back to the email. */
function initialsFrom(fullName: string, email: string): string {
  const words = fullName.split(/\s+/).filter(Boolean);
  if (words.length === 0) return email.slice(0, 2).toUpperCase();
  const first = words[0].charAt(0);
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : "";
  return `${first}${last}`.toUpperCase();
}

function toRole(value: unknown): UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value)
    ? (value as UserRole)
    : "viewer";
}

/** Read a string out of the identity-provider metadata without widening to `any`. */
function metadataString(user: User, key: string): string | null {
  const metadata = user.user_metadata as Record<string, unknown> | undefined;
  const raw = metadata?.[key];
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
}

function toProfile(user: User, row: Tables<"profiles"> | null): Profile {
  const email = row?.email ?? user.email ?? "";
  const fullName =
    row?.full_name ??
    metadataString(user, "full_name") ??
    metadataString(user, "name") ??
    email.split("@")[0];

  return {
    id: user.id,
    fullName,
    email,
    jobTitle: row?.job_title ?? metadataString(user, "job_title") ?? "",
    role: toRole(row?.role),
    initials: row?.initials ?? initialsFrom(fullName, email),
  };
}

/** The signed-in profile, or null when nobody is signed in. */
export async function getCurrentUser(): Promise<Profile | null> {
  if (isMockMode()) return CURRENT_USER;

  const supabase = await getServerSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const { data: row } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .maybeSingle();

  return toProfile(data.user, row);
}

/**
 * The signed-in profile, or a redirect to the login screen.
 *
 * In mock mode `getCurrentUser()` always resolves, so the redirect never fires
 * and every approved screen stays reachable without a backend.
 */
export async function requireUser(): Promise<Profile> {
  const profile = await getCurrentUser();
  if (profile) return profile;
  redirect("/login");
}
