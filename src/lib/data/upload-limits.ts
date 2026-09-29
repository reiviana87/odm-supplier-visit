/**
 * Limits and accepted types shared by the upload actions and the pickers.
 *
 * They live outside the `"use server"` modules because such a module may only
 * export async functions — a constant there is a build error, not a style
 * preference. Keeping them here also means the client can enforce the same
 * limit before spending a round trip on a file the server would refuse.
 */

/**
 * The ceiling every upload in this app shares.
 *
 * Every file here travels as an argument to a Server Action, and Next caps a
 * Server Action request body at 1 MB unless `next.config.ts` says otherwise.
 * It enforces that cap by THROWING `ApiError(413)` rather than returning — an
 * exception, not a `DataResult` — so a file over the cap does not produce a
 * message, it tears the page down into the route error boundary. That is what
 * the 1.6 MB corporate template did.
 *
 * 4 MiB is as high as this can usefully go: Vercel refuses a function request
 * body of about 4.5 MB before Next ever sees it, with its own
 * `FUNCTION_PAYLOAD_TOO_LARGE`. Carrying files larger than this needs the
 * browser to upload straight to Supabase Storage through a signed URL, not a
 * bigger number here.
 */
export const SERVER_ACTION_BODY_LIMIT_BYTES = 4 * 1024 * 1024;

/**
 * README §29 — one photograph, not a photo library.
 *
 * Below {@link SERVER_ACTION_BODY_LIMIT_BYTES}, because the limit is measured
 * on the whole request: the multipart boundaries, the part headers and the
 * action's other arguments are counted alongside the image.
 */
export const MAX_UPLOAD_BYTES = 3.5 * 1024 * 1024;

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
