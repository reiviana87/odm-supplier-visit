"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getPublicSupabaseConfig } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

/**
 * Browser Supabase client (README §25).
 *
 * One instance per tab: the auth listener and the realtime socket must not be
 * duplicated across renders, so the client is memoised in a module singleton.
 * Returns null while the project is unconfigured — Phase 1 runs on mock data,
 * and callers are expected to fall back rather than assume a client exists.
 */
let browserClient: SupabaseClient<Database> | null = null;

export function getBrowserSupabase(): SupabaseClient<Database> | null {
  const config = getPublicSupabaseConfig();
  if (!config) return null;

  browserClient ??= createBrowserClient<Database>(config.url, config.anonKey);
  return browserClient;
}
