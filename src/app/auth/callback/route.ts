import { NextResponse, type NextRequest } from "next/server";

import { getSiteUrl } from "@/lib/supabase/env";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * OAuth callback — the return leg of "Continue with Microsoft 365"
 * (`signInWithAzure()` in src/lib/auth/actions.ts, README §1.1).
 *
 * The provider sends the browser back here with a one-time `code`, which is
 * exchanged for a session. A Route Handler is the right place for it: unlike a
 * Server Component it is allowed to write the auth cookies.
 *
 * Register `<NEXT_PUBLIC_SITE_URL>/auth/callback` in
 * Supabase › Authentication › URL Configuration for every environment.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const providerError = requestUrl.searchParams.get("error_description");

  /**
   * `next` lets the caller resume where they were. Only a same-origin path is
   * honoured — accepting an absolute URL here would turn the callback into an
   * open redirect.
   */
  const requestedNext = requestUrl.searchParams.get("next");
  const next =
    requestedNext && requestedNext.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/";

  const origin = getSiteUrl() || requestUrl.origin;

  if (providerError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(providerError)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = await getServerSupabase();
  if (!supabase) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Sign-in is unavailable right now.")}`,
    );
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("That sign-in link has expired. Try again.")}`,
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
