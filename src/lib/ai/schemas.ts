import { z } from "zod";

/**
 * Structured output contracts — README §15, §18.
 *
 * A model's JSON is input, not truth. Everything it returns is parsed here
 * before it reaches a screen or the database, so a malformed or creative
 * response becomes a clean "the assistant returned something unreadable"
 * instead of a half-rendered finding or a crash.
 *
 * Pure: no I/O, no `server-only`, so the tests and the client-side forms can
 * both reuse the same shapes.
 */

/**
 * The finding categories §15 asks the transcript analysis to fill.
 *
 * `CATEGORY` is also what the §6 observation cards are grouped by, so the model
 * is constrained to the vocabulary the report already uses rather than
 * inventing its own headings.
 */
export const FINDING_CATEGORIES = [
  "Company Overview",
  "Main Products",
  "Manufacturing",
  "Machining",
  "Assembly",
  "Production Capacity",
  "Quality Control",
  "Testing Facilities",
  "Engineering",
  "Supply Chain",
  "Certificates",
  "Commercial",
  "Risks",
  "Opportunities",
  "Open Points",
  "Actions",
] as const;

export type FindingCategory = (typeof FINDING_CATEGORIES)[number];

export const findingSchema = z.object({
  category: z.enum(FINDING_CATEGORIES),
  /** One sentence, report-ready. */
  text: z.string().min(3).max(600),
  /**
   * How directly the transcript supports it. `stated` was said outright;
   * `implied` is the model reading between lines and must be reviewable as
   * such (§18); anything else should not have been returned at all.
   */
  confidence: z.enum(["stated", "implied"]),
  /** The words this came from, so the user can check it without re-reading. */
  evidence: z.string().max(400).optional().default(""),
});

export type Finding = z.infer<typeof findingSchema>;

export const transcriptAnalysisSchema = z.object({
  findings: z.array(findingSchema).max(60),
  /** What the transcript did NOT cover — §18 wants gaps named, not filled. */
  missingInformation: z.array(z.string().max(200)).max(20).default([]),
});

export type TranscriptAnalysis = z.infer<typeof transcriptAnalysisSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Photo captions — §16
// ─────────────────────────────────────────────────────────────────────────────

export const photoCaptionSchema = z.object({
  /** What the engineer sees, in one or two sentences. */
  analysis: z.string().min(3).max(800),
  /** The line that goes under the photograph in the report. */
  caption: z.string().min(3).max(200),
  /**
   * 0–100. The approved photo card shows "· review required" below 85, so this
   * has to come back from the model rather than be assumed.
   */
  confidence: z.number().int().min(0).max(100),
});

export type PhotoCaption = z.infer<typeof photoCaptionSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Text improvement — §14
// ─────────────────────────────────────────────────────────────────────────────

export const IMPROVE_ACTIONS = [
  "professional",
  "executive",
  "technical",
  "concise",
  "expand",
  "grammar",
] as const;

export type ImproveAction = (typeof IMPROVE_ACTIONS)[number];

export const IMPROVE_LABELS: Record<ImproveAction, string> = {
  professional: "Professional",
  executive: "Executive",
  technical: "Technical",
  concise: "Concise",
  expand: "Expand",
  grammar: "Fix Grammar",
};

export const improvedTextSchema = z.object({
  text: z.string().min(1).max(20_000),
  /** What changed, so the user can judge the suggestion without diffing it. */
  summary: z.string().max(300).default(""),
});

export type ImprovedText = z.infer<typeof improvedTextSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Conclusion — §17
// ─────────────────────────────────────────────────────────────────────────────

export const conclusionSchema = z.object({
  /** The prose that would go into §9, already in report voice. */
  text: z.string().min(20).max(12_000),
  /**
   * Headings the model actually had evidence for. §17 lists nine possible
   * areas; naming the ones it covered lets the UI show what was left out
   * instead of implying the conclusion is complete.
   */
  covered: z.array(z.string().max(60)).max(12).default([]),
  /** Areas it deliberately did not write about for lack of evidence. */
  omitted: z.array(z.string().max(60)).max(12).default([]),
});

export type GeneratedConclusion = z.infer<typeof conclusionSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pull the JSON object out of a model reply and validate it.
 *
 * Models wrap JSON in prose or a fenced block often enough that refusing those
 * replies would fail for a cosmetic reason, so the first balanced `{...}` is
 * extracted before parsing. What the schema then rejects is rejected for real.
 */
export function parseAiJson<T>(
  raw: string,
  schema: z.ZodType<T>,
): { ok: true; data: T } | { ok: false; reason: string } {
  const candidate = extractJsonObject(raw);
  if (!candidate) return { ok: false, reason: "no JSON object in the reply" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return { ok: false, reason: "the reply was not valid JSON" };
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    return {
      ok: false,
      reason: first ? `${first.path.join(".") || "root"}: ${first.message}` : "shape mismatch",
    };
  }

  return { ok: true, data: result.data };
}

/** The first balanced JSON object in a string, brace-counting outside strings. */
export function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < raw.length; i += 1) {
    const char = raw[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }

  return null;
}
