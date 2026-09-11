/**
 * Environment contract for the Supabase integration (README §25).
 *
 * Phase 1 ships without a provisioned backend: every screen renders from the
 * seeded mock data. Nothing in this module throws while it is being imported,
 * and every accessor answers "not configured" instead of failing, so the app
 * builds and runs with an empty `.env.local`.
 *
 * `NEXT_PUBLIC_*` variables are inlined by the bundler at build time, which
 * only works for a literal member expression — they are therefore read as
 * `process.env.NEXT_PUBLIC_X` and never through a computed key.
 */

/** Values shipped in `.env.example`; treated as "still not filled in". */
const PLACEHOLDERS: readonly string[] = [
  "https://your-project-ref.supabase.co",
  "your-anon-key",
  "your-service-role-key",
];

/** Trim, and collapse empty strings and untouched `.env.example` values to null. */
function clean(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || PLACEHOLDERS.includes(trimmed)) return null;
  return trimmed;
}

/** Project URL. Safe in the browser. */
export function getSupabaseUrl(): string | null {
  return clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

/**
 * Publishable (anon) key. Safe in the browser — row level security protects
 * the data, not the key. Private on purpose: clients take the URL and the key
 * together, through `getPublicSupabaseConfig()`.
 */
function getSupabaseAnonKey(): string | null {
  return clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Absolute origin of this deployment, used to build auth redirect URLs.
 * Falls back to the browser's own origin, then to the local dev server.
 */
export function getSiteUrl(): string {
  const configured = clean(process.env.NEXT_PUBLIC_SITE_URL);
  if (configured) return configured.replace(/\/+$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3000";
}

/** True once both public Supabase values are present. */
export function isSupabaseConfigured(): boolean {
  return getSupabaseUrl() !== null && getSupabaseAnonKey() !== null;
}

/**
 * True when the app must read the seeded demo data instead of Supabase.
 *
 * Opt-out is explicit: only `NEXT_PUBLIC_USE_MOCK_DATA=false` turns it off,
 * and even then an unconfigured project keeps the app on mock data rather
 * than rendering empty screens.
 *
 * Named `isMockMode` rather than `useMockData` on purpose: it is not a React
 * hook, and a `useX()` name would trip `react-hooks/rules-of-hooks` at every
 * call site outside a component.
 */
export function isMockMode(): boolean {
  const flag = clean(process.env.NEXT_PUBLIC_USE_MOCK_DATA);
  if (flag !== "false") return true;
  return !isSupabaseConfigured();
}

/** The pair needed by every browser/server client, or null when unconfigured. */
export function getPublicSupabaseConfig(): { url: string; anonKey: string } | null {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/**
 * Service-role key — SERVER ONLY. It bypasses row level security, so calling
 * this from a client bundle is a programming error and throws loudly rather
 * than returning a value that could be shipped to a browser. Returns null when
 * the key is simply not configured, which is the normal Phase 1 state.
 */
export function getServiceRoleKey(): string | null {
  if (typeof window !== "undefined") {
    throw new Error(
      "getServiceRoleKey() was called in the browser. The service-role key is server-only — " +
        "import it from a Server Component, Route Handler or Server Action.",
    );
  }
  return clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
