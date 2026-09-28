"use server";

/**
 * Word export — README §19, §24.
 *
 * Reads the report, pulls the photographs out of private storage, builds the
 * `.docx` and hands the browser bytes. The file is returned rather than stored:
 * an export is a snapshot of a moment, and keeping every one of them would grow
 * the bucket without anyone asking it to. The `report_exports` row records that
 * it happened.
 *
 * A base64 string crosses the server-action boundary because a Buffer does not.
 * That costs about a third in transfer size, which for a report-sized document
 * is worth far less than the complexity of a second signed-download round trip.
 */

import { canEdit } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import { fail, ok, type DataResult } from "@/lib/data/errors";
import { listReportPhotos } from "@/lib/data/photo-actions";
import { getReport } from "@/lib/data/reports";
import { buildReportDocx, exportFileName, type ExportImage } from "@/lib/export/docx";
import { isMockMode } from "@/lib/supabase/env";
import { getServerSupabase } from "@/lib/supabase/server";
import type { ReportPhoto } from "@/types/domain";

export interface ExportedDocx {
  fileName: string;
  /** base64 — the caller turns it back into a Blob and downloads it. */
  content: string;
  byteLength: number;
  /** Photographs that could not be read, named so the user knows what is absent. */
  skipped: string[];
}

/** One photo's bytes are not worth failing an export over, but silence is. */
async function loadImages(
  photos: readonly ReportPhoto[],
  paths: Map<string, string>,
): Promise<{ images: Map<string, ExportImage>; skipped: string[] }> {
  const images = new Map<string, ExportImage>();
  const skipped: string[] = [];

  const client = await getServerSupabase();
  if (!client) return { images, skipped: photos.map((p) => p.caption || p.id) };

  for (const photo of photos) {
    const path = paths.get(photo.id);
    if (!path) {
      skipped.push(photo.caption || photo.id);
      continue;
    }

    const file = await client.storage.from("report-images").download(path);
    if (file.error || !file.data) {
      skipped.push(photo.caption || photo.id);
      continue;
    }

    const bytes = Buffer.from(await file.data.arrayBuffer());
    const type = path.endsWith(".png") ? "png" : "jpg";

    images.set(photo.id, {
      data: bytes,
      type,
      // Written at upload; the exporter falls back to 4:3 when unknown.
      width: photo.width ?? 0,
      height: photo.height ?? 0,
    });
  }

  return { images, skipped };
}

export async function exportReportDocx(reportId: string): Promise<DataResult<ExportedDocx>> {
  const user = await requireUser();
  if (!user) return fail("unauthenticated");
  if (!canEdit(user.role)) {
    return fail("forbidden", "Your role can read this report but not export it.");
  }
  if (isMockMode()) {
    return fail(
      "forbidden",
      "Demo data cannot be exported — connect a Supabase project to generate a Word report.",
    );
  }

  const result = await getReport(reportId);
  if (!result.ok) return fail(result.error.code, result.error.message);
  const { report } = result.data;

  const photoResult = await listReportPhotos(reportId);
  const photos = photoResult.ok ? photoResult.data : [];

  // `listReportPhotos` hands back signed URLs, not paths, so the storage paths
  // are read again here — the exporter needs the object, not a link to it.
  const client = await getServerSupabase();
  const paths = new Map<string, string>();
  if (client) {
    const { data } = await client
      .from("report_images")
      .select("id, storage_path")
      .eq("report_id", reportId);
    for (const row of data ?? []) {
      if (row.storage_path) paths.set(row.id, row.storage_path);
    }
  }

  const { images, skipped } = await loadImages(photos, paths);

  let buffer: Buffer;
  try {
    buffer = await buildReportDocx({ report, photos, images });
  } catch (error) {
    console.error("[export] docx generation failed", error);
    return fail(
      "unknown",
      "The Word document could not be generated. Nothing was changed — try again, and if it keeps failing, remove the most recently added photograph and retry.",
    );
  }

  if (buffer.length < 1000) {
    // A file this small is not a report; returning it would look like success.
    return fail("unknown", "The generated document was empty. Nothing was downloaded.");
  }

  const fileName = exportFileName(report.documentNumber, report.supplierSnapshot.shortName);

  if (client) {
    // Bookkeeping only — a failure here must not lose the user their document.
    const { error } = await client.from("report_exports").insert({
      report_id: reportId,
      file_name: fileName,
      status: "ready",
      size_bytes: buffer.length,
      warnings: skipped.length ? { skippedPhotos: skipped } : {},
      completed_at: new Date().toISOString(),
      created_by: user.id,
    });
    if (error) console.error("[export] could not record the export", error);
  }

  return ok({
    fileName,
    content: buffer.toString("base64"),
    byteLength: buffer.length,
    skipped,
  });
}
