import { PhoneFrame } from "@/components/mobile/phone-frame";
import { VisitMode } from "@/components/mobile/visit-mode";
import { ButtonLink } from "@/components/ui/button";
import { listReportPhotos } from "@/lib/data/photo-actions";
import { getReport, listReports } from "@/lib/data/reports";
import { listTranscripts } from "@/lib/data/transcript-actions";
import { reportCompletion, sectionCompletion } from "@/lib/reports/completion";
import {
  SECTIONS,
  type ImageRegion,
  type Report,
  type ReportPhoto,
  type SectionId,
} from "@/types/domain";

/**
 * `/visit` — mobile Visit Mode (README §17, screenshots 16 / 17 / 17b / 18).
 *
 * The composition root: it reads the open visit through the data layer, derives
 * what the screens need, and hands the result to the client shell. On a desktop
 * viewport `PhoneFrame` also draws the approved explanatory column beside the
 * phone.
 *
 * `listReports()` / `getReport()` / `listReportPhotos()` are the only way in —
 * this file does not know a table name and does not branch on demo mode, which
 * lives inside the data layer. Nothing here throws: every call answers with a
 * `DataResult` and a failure renders the sentence instead of a crash.
 *
 * Every number and every thumbnail on this screen is now the visit's own. They
 * used to be the Phase 1 seed, which meant a photograph taken on the phone was
 * stored, exported, and then invisible on the screen that took it — the strip
 * underneath showed another supplier's factory instead.
 */

/** The "Last photos" strip holds six (prototype line 3304). */
const LAST_PHOTO_COUNT = 6;

/** How much of a section fits on one line of the report preview. */
const EXCERPT_CHARS = 92;

/** One line of prose, collapsed and cut where it stops fitting. */
function oneLine(text: string): string {
  const flat = text.trim().replace(/\s+/g, " ");
  return flat.length > EXCERPT_CHARS ? `${flat.slice(0, EXCERPT_CHARS - 1)}\u2026` : flat;
}

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * What a section holds, in a line — the preview's whole point.
 *
 * The mobile report screen used to be thirteen labels and thirteen ticks, which
 * told the reader a section was done without telling them one thing that was in
 * it. These are deliberately derived from the report rather than from the
 * completion predicates: "complete" and "what it says" are different questions.
 */
function excerptFor(
  sectionId: SectionId,
  report: Report,
  photos: readonly ReportPhoto[],
): string {
  const sections = report.sections;
  const inRegion = (region: ImageRegion) =>
    photos.filter((photo) => photo.region === region).length;

  switch (sectionId) {
    case "general":
      return oneLine(`${report.supplierShortName} \u00b7 ${report.visitDate}`);
    case "purpose":
      return oneLine(sections.purpose);
    case "company":
      return oneLine(report.supplierSnapshot.legalName);
    case "overview":
      return oneLine(sections.overview);
    case "products":
      return sections.productRows.length > 0
        ? oneLine(`${plural(sections.productRows.length, "row")} \u00b7 ${sections.mainProducts}`)
        : oneLine(sections.mainProducts);
    case "product-images":
      return inRegion("MAIN_PRODUCT_IMAGES") === 0
        ? ""
        : plural(inRegion("MAIN_PRODUCT_IMAGES"), "photograph");
    case "target":
      return sections.targetProducts.length > 0
        ? oneLine(
            `${plural(sections.targetProducts.length, "product")} \u00b7 ${sections.targetNotes}`,
          )
        : oneLine(sections.targetNotes);
    case "visit":
      return sections.observations.length === 0 && sections.qaBullets.length === 0
        ? ""
        : `${plural(sections.observations.length, "observation")} \u00b7 ${plural(
            sections.qaBullets.length,
            "key point",
          )}`;
    case "certificates":
      return oneLine(sections.certificateNote);
    case "partners":
      return oneLine(sections.partners);
    case "partner-images":
      return inRegion("PARTNER_IMAGES") === 0 ? "" : plural(inRegion("PARTNER_IMAGES"), "photograph");
    case "conclusion":
      return oneLine(sections.conclusion);
    case "appendix":
      return inRegion("APPENDIX_IMAGES") === 0
        ? ""
        : plural(inRegion("APPENDIX_IMAGES"), "photograph");
  }
}

/**
 * The clock in the header line, when the report has no start time of its own.
 * The prototype's stamp (line 2191) — a report created on the phone has not
 * been through the General Information form yet.
 */
const VISIT_START_FALLBACK = "10:32";

/**
 * The strip shows the newest first, which is the opposite of print order.
 *
 * `listReportPhotos` returns them by region then `sort_order` — the order they
 * are laid out on the appendix page. On the phone, during the visit, the useful
 * end is the other one: what was just taken.
 */
function latestFirst(photos: readonly ReportPhoto[]): ReportPhoto[] {
  return [...photos].reverse();
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

  // One read serves the strip, the gallery, the photo counter and both
  // completion predicates, so none of them can disagree with the others.
  const stored = await listReportPhotos(visit.id);
  const photos = stored.ok ? stored.data : [];

  const sources = await listTranscripts(visit.id);

  const done = sectionCompletion(visit, photos);

  // "Aug 12, 2026" → "Aug 12": the header line names the day, not the year.
  const visitDay = visit.visitDate.replace(/,\s*\d{4}$/, "");

  return (
    <PhoneFrame title="Visit Mode" editorHref={`/reports/${visit.id}/general`}>
      <VisitMode
        reportId={visit.id}
        supplierName={visit.supplierShortName}
        visitLine={`Factory Visit · ${visitDay} · ${visit.startTime ?? VISIT_START_FALLBACK}`}
        status={visit.status}
        documentNumber={visit.documentNumber}
        completion={reportCompletion(visit, photos)}
        sections={SECTIONS.map((section) => ({
          id: section.id,
          number: section.number,
          label: section.label,
          done: done[section.id],
          excerpt: excerptFor(section.id, visit, photos),
        }))}
        counters={{ photos: photos.length, notes: visit.sections.qaBullets.length }}
        observations={visit.sections.observations}
        keyPoints={visit.sections.qaBullets}
        transcripts={sources.ok ? sources.data : []}
        photos={photos}
        lastPhotos={latestFirst(photos).slice(0, LAST_PHOTO_COUNT)}
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
