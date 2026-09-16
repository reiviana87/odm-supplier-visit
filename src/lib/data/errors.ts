/**
 * The result contract for every data-layer call.
 *
 * Phase 2 §27: users see a sentence about their own work, never a raw
 * PostgREST error. Every query and mutation in `src/lib/data` returns a
 * `DataResult` rather than throwing, so callers decide what to render and
 * nothing leaks to the UI by accident. Diagnostics go to the server log.
 */

export const DATA_ERROR_CODES = [
  /** No row matched — a bad id, or a row this user may not read. */
  "not_found",
  /** RLS refused, or the signed-in role is not allowed to do this. */
  "forbidden",
  /** No session. The layout sends the user back to /login. */
  "unauthenticated",
  /** A unique constraint rejected the write (document number, supplier code). */
  "conflict",
  /** Optimistic concurrency: someone else saved a newer version. */
  "stale",
  /** The payload failed validation before it reached the database. */
  "invalid",
  /** The request never completed — offline, DNS, timeout. */
  "offline",
  /** Anything else. The message stays generic; the detail is logged. */
  "unknown",
] as const;

export type DataErrorCode = (typeof DATA_ERROR_CODES)[number];

export interface DataError {
  code: DataErrorCode;
  /** Safe to render. Written in the handoff's voice (README §22). */
  message: string;
  /**
   * Field-level messages for `invalid`, keyed by the form field name, so a
   * server-side validation failure can be shown in place.
   */
  fieldErrors?: Record<string, string>;
}

export type DataResult<T> = { ok: true; data: T } | { ok: false; error: DataError };

export function ok<T>(data: T): DataResult<T> {
  return { ok: true, data };
}

export function fail<T = never>(
  code: DataErrorCode,
  message?: string,
  fieldErrors?: Record<string, string>,
): DataResult<T> {
  return {
    ok: false,
    error: { code, message: message ?? DEFAULT_MESSAGES[code], fieldErrors },
  };
}

/**
 * README §22 — "never blame the user, always state what happened to their
 * data, always offer the retry."
 */
export const DEFAULT_MESSAGES: Record<DataErrorCode, string> = {
  not_found: "That record could not be found. It may have been archived or removed.",
  forbidden: "You do not have permission to do that. Ask an administrator for access.",
  unauthenticated: "Your session expired. Sign in again — your unsaved work is kept on this device.",
  conflict: "That value is already in use. Choose a different one.",
  stale: "A newer version of this report exists. Reload before saving so nothing is overwritten.",
  invalid: "Some fields need attention before this can be saved.",
  offline: "The server is not responding. Work continues locally and will sync when it returns.",
  unknown: "Something went wrong. Nothing was changed — try again.",
};

/** Postgres error codes worth mapping to something a user can act on. */
const PG_UNIQUE_VIOLATION = "23505";
const PG_FOREIGN_KEY_VIOLATION = "23503";
const PG_CHECK_VIOLATION = "23514";
const PG_INSUFFICIENT_PRIVILEGE = "42501";
/** PostgREST returns this when `.single()` matched no rows. */
const PGRST_NO_ROWS = "PGRST116";

interface SupabaseLikeError {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}

/**
 * Turns a Supabase/PostgREST error into a `DataError`.
 *
 * `context` names the operation in the server log so a support question can be
 * traced without the user ever seeing the underlying message.
 */
export function toDataError(error: unknown, context: string): DataError {
  const supabaseError = error as SupabaseLikeError | null;
  const code = supabaseError?.code ?? "";

  // Log the real thing for developers; never return it.
  console.error(`[data:${context}]`, error);

  if (code === PGRST_NO_ROWS) {
    return { code: "not_found", message: DEFAULT_MESSAGES.not_found };
  }
  if (code === PG_UNIQUE_VIOLATION) {
    return { code: "conflict", message: DEFAULT_MESSAGES.conflict };
  }
  if (code === PG_INSUFFICIENT_PRIVILEGE || code.startsWith("42501")) {
    return { code: "forbidden", message: DEFAULT_MESSAGES.forbidden };
  }
  if (code === PG_FOREIGN_KEY_VIOLATION) {
    return {
      code: "conflict",
      message:
        "That record is still referenced by something else, so it cannot be changed this way.",
    };
  }
  if (code === PG_CHECK_VIOLATION) {
    return { code: "invalid", message: DEFAULT_MESSAGES.invalid };
  }

  const message = supabaseError?.message ?? "";
  if (/fetch failed|network|ENOTFOUND|ECONNREFUSED|timeout/i.test(message)) {
    return { code: "offline", message: DEFAULT_MESSAGES.offline };
  }
  if (/jwt|token|session/i.test(message)) {
    return { code: "unauthenticated", message: DEFAULT_MESSAGES.unauthenticated };
  }

  return { code: "unknown", message: DEFAULT_MESSAGES.unknown };
}

/** The unique constraint a `conflict` came from, when the caller can tell. */
export function uniqueConflict(field: string, message: string): DataError {
  return { code: "conflict", message, fieldErrors: { [field]: message } };
}
