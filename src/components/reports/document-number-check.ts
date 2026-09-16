"use server";

/**
 * README §9 — the document number is checked against the database on blur.
 *
 * `documentNumberExists` lives in `reports.ts`, which is a server-only read
 * module: a client component cannot import it, and the wizard is a client
 * component because the whole wizard is. This is the one-line bridge between
 * them, and deliberately nothing more — it adds no query, no shaping and no
 * second way of reading a report (Phase 2 §24). The answer still comes from the
 * data layer, and the unique constraint still has the last word at insert time.
 */

import type { DataResult } from "@/lib/data/errors";
import { documentNumberExists } from "@/lib/data/reports";

export async function checkDocumentNumberTaken(
  documentNumber: string,
): Promise<DataResult<boolean>> {
  return documentNumberExists(documentNumber);
}
