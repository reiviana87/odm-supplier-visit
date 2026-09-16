import { PhoneFrame } from "@/components/mobile/phone-frame";
import type { VisitPhoto } from "@/components/mobile/quick-action-grid";
import { VisitMode } from "@/components/mobile/visit-mode";
import { ButtonLink } from "@/components/ui/button";
import { getReport, listReports } from "@/lib/data/reports";
import { PHOTO_SEED, REPORT_PHOTOS, photoSrc } from "@/lib/mock-data";
import { reportCompletion, sectionCompletion } from "@/lib/reports/completion";
import { SECTIONS, type Report } from "@/types/domain";

/**
 * `/visit` — mobile Visit Mode (README §17, screenshots 16 / 17 / 17b / 18).
 *
 * The composition root: it reads the open visit through the data layer, derives
 * what the screens need, and hands the result to the client shell. On a desktop
 * viewport `PhoneFrame` also draws the approved explanatory column beside the
 * phone.
 *
 * Phase 2 wires the reads. `listReports()` / `getReport()` are the only way in —
 * this file does not know a table name and does not branch on demo mode, which
 * lives inside the data layer. Nothing here throws: both calls answer with a
 * `DataResult` and a failure renders the sentence instead of a crash.
 *
 * Photographs are the one thing still read from the Phase 1 seed. There is no
 * photo module in the data layer yet — §10 is a later phase — so `REPORT_PHOTOS`
 * still feeds the completion predicates and the "Last photos" strip. Every other
 * value on this screen now comes from the report itself.
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
 * offline queue. Photo, note and sync capture have no store in Phase 2 either,
 * so these stay the prototype's seeded values (lines 2210..2212, 2196). The
 * third counter is no longer here: observations are real now and are counted
 * from the report's own §6 list.
 */
const VISIT_COUNTERS = { photos: 38, notes: 7 };
const QUEUED_ITEMS = 6;

/**
 * The clock in the header line, when the report has no start time of its own.
 * The prototype's stamp (line 2191) — a report created on the phone has not
 * been through the General Information form yet.
 */
const VISIT_START_FALLBACK = "10:32";

/** Resolves a seeded source photo to its file and its caption. */
function seededPhoto(sourceId: string): VisitPhoto {
  const seed = PHOTO_SEED.find(([id]) => id === sourceId);
  if (!seed) {
    throw new Error(`visit/page.tsx: no seed entry for source photo "${sourceId}"`);
  }
  return { id: sourceId, src: photoSrc(sourceId), caption: seed[1] };
}

/**
 * The visit this phone is standing in: the most recently edited report that is
 * not archived.
 *
 * Visit Mode has no report picker — README §17 keeps the surface deliberately
 * small, and the home grid is the whole navigation. So "the open visit" has to
 * be derived, and the report the user touched last is the same one the desktop
 * reports table opens on (README §19). `listReports()` already returns them in
 * that order and already leaves the archived ones out.
 */
async function openVisit(): Promise<Report | { message: string }> {
  const open = await listReports();
  if (!open.ok) return { message: open.error.message };

  const summary = open.data[0];
  if (!summary) {
    return {
      message:
        "There is no open visit on this account yet. Create the report on the desktop first — " +
        "Visit Mode captures against a report, it does not start one.",
    };
  }

  // The summary carries the header; the body behind it carries §6 and the
  // section predicates, and only `getReport` reads those.
  const detail = await getReport(summary.id);
  return detail.ok ? detail.data.report : { message: detail.error.message };
}

export default async function VisitPage() {
  const visit = await openVisit();

  if ("message" in visit) {
    return <NoOpenVisit message={visit.message} />;
  }

  const done = sectionCompletion(visit, REPORT_PHOTOS);

  // "Aug 12, 2026" → "Aug 12": the header line names the day, not the year.
  const visitDay = visit.visitDate.replace(/,\s*\d{4}$/, "");

  return (
    <PhoneFrame title="Visit Mode" editorHref={`/reports/${visit.id}/general`}>
      <VisitMode
        reportId={visit.id}
        supplierName={visit.supplierShortName}
        visitLine={`Factory Visit · ${visitDay} · ${visit.startTime ?? VISIT_START_FALLBACK}`}
        status={visit.status}
        queuedItems={QUEUED_ITEMS}
        documentNumber={visit.documentNumber}
        completion={reportCompletion(visit, REPORT_PHOTOS)}
        sections={SECTIONS.map((section) => ({
          id: section.id,
          number: section.number,
          label: section.label,
          done: done[section.id],
        }))}
        counters={VISIT_COUNTERS}
        observations={visit.sections.observations}
        lastPhotos={LAST_PHOTO_IDS.map(seededPhoto)}
        viewfinder={seededPhoto(VIEWFINDER_ID)}
        observationPhoto={seededPhoto(OBSERVATION_PHOTO_ID)}
      />
    </PhoneFrame>
  );
}

/**
 * [INFERRED] — what the phone shows when there is nothing to capture against,
 * or when the read failed. The approved design has no capture for this state:
 * the prototype always has its one seeded report open. It is built from the
 * report screen's own type and spacing rather than anything new, and it states
 * what happened to the user's data and offers the way on (README §22).
 */
function NoOpenVisit({ message }: { message: string }) {
  return (
    <PhoneFrame title="Visit Mode" editorHref="/reports">
      <div style={{ padding: "14px 16px 20px", flex: 1 }}>
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: 19,
            letterSpacing: "normal",
            margin: "0 0 4px",
          }}
        >
          No open visit
        </h2>
        <p
          style={{
            fontSize: 12.5,
            lineHeight: 1.55,
            color: "var(--color-neutral-700)",
            margin: "0 0 16px",
          }}
        >
          {message}
        </p>
        <ButtonLink
          href="/reports"
          variant="secondary"
          block
          style={{ fontSize: 14, minHeight: 48 }}
        >
          Open the reports list
        </ButtonLink>
      </div>
    </PhoneFrame>
  );
}
