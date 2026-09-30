/**
 * Limits and accepted types for a certificate copy.
 *
 * Outside `supplier-actions.ts` because a `"use server"` module may only export
 * async functions (same reason as `upload-limits.ts`), and so the picker can
 * refuse a file before spending a round trip on one the server would reject.
 */

/** The private bucket the data sheets already use — never public. */
export const SUPPLIER_BUCKET = "supplier-files";

/**
 * A scan of one certificate page.
 *
 * Below `SERVER_ACTION_BODY_LIMIT_BYTES`, because the file travels as a
 * Server Action argument and the cap is measured on the whole request. A page
 * scanned at 300 dpi is well under this; a 40-page PDF of everything the
 * supplier has ever been issued is not one certificate and belongs in Files.
 */
export const MAX_CERTIFICATE_BYTES = 3.5 * 1024 * 1024;

/**
 * What the picker accepts. PDF is here and not in the photo limits because a
 * certificate usually arrives as a scan rather than a photograph — and because
 * nothing places it in the Word body, so it costs the exporter nothing.
 */
export const ACCEPTED_CERTIFICATE_MIME: readonly string[] = [
  "image/jpeg",
  "image/png",
  "application/pdf",
];

/** An hour, like the photo URLs: long enough to read, short enough to expire. */
export const CERTIFICATE_URL_TTL_SECONDS = 60 * 60;
