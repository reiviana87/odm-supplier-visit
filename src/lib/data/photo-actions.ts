"use server";

/**
 * Photograph persistence — README §6..§9.
 *
 * The bytes go to the private `report-images` bucket; the row in
 * `report_images` holds the path and the metadata. Nothing stores a public URL,
 * because the bucket has none: display URLs are signed on demand and expire.
 *
 * The upload itself happens here rather than straight from the browser so the
 * object path is server-decided. A client that chose its own path could write
 * into another report's folder, and the storage policies in 0006 key on the
 * first path segment being the report id.
 */

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import type { SupabaseClient } from "@supabase/supabase-js";

import { requireUser } from "@/lib/auth/session";
import { canEdit, canManage } from "@/lib/auth/roles";
import {
  DEFAULT_MESSAGES,
  fail,
  ok,
  toDataError,
  type DataError,
  type DataResult,
} from "@/lib/data/errors";
import {
  ACCEPTED_IMAGE_MIME,
  MAX_UPLOAD_BYTES,
  type AcceptedImageMime,
} from "@/lib/data/upload-limits";
import { isMockMode } from "@/lib/supabase/env";
import { getServerSupabase } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { ImageRegion, ReportPhoto, UserRole } from "@/types/domain";

const BUCKET = "report-images";

const DEMO_READ_ONLY =
  "Demo data is read-only — connect a Supabase project to save changes.";

/**
 * The guard every write shares: signed in, allowed, not demo, connected.
 *
 * The client is annotated rather than inferred. Without the explicit
 * `SupabaseClient<Database>` the union widens and every `.from()` below types
 * as `never`, which is a confusing way to be told the generic was lost.
 */
type PhotoSession =
  | { ok: false; error: DataError }
  | { ok: true; client: SupabaseClient<Database>; userId: string; role: UserRole };

async function session(): Promise<PhotoSession> {
  const refuse = (code: DataError["code"], message?: string): PhotoSession => ({
    ok: false,
    error: { code, message: message ?? DEFAULT_MESSAGES[code] },
  });

  const user = await requireUser();
  if (!user) return refuse("unauthenticated");
  if (!canEdit(user.role)) return refuse("forbidden");
  if (isMockMode()) return refuse("forbidden", DEMO_READ_ONLY);

  const client = await getServerSupabase();
  if (!client) return refuse("offline");

  return { ok: true, client, userId: user.id, role: user.role };
}

function revalidateReport(reportId: string) {
  revalidatePath(`/reports/${reportId}`, "layout");
  revalidatePath("/visit");
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload
// ─────────────────────────────────────────────────────────────────────────────

export interface UploadPhotoInput {
  reportId: string;
  region: ImageRegion;
  fileName: string;
  mimeType: string;
  /** Natural pixel dimensions, measured in the browser (0 when unknown). */
  width: number;
  height: number;
  capturedAt?: string | null;
  /** The bytes. A Blob survives the server-action boundary; a Buffer does not. */
  file: Blob;
}

export async function uploadReportPhoto(
  input: UploadPhotoInput,
): Promise<DataResult<{ id: string; storagePath: string }>> {
  const s = await session();
  if (!s.ok) return { ok: false, error: s.error };

  if (!ACCEPTED_IMAGE_MIME.includes(input.mimeType as AcceptedImageMime)) {
    return fail(
      "invalid",
      `${input.mimeType || "That file"} cannot be placed in a Word report. Use JPEG, PNG or WebP.`,
    );
  }
  if (input.file.size > MAX_UPLOAD_BYTES) {
    return fail(
      "invalid",
      `That photograph is ${(input.file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${
        MAX_UPLOAD_BYTES / 1024 / 1024
      } MB.`,
    );
  }
  if (input.file.size === 0) {
    return fail("invalid", "That file is empty.");
  }

  const extension =
    input.mimeType === "image/png" ? "png" : input.mimeType === "image/webp" ? "webp" : "jpg";
  // The report id leads, because the storage policy reads it from the path.
  const storagePath = `${input.reportId}/${randomUUID()}.${extension}`;

  const upload = await s.client.storage.from(BUCKET).upload(storagePath, input.file, {
    contentType: input.mimeType,
    upsert: false,
  });
  if (upload.error) {
    const error = toDataError(upload.error, "uploadReportPhoto");
    return fail(error.code, error.message);
  }

  // Append: the new photograph goes last in its region.
  const { data: tail } = await s.client
    .from("report_images")
    .select("sort_order")
    .eq("report_id", input.reportId)
    .eq("region", input.region)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await s.client
    .from("report_images")
    .insert({
      report_id: input.reportId,
      region: input.region,
      file_name: input.fileName.slice(0, 200),
      storage_path: storagePath,
      mime_type: input.mimeType,
      size_bytes: input.file.size,
      width: input.width > 0 ? input.width : null,
      height: input.height > 0 ? input.height : null,
      sort_order: (tail?.sort_order ?? -1) + 1,
      captured_at: input.capturedAt ?? null,
      upload_state: "ready",
      created_by: s.userId,
    })
    .select("id")
    .single();

  if (error) {
    // The row is what makes the object reachable, so an orphaned object is
    // worse than a failed upload: remove it rather than leave it paid for and
    // invisible.
    await s.client.storage.from(BUCKET).remove([storagePath]);
    const mapped = toDataError(error, "uploadReportPhoto");
    return fail(mapped.code, mapped.message);
  }

  revalidateReport(input.reportId);
  return ok({ id: data.id, storagePath });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────────────────

export async function updatePhotoCaption(
  photoId: string,
  caption: string,
): Promise<DataResult<{ id: string }>> {
  const s = await session();
  if (!s.ok) return { ok: false, error: s.error };

  const { data, error } = await s.client
    .from("report_images")
    .update({
      caption: caption.trim(),
      // A caption the user typed or edited is theirs, whatever proposed it.
      caption_source: "user",
      caption_state: caption.trim() ? "accepted" : "none",
    })
    .eq("id", photoId)
    .select("id, report_id")
    .single();

  if (error) {
    const mapped = toDataError(error, "updatePhotoCaption");
    return fail(mapped.code, mapped.message);
  }

  revalidateReport(data.report_id);
  return ok({ id: data.id });
}

/** README §8 — a photograph can move between the three regions. */
export async function movePhotoToRegion(
  photoId: string,
  region: ImageRegion,
): Promise<DataResult<{ id: string }>> {
  const s = await session();
  if (!s.ok) return { ok: false, error: s.error };

  const { data: current, error: readError } = await s.client
    .from("report_images")
    .select("report_id")
    .eq("id", photoId)
    .single();
  if (readError) {
    const mapped = toDataError(readError, "movePhotoToRegion");
    return fail(mapped.code, mapped.message);
  }

  const { data: tail } = await s.client
    .from("report_images")
    .select("sort_order")
    .eq("report_id", current.report_id)
    .eq("region", region)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await s.client
    .from("report_images")
    .update({ region, sort_order: (tail?.sort_order ?? -1) + 1 })
    .eq("id", photoId);

  if (error) {
    const mapped = toDataError(error, "movePhotoToRegion");
    return fail(mapped.code, mapped.message);
  }

  revalidateReport(current.report_id);
  return ok({ id: photoId });
}

/**
 * Persist a drag-to-reorder — README §9.
 *
 * Takes the whole region's ids in their new order rather than a from/to pair,
 * so the result cannot drift from what the user sees. 0001 deliberately left
 * `sort_order` non-unique for exactly this: the rewrite passes through states
 * where two rows share a position.
 */
export async function reorderPhotos(
  reportId: string,
  region: ImageRegion,
  orderedIds: readonly string[],
): Promise<DataResult<{ count: number }>> {
  const s = await session();
  if (!s.ok) return { ok: false, error: s.error };

  const { data: owned, error: readError } = await s.client
    .from("report_images")
    .select("id")
    .eq("report_id", reportId)
    .eq("region", region);
  if (readError) {
    const mapped = toDataError(readError, "reorderPhotos");
    return fail(mapped.code, mapped.message);
  }

  // Only reorder what is actually in this region: an id from elsewhere would
  // otherwise be silently adopted into it.
  const allowed = new Set((owned ?? []).map((row) => row.id));
  const ids = orderedIds.filter((id) => allowed.has(id));
  if (ids.length !== allowed.size) {
    return fail("invalid", "The photo order is out of date. Reload the section and try again.");
  }

  for (const [index, id] of ids.entries()) {
    const { error } = await s.client
      .from("report_images")
      .update({ sort_order: index })
      .eq("id", id);
    if (error) {
      const mapped = toDataError(error, "reorderPhotos");
      return fail(mapped.code, mapped.message);
    }
  }

  revalidateReport(reportId);
  return ok({ count: ids.length });
}

export async function deletePhoto(photoId: string): Promise<DataResult<{ id: string }>> {
  const s = await session();
  if (!s.ok) return { ok: false, error: s.error };
  if (!canManage(s.role) && !canEdit(s.role)) return fail("forbidden");

  const { data: row, error: readError } = await s.client
    .from("report_images")
    .select("report_id, storage_path")
    .eq("id", photoId)
    .single();
  if (readError) {
    const mapped = toDataError(readError, "deletePhoto");
    return fail(mapped.code, mapped.message);
  }

  const { error } = await s.client.from("report_images").delete().eq("id", photoId);
  if (error) {
    const mapped = toDataError(error, "deletePhoto");
    return fail(mapped.code, mapped.message);
  }

  // Row first, object second: an object with no row is invisible but harmless,
  // whereas a row pointing at nothing renders a broken photograph.
  //
  // And only when nothing else points at it. A revision shares its parent's
  // photographs rather than duplicating forty objects through a serverless
  // function (`reviseReport`), so the same path can carry more than one row —
  // deleting the copy from the revision must not blank the original.
  if (row.storage_path) {
    const { count } = await s.client
      .from("report_images")
      .select("id", { count: "exact", head: true })
      .eq("storage_path", row.storage_path);

    if ((count ?? 0) === 0) {
      await s.client.storage.from(BUCKET).remove([row.storage_path]);
    }
  }

  revalidateReport(row.report_id);
  return ok({ id: photoId });
}

// ─────────────────────────────────────────────────────────────────────────────
// Signed display URLs
// ─────────────────────────────────────────────────────────────────────────────

/** How long a display URL stays valid. Long enough to read a report, no longer. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Sign the storage paths a screen is about to render.
 *
 * Signed in one batch rather than per card: a report with forty photographs
 * would otherwise make forty round trips before it could paint.
 */
export async function signPhotoUrls(
  paths: readonly string[],
): Promise<DataResult<Record<string, string>>> {
  if (paths.length === 0) return ok({});

  const user = await requireUser();
  if (!user) return fail("unauthenticated");

  const client = await getServerSupabase();
  if (!client) return fail("offline");

  const { data, error } = await client.storage
    .from(BUCKET)
    .createSignedUrls([...paths], SIGNED_URL_TTL_SECONDS);

  if (error) {
    const mapped = toDataError(error, "signPhotoUrls");
    return fail(mapped.code, mapped.message);
  }

  const urls: Record<string, string> = {};
  for (const entry of data ?? []) {
    if (entry.signedUrl && entry.path) urls[entry.path] = entry.signedUrl;
  }
  return ok(urls);
}

/** The photo rows for one report, already signed and in print order. */
export async function listReportPhotos(
  reportId: string,
): Promise<DataResult<ReportPhoto[]>> {
  const user = await requireUser();
  if (!user) return fail("unauthenticated");

  const client = await getServerSupabase();
  if (!client) return fail("offline");

  const { data, error } = await client
    .from("report_images")
    .select("*")
    .eq("report_id", reportId)
    .order("region")
    .order("sort_order");

  if (error) {
    const mapped = toDataError(error, "listReportPhotos");
    return fail(mapped.code, mapped.message);
  }

  const rows = data ?? [];
  const paths = rows.map((row) => row.storage_path).filter((p): p is string => Boolean(p));
  const signed = await signPhotoUrls(paths);
  const urls = signed.ok ? signed.data : {};

  return ok(
    rows.map((row) => ({
      id: row.id,
      src: (row.storage_path && urls[row.storage_path]) || "",
      caption: row.caption,
      aiCaption: row.ai_caption,
      captionSource: row.caption_source,
      confidence: row.confidence === null ? 0 : Number(row.confidence),
      captionState: row.caption_state as ReportPhoto["captionState"],
      uploadState: row.upload_state as ReportPhoto["uploadState"],
      category: row.category,
      region: row.region,
      sortOrder: row.sort_order,
      capturedAt: row.captured_at,
      width: row.width,
      height: row.height,
    })),
  );
}
