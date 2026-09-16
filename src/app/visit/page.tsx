import { PhoneFrame } from "@/components/mobile/phone-frame";
import type { VisitPhoto } from "@/components/mobile/quick-action-grid";
import { VisitMode } from "@/components/mobile/visit-mode";
import { HUATONG_REPORT, PHOTO_SEED, REPORT_PHOTOS, photoSrc } from "@/lib/mock-data";
import { reportCompletion, sectionCompletion } from "@/lib/reports/completion";
import { SECTIONS } from "@/types/domain";

/**
 * `/visit` — mobile Visit Mode (README §17, screenshots 16 / 17 / 17b / 18).
 *
 * The composition root: it reads the open visit, derives what the screens
 * need, and hands the result to the client shell. On a desktop viewport
 * `PhoneFrame` also draws the approved explanatory column beside the phone.
 */

/**
 * The six thumbnails of the "Last photos" strip (prototype line 3304), and the
 * two seeded frames the camera and the quick observation carry.
 */
const LAST_PHOTO_IDS: readonly string[] = ["f02", "f05", "f10", "f13", "f16", "f19"];
const VIEWFINDER_ID = "f15";
const OBSERVATION_PHOTO_ID = "f11";

/**
 * Counts of what has been captured on this visit so far, and the depth of the
 * offline queue. Seeded values from the prototype (lines 2210..2212, 2196):
 * Phase 1 has no capture store and no sync queue behind them.
 */
const VISIT_COUNTERS = { photos: 38, notes: 7, observations: 4 };
const QUEUED_ITEMS = 6;

/** The clock in the header line — the prototype's own stamp (line 2191). */
const VISIT_START_CLOCK = "10:32";

/** Resolves a seeded source photo to its file and its caption. */
function seededPhoto(sourceId: string): VisitPhoto {
  const seed = PHOTO_SEED.find(([id]) => id === sourceId);
  if (!seed) {
    throw new Error(`visit/page.tsx: no seed entry for source photo "${sourceId}"`);
  }
  return { id: sourceId, src: photoSrc(sourceId), caption: seed[1] };
}

export default function VisitPage() {
  const report = HUATONG_REPORT;
  const done = sectionCompletion(report, REPORT_PHOTOS);

  // "Aug 12, 2026" → "Aug 12": the header line names the day, not the year.
  const visitDay = report.visitDate.replace(/,\s*\d{4}$/, "");

  return (
    <PhoneFrame
      title="Visit Mode"
      editorHref={`/reports/${report.id}/general`}
    >
      <VisitMode
        supplierName={report.supplierShortName}
        visitLine={`Factory Visit · ${visitDay} · ${VISIT_START_CLOCK}`}
        status={report.status}
        queuedItems={QUEUED_ITEMS}
        documentNumber={report.documentNumber}
        completion={reportCompletion(report, REPORT_PHOTOS)}
        sections={SECTIONS.map((section) => ({
          id: section.id,
          number: section.number,
          label: section.label,
          done: done[section.id],
        }))}
        counters={VISIT_COUNTERS}
        lastPhotos={LAST_PHOTO_IDS.map(seededPhoto)}
        viewfinder={seededPhoto(VIEWFINDER_ID)}
        observationPhoto={seededPhoto(OBSERVATION_PHOTO_ID)}
      />
    </PhoneFrame>
  );
}
