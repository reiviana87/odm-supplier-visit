/**
 * Limits and accepted types for the corporate Word template.
 *
 * They live outside `template-actions.ts` because a `"use server"` module may
 * only export async functions — a constant there is a build error, not a style
 * preference (same reason as `upload-limits.ts`). Keeping them here also lets
 * the upload dialog refuse an obviously wrong file before spending a round trip
 * on one the server would reject anyway.
 */

/** The private bucket 0007 creates. Never public: the template carries the
 *  company letterhead and a signature image. */
export const TEMPLATE_BUCKET = "report-templates";

/**
 * The real EBARA template is 1.6 MB, almost all of it the header logos and the
 * photographs of the filled example it ships as.
 *
 * The number is not a judgement about templates, it is what the transport can
 * carry: the file is uploaded as a Server Action argument, and the request it
 * travels in is capped — see
 * `SERVER_ACTION_BODY_LIMIT_BYTES` in `upload-limits.ts`. This sits
 * below that cap so an oversized file is refused at the picker with a sentence,
 * instead of being refused by Next with a thrown 413 that takes the page down.
 */
export const MAX_TEMPLATE_BYTES = 3.5 * 1024 * 1024;

/**
 * The only accepted type. `.doc`, `.dotx` and `.odt` are all refused: the
 * exporter clones the OOXML package itself, so anything that is not a
 * WordprocessingML document has no `word/document.xml` to clone.
 */
export const TEMPLATE_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
