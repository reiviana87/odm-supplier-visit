import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { getPublicSupabaseConfig, getSupabaseSecretKey, getSupabaseUrl } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

/**
 * Server-side Supabase clients (README §25).
 *
 * SERVER ONLY — this module reads `next/headers` and the service-role key and
 * must never be imported from a Client Component. Both factories return null
 * while the project is unconfigured, which is the normal Phase 1 state.
 */

/**
 * Request-scoped client bound to the incoming cookies. A new client is created
 * for every render: sharing one across requests would leak sessions.
 */
export async function getServerSupabase(): Promise<SupabaseClient<Database> | null> {
  const config = getPublicSupabaseConfig();
  if (!config) return null;

  // Next 16: `cookies()` is async.
  const cookieStore = await cookies();

  return createServerClient<Database>(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Expected inside a Server Component: only Route Handlers and Server
          // Actions may write cookies. The refreshed session is still written
          // by `updateSession()` in the middleware, so it is safe to ignore.
        }
      },
    },
  });
}

/**
 * Secret-key client — bypasses row level security. Use it only for
 * privileged server work (seeding, migrations, admin actions), never to serve
 * a user request that should be filtered by RLS. It holds no session, so a
 * single instance can be reused across requests.
 */
let serviceClient: SupabaseClient<Database> | null = null;

export function getServiceSupabase(): SupabaseClient<Database> | null {
  const url = getSupabaseUrl();
  const secretKey = getSupabaseSecretKey();
  if (!url || !secretKey) return null;

  serviceClient ??= createClient<Database>(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return serviceClient;
}
