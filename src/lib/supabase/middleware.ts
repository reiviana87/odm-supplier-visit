import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getPublicSupabaseConfig } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

/**
 * Refresh the Supabase auth cookie on every request (README §25).
 *
 * Server Components cannot write cookies, so the middleware is the only place
 * a rotated refresh token can be persisted. `auth.getUser()` is what triggers
 * the refresh — it must be awaited before the response is returned, and no
 * code may run between creating the client and that call.
 *
 * When the project is unconfigured this is a pass-through: Phase 1 must keep
 * working with an empty `.env.local`.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const config = getPublicSupabaseConfig();
  if (!config) return response;

  const supabase = createServerClient<Database>(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Responses that set auth cookies must never be cached by a CDN.
        for (const [key, headerValue] of Object.entries(headers)) {
          response.headers.set(key, headerValue);
        }
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}
