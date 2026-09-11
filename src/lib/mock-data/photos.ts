/**
 * Visit photographs for report GSO-2608001x00 (HEBEI HUATONG, 12 Aug 2026).
 *
 * Transcribed from `PHOTO_SEED` / `mkPhotos()` / `componentDidMount()` in the
 * approved prototype (`design-handoff/ODM Supplier Visit.dc.html`, lines
 * 2340–2381 and 2523–2529), and validated against screenshots
 * `06-main-products-images.png` and `10-appendix-pictures.png`.
 *
 * The prototype keeps one array per region, so the same source photograph can
 * appear in two regions under the same key. Here every photo lives in one flat
 * list, so entries reused across regions carry a namespaced `id` while `src`
 * still resolves to the single underlying file (README §10).
 */

import type {
  ImageRegion,
  PhotoCaptionState,
  ReportPhoto,
} from "@/types/domain";

// ─────────────────────────────────────────────────────────────────────────────
// Seed
// ─────────────────────────────────────────────────────────────────────────────

/** One row of the seed table: the source file id, its caption and its category. */
export type PhotoSeed = readonly [id: string, caption: string, category: string];

/** The 22 photographs taken during the visit, in capture order. */
export const PHOTO_SEED: readonly PhotoSeed[] = [
  ["f01", "Factory entrance and administration building", "Site"],
  ["f02", "Rubber cable production line — general workshop view", "Manufacturing"],
  ["f03", "Copper conductor bobbins staged at line entry", "Raw Materials"],
  ["f04", "Cable extrusion line with overhead cooling trough", "Manufacturing"],
  ["f05", "Insulated cores at the laying-up station", "Manufacturing"],
  ["f06", "Process quality control board at the workshop entrance", "Quality"],
  ["f07", "Product show room — certified cable range", "Products"],
  ["f08", "Show room — export market constructions display", "Products"],
  ["f09", "Raw material warehouse — armouring wire stock", "Raw Materials"],
  ["f10", "High / low temperature conditioning chamber", "Testing"],
  ["f11", "Cold bend test rig (large cross-section)", "Testing"],
  ["f12", "Heat aging oven used for insulation ageing tests", "Testing"],
  ["f13", "Vertical flame test chamber (UL single-cable method)", "Testing"],
  ["f14", "CNAS-accredited laboratory — electrical test benches", "Testing"],
  ["f15", "Vulcanising line — continuous curing section", "Manufacturing"],
  ["f16", "Tensile strength and elongation test machine", "Testing"],
  ["f17", "First sample cut — conductor and jacket inspection", "Quality"],
  ["f18", "Finished drum staged for pre-shipment inspection", "Logistics"],
  ["f19", "Production report and traceability record sheet", "Quality"],
  ["f20", "Routine inspection record at the machining station", "Quality"],
  ["f21", "Finished goods warehouse — export drums", "Logistics"],
  ["f22", "Jacket surface and print marking detail", "Products"],
];

/**
 * Resolves the source file id (`f01`…`f22`) to its public URL.
 *
 * The bundle ships SVG placeholders; dropping the real `f01.jpg`…`f22.jpg` into
 * `public/photos/` and changing the extension here is the whole swap path —
 * this function is the single place that decides where a photo comes from.
 */
export function photoSrc(sourceId: string): string {
  return `/photos/${sourceId}.svg`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Derived values
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The AI caption confidence cycle from `mkPhotos()`: index modulo 8. The values
 * below 85 are what render the "· review required" marker on the card
 * (README §10) — visible on card 04 of the Main Products grid.
 */
const CONFIDENCE_CYCLE: readonly number[] = [92, 88, 95, 71, 84, 90, 96, 79];

/**
 * Capture timestamps. The prototype carries none, so these are laid out evenly
 * across the recorded visit window (09:30–16:45 on 12 Aug 2026, China Standard
 * Time) in seed order, which is what the appendix "capture time" sort expects
 * (README §14). Written as a fixed string rather than derived from `Date` so
 * server and client render identically.
 */
const CAPTURE_FIRST_MINUTE = 9 * 60 + 42;
const CAPTURE_STEP_MINUTES = 18;

function capturedAtFor(seedIndex: number): string {
  const minute = CAPTURE_FIRST_MINUTE + seedIndex * CAPTURE_STEP_MINUTES;
  const hours = String(Math.floor(minute / 60)).padStart(2, "0");
  const minutes = String(minute % 60).padStart(2, "0");
  return `2026-08-12T${hours}:${minutes}:00+08:00`;
}

const SEED_INDEX = new Map<string, { seed: PhotoSeed; index: number }>(
  PHOTO_SEED.map((seed, index) => [seed[0], { seed, index }]),
);

interface PhotoSetSpec {
  /** Source file ids, in the order the prototype passes them to `mkPhotos()`. */
  readonly sourceIds: readonly string[];
  readonly region: ImageRegion;
  /** `accepted` mirrors `mkPhotos(ids, {})`; `suggested` mirrors `{ ai: 'suggested' }`. */
  readonly captionState: Extract<PhotoCaptionState, "accepted" | "suggested">;
  /** Namespace keeping ids unique when a photo is used in more than one region. */
  readonly idPrefix: string;
  /** `sortOrder` of the first entry; the set counts up from there. */
  readonly startOrder: number;
}

function buildPhotoSet(spec: PhotoSetSpec): ReportPhoto[] {
  return spec.sourceIds.map((sourceId, i) => {
    const entry = SEED_INDEX.get(sourceId);
    if (!entry) {
      throw new Error(`photos.ts: no seed entry for source photo "${sourceId}"`);
    }
    const [, caption, category] = entry.seed;
    const accepted = spec.captionState === "accepted";

    return {
      id: `${spec.idPrefix}${sourceId}`,
      src: photoSrc(sourceId),
      caption: accepted ? caption : "",
      aiCaption: caption,
      captionSource: "ai",
      confidence: CONFIDENCE_CYCLE[i % CONFIDENCE_CYCLE.length],
      captionState: spec.captionState,
      category,
      region: spec.region,
      sortOrder: spec.startOrder + i,
      capturedAt: capturedAtFor(entry.index),
      uploadState: "ready",
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Report GSO-2608001x00
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every photo attached to GSO-2608001x00: 22 in the appendix (18 with accepted
 * captions plus the 4 newly uploaded ones still holding AI suggestions), 4 in
 * §4.1 Main Products Images and 2 in §8.1 Partners Images — the counts the
 * template mapping screen reports for the three image regions (README §16).
 */
export const REPORT_PHOTOS: readonly ReportPhoto[] = [
  ...buildPhotoSet({
    sourceIds: [
      "f01", "f02", "f03", "f04", "f05", "f06", "f07", "f08", "f09",
      "f10", "f11", "f12", "f13", "f14", "f15", "f16", "f17", "f18",
    ],
    region: "APPENDIX_IMAGES",
    captionState: "accepted",
    idPrefix: "",
    startOrder: 1,
  }),
  // The 4 "without caption" cards of the Appendix screen: uploaded, analysed,
  // awaiting acceptance. The confidence cycle restarts with this upload batch.
  ...buildPhotoSet({
    sourceIds: ["f19", "f20", "f21", "f22"],
    region: "APPENDIX_IMAGES",
    captionState: "suggested",
    idPrefix: "",
    startOrder: 19,
  }),
  ...buildPhotoSet({
    sourceIds: ["f07", "f08", "f05", "f03"],
    region: "MAIN_PRODUCT_IMAGES",
    captionState: "accepted",
    idPrefix: "mp-",
    startOrder: 1,
  }),
  ...buildPhotoSet({
    sourceIds: ["f21", "f22"],
    region: "PARTNER_IMAGES",
    captionState: "suggested",
    idPrefix: "pn-",
    startOrder: 1,
  }),
];

/** The photos of one image region, in print order (README §10). */
export function photosForRegion(region: ImageRegion): ReportPhoto[] {
  return REPORT_PHOTOS.filter((photo) => photo.region === region).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}
