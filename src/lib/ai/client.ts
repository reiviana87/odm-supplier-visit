import "server-only";

import Anthropic from "@anthropic-ai/sdk";

/**
 * Anthropic client — SERVER ONLY (README §12, §13).
 *
 * `server-only` is imported for its side effect: it makes the build fail if a
 * client component ever pulls this module in, which is a stronger guarantee
 * than remembering not to. The key is read from `ANTHROPIC_API_KEY`, which
 * carries no `NEXT_PUBLIC_` prefix and therefore never reaches a bundle.
 *
 * Missing configuration is a normal state, not an error: the report has to stay
 * fully usable without AI (§12), so every accessor answers "not configured" and
 * the UI says so rather than failing.
 */

/**
 * The model the assistant runs on. Configurable because the right model changes
 * faster than this code does; the default is a current Sonnet-class model,
 * which is the sensible balance of quality and latency for report drafting.
 */
const DEFAULT_MODEL = "claude-sonnet-5";

export function getAnthropicModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

function getApiKey(): string | null {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  return key && key !== "your-anthropic-api-key" ? key : null;
}

/** True once the assistant can actually be called. */
export function isAiConfigured(): boolean {
  return getApiKey() !== null;
}

let client: Anthropic | null = null;

/** The shared client, or null when no key is configured. */
export function getAnthropic(): Anthropic | null {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  client ??= new Anthropic({ apiKey });
  return client;
}

/** What every AI entry point answers with. Mirrors `DataResult` deliberately. */
export type AiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: AiErrorCode; message: string } };

export type AiErrorCode =
  | "not_configured"
  | "rate_limited"
  | "invalid_response"
  | "too_large"
  | "unknown";

export function aiOk<T>(data: T): AiResult<T> {
  return { ok: true, data };
}

export function aiFail<T>(code: AiErrorCode, message?: string): AiResult<T> {
  return { ok: false, error: { code, message: message ?? AI_MESSAGES[code] } };
}

export const AI_MESSAGES: Record<AiErrorCode, string> = {
  not_configured:
    "AI is not configured. Add an ANTHROPIC_API_KEY to enable the assistant — everything else in the report works without it.",
  rate_limited: "The assistant is busy. Wait a moment and try again.",
  invalid_response: "The assistant returned something this screen could not read. Nothing was changed.",
  too_large: "There is too much text for one request. Shorten the selection and try again.",
  unknown: "The assistant could not be reached. Nothing was changed.",
};

/**
 * Maps an SDK failure onto a code the UI can act on.
 *
 * Deliberately narrow: anything unrecognised is `unknown` with the generic
 * sentence, because a raw provider message in the interface is noise at best
 * and a leak at worst (§28).
 */
export function toAiError(error: unknown): { code: AiErrorCode; message: string } {
  if (error instanceof Anthropic.APIError) {
    if (error.status === 429) return { code: "rate_limited", message: AI_MESSAGES.rate_limited };
    if (error.status === 413) return { code: "too_large", message: AI_MESSAGES.too_large };
  }
  // Logged server-side only; the user gets the sentence above.
  console.error("[ai]", error instanceof Error ? error.message : error);
  return { code: "unknown", message: AI_MESSAGES.unknown };
}

/** Hard ceiling on what we will send, so one huge transcript cannot stall a request. */
export const MAX_INPUT_CHARS = 120_000;
