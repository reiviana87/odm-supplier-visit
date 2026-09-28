"use server";

/**
 * Transcript sources — README §11.
 *
 * A Plaud recording reaches the report as text, not as audio: the device
 * already produces a transcript, so the job here is to get that text in and
 * keep it, not to transcribe anything. Two ways in, both ending in the same
 * row: pasted text, or an uploaded `.txt`/`.md`.
 *
 * `.docx` and `.pdf` are deliberately absent. Parsing either reliably needs a
 * dependency and a pile of edge cases, and the value over "open it and paste"
 * is small for an MVP. The picker says so rather than accepting the file and
 * storing something unreadable.
 */

import { revalidatePath } from "next/cache";

import { canEdit } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import { fail, ok, toDataError, type DataResult } from "@/lib/data/errors";
import { MAX_TRANSCRIPT_CHARS } from "@/lib/data/upload-limits";
import { isMockMode } from "@/lib/supabase/env";
import { getServerSupabase } from "@/lib/supabase/server";

export interface TranscriptSource {
  id: string;
  fileName: string;
  content: string;
  wordCount: number;
  createdAt: string;
}

function wordsIn(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

async function writable() {
  const user = await requireUser();
  if (!user) return { ok: false as const, code: "unauthenticated" as const, message: undefined };
  if (!canEdit(user.role)) return { ok: false as const, code: "forbidden" as const, message: undefined };
  if (isMockMode()) {
    return {
      ok: false as const,
      code: "forbidden" as const,
      message: "Demo data is read-only — connect a Supabase project to save a transcript.",
    };
  }
  const client = await getServerSupabase();
  if (!client) return { ok: false as const, code: "offline" as const, message: undefined };
  return { ok: true as const, client, userId: user.id };
}

/**
 * Store a transcript against a report.
 *
 * The text is the payload whether it was pasted or read from a file, so both
 * routes land here. A file's original bytes are not kept: the report needs the
 * words, and keeping a second copy of them in a bucket buys nothing.
 */
export async function saveTranscript(input: {
  reportId: string;
  fileName: string;
  content: string;
}): Promise<DataResult<{ id: string; wordCount: number }>> {
  const session = await writable();
  if (!session.ok) return fail(session.code, session.message);

  const content = input.content.trim();
  if (content.length < 20) {
    return fail("invalid", "That transcript is empty. Paste the text or choose a .txt file.");
  }
  if (content.length > MAX_TRANSCRIPT_CHARS) {
    return fail(
      "invalid",
      `That transcript is ${Math.round(content.length / 1000)}k characters. The limit is ${
        MAX_TRANSCRIPT_CHARS / 1000
      }k — split it, or paste the part that covers the visit.`,
    );
  }

  const { data, error } = await session.client
    .from("report_files")
    .insert({
      report_id: input.reportId,
      kind: "transcript",
      file_name: input.fileName.trim() || "Pasted transcript",
      content,
      word_count: wordsIn(content),
      created_by: session.userId,
    })
    .select("id, word_count")
    .single();

  if (error) {
    const mapped = toDataError(error, "saveTranscript");
    return fail(mapped.code, mapped.message);
  }

  revalidatePath(`/reports/${input.reportId}`, "layout");
  return ok({ id: data.id, wordCount: data.word_count ?? 0 });
}

/** The transcripts attached to a report, newest first. */
export async function listTranscripts(
  reportId: string,
): Promise<DataResult<TranscriptSource[]>> {
  const user = await requireUser();
  if (!user) return fail("unauthenticated");
  if (isMockMode()) return ok([]);

  const client = await getServerSupabase();
  if (!client) return fail("offline");

  const { data, error } = await client
    .from("report_files")
    .select("id, file_name, content, word_count, created_at")
    .eq("report_id", reportId)
    .eq("kind", "transcript")
    .order("created_at", { ascending: false });

  if (error) {
    const mapped = toDataError(error, "listTranscripts");
    return fail(mapped.code, mapped.message);
  }

  return ok(
    (data ?? []).map((row) => ({
      id: row.id,
      fileName: row.file_name,
      content: row.content,
      wordCount: row.word_count ?? wordsIn(row.content),
      createdAt: row.created_at,
    })),
  );
}

export async function deleteTranscript(id: string): Promise<DataResult<{ id: string }>> {
  const session = await writable();
  if (!session.ok) return fail(session.code, session.message);

  const { data, error } = await session.client
    .from("report_files")
    .delete()
    .eq("id", id)
    .select("report_id")
    .single();

  if (error) {
    const mapped = toDataError(error, "deleteTranscript");
    return fail(mapped.code, mapped.message);
  }

  revalidatePath(`/reports/${data.report_id}`, "layout");
  return ok({ id });
}
