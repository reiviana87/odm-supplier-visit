/**
 * GSO document numbers — README §9, §1.3.
 *
 * The format is `GSO-YYMMNNNxNN`, e.g. `GSO-2608001x00`:
 *
 * ```
 *   GSO - 26 08 001 x 00
 *         │  │  │     └── revision, 00 for the original, bumped on duplicate (§1.3)
 *         │  │  └──────── sequence inside that month, 001…999
 *         │  └─────────── month, 01–12
 *         └────────────── two-digit year
 * ```
 *
 * Pure string work — the caller supplies the existing numbers and the date.
 */

import { z } from "zod";

/**
 * Case-insensitive so a number pasted as `gso-2608001X00` still parses;
 * `formatDocumentNumber` is the only place that decides the canonical casing.
 */
const DOCUMENT_NUMBER_PATTERN = /^GSO-(\d{2})(\d{2})(\d{3})x(\d{2})$/i;

/** The shape shown in field help and validation messages. */
export const DOCUMENT_NUMBER_EXAMPLE = "GSO-2608001x00";

export interface DocumentNumberParts {
  /** Two-digit year exactly as printed: `26` for 2026. Range 0–99. */
  year: number;
  /** Month, 1–12. */
  month: number;
  /** Sequence inside that year+month, 0–999. */
  sequence: number;
  /** Revision, 0–99. `0` is the original; a duplicate is `1` (README §1.3). */
  revision: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parse / format
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the parts, or `null` when `value` is not a GSO document number. */
export function parseDocumentNumber(value: string): DocumentNumberParts | null {
  const match = DOCUMENT_NUMBER_PATTERN.exec(value.trim());
  if (!match) {
    return null;
  }

  const [, year, month, sequence, revision] = match;
  const monthNumber = Number(month);
  if (monthNumber < 1 || monthNumber > 12) {
    return null;
  }

  return {
    year: Number(year),
    month: monthNumber,
    sequence: Number(sequence),
    revision: Number(revision),
  };
}

function digits(value: number, width: number, field: string): string {
  const max = 10 ** width - 1;
  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw new RangeError(
      `document-number: ${field} must be an integer between 0 and ${max}, received ${value}.`,
    );
  }
  return String(value).padStart(width, "0");
}

/** Renders the canonical form: uppercase prefix, lowercase revision separator. */
export function formatDocumentNumber(parts: DocumentNumberParts): string {
  if (!Number.isInteger(parts.month) || parts.month < 1 || parts.month > 12) {
    throw new RangeError(
      `document-number: month must be an integer between 1 and 12, received ${parts.month}.`,
    );
  }

  const year = digits(parts.year, 2, "year");
  const month = digits(parts.month, 2, "month");
  const sequence = digits(parts.sequence, 3, "sequence");
  const revision = digits(parts.revision, 2, "revision");

  return `GSO-${year}${month}${sequence}x${revision}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Allocation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The number the New Report modal prefills (README §9): the next free sequence
 * inside `date`'s year and month, at revision `x00`.
 *
 * `existing` is every document number already in use; entries from other months
 * and anything that does not parse are ignored, so the caller can pass the
 * whole reports list without filtering it first. `date` is read in local time —
 * the visit date is a local calendar date.
 *
 * Throws once a month reaches 999 reports, which the format cannot express.
 */
export function nextDocumentNumber(existing: readonly string[], date: Date): string {
  const year = date.getFullYear() % 100;
  const month = date.getMonth() + 1;

  let highest = 0;
  for (const value of existing) {
    const parts = parseDocumentNumber(value);
    if (parts && parts.year === year && parts.month === month && parts.sequence > highest) {
      highest = parts.sequence;
    }
  }

  return formatDocumentNumber({ year, month, sequence: highest + 1, revision: 0 });
}

/**
 * README §1.3 — duplicating a report keeps its number and bumps the revision:
 * `GSO-2608001x00` → `GSO-2608001x01`.
 *
 * Throws when `value` is not a GSO document number, or when the revision is
 * already `x99`; both are caller errors, since stored numbers are validated on
 * the way in by {@link documentNumberSchema}.
 */
export function duplicateDocumentNumber(value: string): string {
  const parts = parseDocumentNumber(value);
  if (!parts) {
    throw new Error(
      `document-number: "${value}" is not a document number (expected ${DOCUMENT_NUMBER_EXAMPLE}).`,
    );
  }
  if (parts.revision >= 99) {
    throw new RangeError(
      `document-number: "${value}" is already at the last revision (x99).`,
    );
  }

  return formatDocumentNumber({ ...parts, revision: parts.revision + 1 });
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation — README §9, the New Report form
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Field schema for the New Report modal. Uniqueness is a server concern and is
 * checked on blur against the existing reports, not here.
 */
export const documentNumberSchema = z
  .string()
  .trim()
  .min(1, "Document number is required.")
  .regex(
    DOCUMENT_NUMBER_PATTERN,
    `Use the format GSO-YYMMNNNxNN, for example ${DOCUMENT_NUMBER_EXAMPLE}.`,
  )
  .refine((value) => parseDocumentNumber(value) !== null, "The month must be 01 to 12.");
