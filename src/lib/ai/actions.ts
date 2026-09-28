"use server";

/**
 * Assistant entry points — README §14..§17.
 *
 * Everything the UI can ask Claude for goes through here. Each one does the
 * same four things: check the user may edit, check the assistant is configured,
 * call the model, and validate the reply before returning it. Nothing writes to
 * a report — an AI suggestion is a proposal until a human accepts it (§14, §17),
 * so accepting is an ordinary section save through the existing data layer.
 *
 * The one thing that IS written here is the audit row in `report_ai_generations`,
 * because "what did the assistant produce, from what, and when" is a question
 * the report has to be able to answer later.
 */

import { canEdit } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import {
  MAX_INPUT_CHARS,
  aiFail,
  aiOk,
  getAnthropic,
  getAnthropicModel,
  type AiTask,
  isAiConfigured,
  toAiError,
  type AiResult,
} from "@/lib/ai/client";
import {
  conclusionPrompt,
  improveTextPrompt,
  photoCaptionPrompt,
  transcriptAnalysisPrompt,
} from "@/lib/ai/prompts";
import {
  conclusionSchema,
  improvedTextSchema,
  parseAiJson,
  photoCaptionSchema,
  transcriptAnalysisSchema,
  type GeneratedConclusion,
  type ImproveAction,
  type ImprovedText,
  type PhotoCaption,
  type TranscriptAnalysis,
} from "@/lib/ai/schemas";
import { getReport } from "@/lib/data/reports";
import { getServerSupabase } from "@/lib/supabase/server";
import type { SupplierSnapshot } from "@/types/domain";

/** Generous enough for a full conclusion, bounded so one call cannot run away. */
const MAX_TOKENS = 4096;

async function guard(): Promise<AiResult<{ userId: string }>> {
  const user = await requireUser();
  if (!user) return aiFail("unknown", "Sign in to use the assistant.");
  if (!canEdit(user.role)) {
    return aiFail("unknown", "Your role can read this report but not change it.");
  }
  if (!isAiConfigured()) return aiFail("not_configured");
  return aiOk({ userId: user.id });
}

/**
 * Record what the assistant produced. Never fatal: a report that generated a
 * good conclusion should not fail because the audit row could not be written.
 */
async function recordGeneration(input: {
  reportId: string | null;
  type: AiTask;
  sectionId: string | null;
  output: string;
  userId: string;
}): Promise<void> {
  if (!input.reportId) return;
  try {
    const client = await getServerSupabase();
    if (!client) return;
    await client.from("report_ai_generations").insert({
      report_id: input.reportId,
      kind: input.type,
      section_id: input.sectionId,
      output: input.output.slice(0, 50_000),
      model: getAnthropicModel(input.type),
      // 'proposed' is the truthful state: nothing here has been accepted, and
      // accepting happens through an ordinary section save.
      status: "proposed",
      created_by: input.userId,
    });
  } catch (error) {
    console.error("[ai] could not record generation", error);
  }
}

/** One text completion, returning the raw reply. */
async function complete(prompt: string, task: AiTask): Promise<AiResult<string>> {
  const client = getAnthropic();
  if (!client) return aiFail("not_configured");
  if (prompt.length > MAX_INPUT_CHARS) return aiFail("too_large");

  try {
    const message = await client.messages.create({
      model: getAnthropicModel(task),
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content
      .filter((block): block is { type: "text"; text: string; citations: never } =>
        block.type === "text",
      )
      .map((block) => block.text)
      .join("\n")
      .trim();

    return text ? aiOk(text) : aiFail("invalid_response");
  } catch (error) {
    const mapped = toAiError(error);
    return aiFail(mapped.code, mapped.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// §14 — Improve text
// ─────────────────────────────────────────────────────────────────────────────

export async function improveText(input: {
  reportId: string | null;
  sectionId: string;
  sectionLabel: string;
  text: string;
  action: ImproveAction;
}): Promise<AiResult<ImprovedText>> {
  const allowed = await guard();
  if (!allowed.ok) return allowed;

  const text = input.text.trim();
  if (text.length < 10) {
    return aiFail("invalid_response", "There is not enough text to improve yet.");
  }

  const reply = await complete(
    improveTextPrompt(text, input.action, input.sectionLabel),
    "improve_text",
  );
  if (!reply.ok) return reply;

  const parsed = parseAiJson(reply.data, improvedTextSchema);
  if (!parsed.ok) return aiFail("invalid_response");

  await recordGeneration({
    reportId: input.reportId,
    type: "improve_text",
    sectionId: input.sectionId,
    output: parsed.data.text,
    userId: allowed.data.userId,
  });

  return aiOk(parsed.data);
}

// ─────────────────────────────────────────────────────────────────────────────
// §15 — Transcript analysis
// ─────────────────────────────────────────────────────────────────────────────

export async function analyzeTranscript(input: {
  reportId: string;
  transcript: string;
}): Promise<AiResult<TranscriptAnalysis>> {
  const allowed = await guard();
  if (!allowed.ok) return allowed;

  const transcript = input.transcript.trim();
  if (transcript.length < 50) {
    return aiFail("invalid_response", "The transcript is too short to analyse.");
  }

  const report = await getReport(input.reportId);
  if (!report.ok) {
    return aiFail("unknown", "This report could not be read, so the transcript was not analysed.");
  }

  const reply = await complete(
    transcriptAnalysisPrompt(transcript, report.data.report.supplierSnapshot),
    "transcript_analysis",
  );
  if (!reply.ok) return reply;

  const parsed = parseAiJson(reply.data, transcriptAnalysisSchema);
  if (!parsed.ok) return aiFail("invalid_response");

  await recordGeneration({
    reportId: input.reportId,
    type: "transcript_analysis",
    sectionId: null,
    output: JSON.stringify(parsed.data),
    userId: allowed.data.userId,
  });

  return aiOk(parsed.data);
}

// ─────────────────────────────────────────────────────────────────────────────
// §16 — Photo captions
// ─────────────────────────────────────────────────────────────────────────────

/** What Claude's vision API accepts. */
const VISION_MEDIA = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type VisionMedia = (typeof VISION_MEDIA)[number];

export async function generatePhotoCaption(input: {
  reportId: string;
  photoId: string;
  /** Author's note about the photograph, if any. */
  hint?: string;
}): Promise<AiResult<PhotoCaption>> {
  const allowed = await guard();
  if (!allowed.ok) return allowed;

  const client = getAnthropic();
  if (!client) return aiFail("not_configured");

  const supabase = await getServerSupabase();
  if (!supabase) return aiFail("unknown", "The photograph store could not be reached.");

  const { data: row, error } = await supabase
    .from("report_images")
    .select("storage_path, mime_type, caption")
    .eq("id", input.photoId)
    .single();
  if (error || !row?.storage_path) {
    return aiFail("unknown", "That photograph could not be found.");
  }

  // Downloaded server-side: the model needs the bytes, and handing the browser
  // a secret or the model a signed URL would both be worse.
  const file = await supabase.storage.from("report-images").download(row.storage_path);
  if (file.error || !file.data) {
    return aiFail("unknown", "That photograph could not be read from storage.");
  }

  const mediaType = (
    VISION_MEDIA.includes(row.mime_type as VisionMedia) ? row.mime_type : "image/jpeg"
  ) as VisionMedia;
  const base64 = Buffer.from(await file.data.arrayBuffer()).toString("base64");

  const report = await getReport(input.reportId);
  const snapshot: SupplierSnapshot | null = report.ok ? report.data.report.supplierSnapshot : null;
  if (!snapshot) return aiFail("unknown", "This report could not be read.");

  try {
    const message = await client.messages.create({
      model: getAnthropicModel("photo_caption"),
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: photoCaptionPrompt(snapshot, input.hint ?? row.caption ?? "") },
          ],
        },
      ],
    });

    const text = message.content
      .filter((block): block is { type: "text"; text: string; citations: never } =>
        block.type === "text",
      )
      .map((block) => block.text)
      .join("\n");

    const parsed = parseAiJson(text, photoCaptionSchema);
    if (!parsed.ok) return aiFail("invalid_response");

    // Held in ai_caption, not caption: §16 says the user accepts, edits,
    // regenerates or discards, so nothing overwrites what they wrote.
    await supabase
      .from("report_images")
      .update({
        ai_caption: parsed.data.caption,
        confidence: parsed.data.confidence,
        caption_source: "ai",
        caption_state: "suggested",
      })
      .eq("id", input.photoId);

    await recordGeneration({
      reportId: input.reportId,
      type: "photo_caption",
      sectionId: null,
      output: JSON.stringify(parsed.data),
      userId: allowed.data.userId,
    });

    return aiOk(parsed.data);
  } catch (error) {
    const mapped = toAiError(error);
    return aiFail(mapped.code, mapped.message);
  }
}

/** Accepting a proposal is an ordinary write, kept next to the generator. */
export async function acceptPhotoCaption(
  photoId: string,
  caption: string,
): Promise<AiResult<{ id: string }>> {
  const allowed = await guard();
  if (!allowed.ok) return allowed;

  const supabase = await getServerSupabase();
  if (!supabase) return aiFail("unknown", "The photograph could not be updated.");

  const { error } = await supabase
    .from("report_images")
    .update({ caption: caption.trim(), caption_state: "accepted" })
    .eq("id", photoId);

  return error ? aiFail("unknown") : aiOk({ id: photoId });
}

// ─────────────────────────────────────────────────────────────────────────────
// §17 — Conclusion
// ─────────────────────────────────────────────────────────────────────────────

export async function generateConclusion(input: {
  reportId: string;
  /** Findings already accepted from a transcript, as plain sentences. */
  findings?: readonly string[];
}): Promise<AiResult<GeneratedConclusion>> {
  const allowed = await guard();
  if (!allowed.ok) return allowed;

  const report = await getReport(input.reportId);
  if (!report.ok) {
    return aiFail("unknown", "This report could not be read, so no conclusion was proposed.");
  }

  const reply = await complete(
    conclusionPrompt(report.data.report, input.findings ?? []),
    "conclusion",
  );
  if (!reply.ok) return reply;

  const parsed = parseAiJson(reply.data, conclusionSchema);
  if (!parsed.ok) return aiFail("invalid_response");

  await recordGeneration({
    reportId: input.reportId,
    type: "conclusion",
    sectionId: "conclusion",
    output: parsed.data.text,
    userId: allowed.data.userId,
  });

  return aiOk(parsed.data);
}

/** Whether the AI affordances should render at all (§12). */
export async function aiStatus(): Promise<{ configured: boolean }> {
  return { configured: isAiConfigured() };
}
