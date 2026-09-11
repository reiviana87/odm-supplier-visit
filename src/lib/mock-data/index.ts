/**
 * Phase 1 mock data. Screens import everything from `@/lib/mock-data`, so the
 * Supabase-backed queries that replace these modules later can land behind the
 * same import path.
 */

// Modules owned by this task — named re-exports, so the public surface is
// explicit and module-private helpers stay private.
export { PHOTO_SEED, REPORT_PHOTOS, photoSrc, photosForRegion } from "./photos";
export type { PhotoSeed } from "./photos";

export {
  TRANSCRIPT_FINDINGS,
  TRANSCRIPT_META,
  transcriptFindingCounts,
} from "./findings";
export type { TranscriptFindingCounts, TranscriptMeta } from "./findings";

export { PLACEHOLDER_MAPPINGS, TEMPLATES, TEMPLATE_DETAILS } from "./templates";
export type { TemplateVersionDetail } from "./templates";

export { CURRENT_USER, TEAM } from "./profiles";

// Supplier, certificate and report fixtures.
export * from "./suppliers";
export * from "./certificates";
export * from "./reports";
