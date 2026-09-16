/**
 * Report completion — README §6.2, Phase 2 §20.
 *
 * ## The algorithm
 *
 * Thirteen predicates, one per navigator row, each worth exactly the same as
 * every other — there is no weighting, because a report with nine written
 * sections is nine thirteenths done however long the paragraphs are:
 *
 * | Section          | Passes when                                            |
 * |------------------|--------------------------------------------------------|
 * | General          | always — the header is written when the report is created |
 * | 1. Purpose       | more than 40 characters of prose                        |
 * | 2. Company       | always — copied from the supplier snapshot (README §8.3) |
 * | 3. Overview      | more than 40 characters of prose                        |
 * | 4. Main Products | more than 40 characters of prose (the table is optional) |
 * | 4.1 Product img. | at least one image in the region, every one captioned   |
 * | 5. Target        | at least one target product                             |
 * | 6. Visit         | at least 8 observations (the Q&A block is optional)     |
 * | 7. Certificates  | always — taken from the supplier record                 |
 * | 8. Partners      | more than 40 characters of prose                        |
 * | 8.1 Partner img. | at least one image in the region, every one captioned   |
 * | 9. Conclusion    | more than 40 characters of prose                        |
 * | 10. Appendix     | at least one image in the region, every one captioned   |
 *
 * The percentage is `passing ÷ 13`, rounded. It is **derived, never stored**:
 * the dashboard, the reports table, the editor header and the export modal all
 * call this one computation, so none of them can drift from another or go stale
 * against the row they describe.
 *
 * The predicates are transcribed from README §6.2 and from `doneMap()` in the
 * approved prototype (`design-handoff/ODM Supplier Visit.dc.html`, lines
 * 2811–2830). Phase 2 §20 tightens one thing about them: prose is measured
 * after the whitespace and the empty rich-text wrapper are taken off, so the
 * number never claims a section is written when nothing was typed into it.
 *
 * Pure: no I/O, no clock, no store access.
 */

import {
  SECTIONS,
  type ImageRegion,
  type Report,
  type ReportPhoto,
  type SectionId,
} from "@/types/domain";

// ─────────────────────────────────────────────────────────────────────────────
// Thresholds
// ─────────────────────────────────────────────────────────────────────────────

/** README §6.2 — a prose section counts as written past 40 characters. */
const MIN_PROSE_LENGTH = 40;

/** README §6.2 — §6 needs eight observations on the record. */
const MIN_OBSERVATIONS = 8;

// ─────────────────────────────────────────────────────────────────────────────
// Predicate helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What is left of a section body once the things that are not writing are
 * removed — Phase 2 §20: "avoid pretending that whitespace or an empty
 * rich-text wrapper counts as complete".
 *
 * Plain text only loses its surrounding whitespace. The markup pass is here
 * because README §15 has these bodies becoming rich text: an editor stores an
 * untouched field as `<p></p>`, `<p><br></p>` or `<p>&nbsp;</p>`, all of which
 * would otherwise sail past a 40-character threshold on tags alone.
 */
function meaningfulProse(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return "";
  }

  return trimmed
    .replace(/<br\s*\/?>/gi, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    // Only the outer wrapper, and only when the body is wrapped: the tags of a
    // paragraph are not prose, but its text is.
    .replace(/^<p\b[^>]*>([\s\S]*)<\/p>$/i, "$1")
    .trim();
}

function hasProse(text: string): boolean {
  return meaningfulProse(text).length > MIN_PROSE_LENGTH;
}

/**
 * README §6.2 — an image section passes with at least one image in its region
 * and a caption on every one of them. An AI caption still awaiting acceptance
 * lives in `aiCaption` and leaves `caption` empty, so it does not count
 * (README §11 — an AI proposal is not content until accepted).
 *
 * The caption is trimmed for the same reason the prose is (Phase 2 §20), and to
 * agree with the editor's own "no caption" warning, which already trims.
 */
function everyImageCaptioned(
  photos: readonly ReportPhoto[],
  region: ImageRegion,
): boolean {
  const inRegion = photos.filter((photo) => photo.region === region);
  return inRegion.length > 0 && inRegion.every((photo) => photo.caption.trim().length > 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One boolean per section, in README §6.2 order. Feeds the navigator ticks, the
 * progress bar and the export modal's "Sections included" warnings.
 */
export function sectionCompletion(
  report: Report,
  photos: readonly ReportPhoto[],
): Record<SectionId, boolean> {
  const sections = report.sections;

  return {
    // Created with the report.
    general: true,
    purpose: hasProse(sections.purpose),
    // Copied from the supplier snapshot (README §8.3).
    company: true,
    overview: hasProse(sections.overview),
    // The §4 construction table is optional — prose alone completes the section.
    products: hasProse(sections.mainProducts),
    "product-images": everyImageCaptioned(photos, "MAIN_PRODUCT_IMAGES"),
    target: sections.targetProducts.length > 0,
    // The §6 Q&A block is optional — only the observation list is counted.
    visit: sections.observations.length >= MIN_OBSERVATIONS,
    // Taken from the supplier record.
    certificates: true,
    partners: hasProse(sections.partners),
    "partner-images": everyImageCaptioned(photos, "PARTNER_IMAGES"),
    conclusion: hasProse(sections.conclusion),
    appendix: everyImageCaptioned(photos, "APPENDIX_IMAGES"),
  };
}

/** README §6.2 — passing predicates ÷ 13, rounded to a whole percent (0–100). */
export function reportCompletion(
  report: Report,
  photos: readonly ReportPhoto[],
): number {
  const done = sectionCompletion(report, photos);
  const passing = SECTIONS.filter((section) => done[section.id]).length;
  return Math.round((passing / SECTIONS.length) * 100);
}

/**
 * What each section still needs, in one sentence. Read by the export modal's
 * "Sections included" checklist (README §15) to explain a warning marker rather
 * than only showing it.
 */
export const SECTION_PREDICATE_DESCRIPTION: Record<SectionId, string> = {
  general: "Complete — the header metadata is written when the report is created.",
  purpose: "Needs more than 40 characters of text.",
  company: "Complete — the fields come from the supplier record captured at the visit.",
  overview: "Needs more than 40 characters of text.",
  products: "Needs more than 40 characters of text; the construction table is optional.",
  "product-images": "Needs at least one image, and a caption on every image.",
  target: "Needs at least one target product.",
  visit: "Needs at least 8 observations; the Q&A block is optional.",
  certificates: "Complete — the certificate table comes from the supplier record.",
  partners: "Needs more than 40 characters of text.",
  "partner-images": "Needs at least one image, and a caption on every image.",
  conclusion: "Needs more than 40 characters of text.",
  appendix: "Needs at least one image, and a caption on every image.",
};
