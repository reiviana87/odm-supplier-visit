/**
 * Limits and accepted types shared by the upload actions and the pickers.
 *
 * They live outside the `"use server"` modules because such a module may only
 * export async functions — a constant there is a build error, not a style
 * preference. Keeping them here also means the client can enforce the same
 * limit before spending a round trip on a file the server would refuse.
 */

/** README §29 — one photograph, not a photo library. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/**
 * What the photo upload accepts. HEIC is deliberately absent: Word cannot
 * place it and the exporter cannot size it, so it is refused at the picker with
 * the setting that fixes it rather than stored as a photograph that would be
 * silently missing from the report.
 */
export const ACCEPTED_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AcceptedImageMime = (typeof ACCEPTED_IMAGE_MIME)[number];

/** Roughly 200 pages. Beyond this the assistant refuses the input anyway. */
export const MAX_TRANSCRIPT_CHARS = 400_000;

/** README §11 — .docx and .pdf are not parsed; the picker says so. */
export const ACCEPTED_TRANSCRIPT_TYPES = [".txt", ".md"] as const;
