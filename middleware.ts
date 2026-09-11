import type { NextRequest, NextResponse } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/**
 * Edge middleware — session refresh only.
 *
 * It deliberately DOES NOT redirect anyone in Phase 1. Auth gating belongs in
 * the application layout, where it can be switched on once a Supabase project
 * exists; keeping it out of the middleware means every approved screen stays
 * reachable while the app runs on mock data with no backend configured.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Every path except:
     * - _next/static      build output
     * - _next/image       the image optimiser
     * - favicon.ico
     * - brand/ and photos/  public assets
     * - any file with an extension (svg, png, jpg, webp, ico, docx, xlsx, …)
     */
    "/((?!_next/static|_next/image|favicon.ico|brand/|photos/|.*\\.[\\w]+$).*)",
  ],
};
