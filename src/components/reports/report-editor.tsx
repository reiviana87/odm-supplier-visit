"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import { ConflictDialog } from "@/components/reports/conflict-dialog";
import { EditorHeader } from "@/components/reports/editor-header";
import {
  SectionDraftProvider,
  type SectionDraft,
  type SectionDraftValue,
} from "@/components/reports/section-draft";
import { EditorRail, type RailPanel } from "@/components/reports/sources-rail";
import type { TranscriptSource } from "@/lib/data/transcript-actions";
import { SectionNavigator } from "@/components/reports/section-navigator";
import { useToast } from "@/components/ui/toast";
import {
  useAutosave,
  type AutosaveOutcome,
  type AutosaveSaveContext,
} from "@/lib/autosave/use-autosave";
import { getSectionRecord, saveSection, setReportStatus } from "@/lib/data/report-actions";
import { exportReportDocx } from "@/lib/export/export-actions";
import { sectionBodyOf } from "@/lib/data/report-mappers";
import { reportCompletion, sectionCompletion } from "@/lib/reports/completion";
import {
  SECTIONS,
  type Report,
  type ReportPhoto,
  type SectionId,
  type SectionRecord,
} from "@/types/domain";

/**
 * Report editor shell — README §6.1.
 *
 *   Editor body: display flex · align-items stretch
 *                min-height calc(100vh - 156px)
 *                navigator 210 + content + rail 320
 *
 * The writing column is 532px with the rail open and ~840px with it closed
 * (README §2 "Page max width"); tables and photo grids are allowed the full
 * width, so each section decides — this shell only sets the outer padding and
 * the `--writing-column` custom property sections read from.
 *
 * ## Why the section editor is keyed
 *
 * Each section is its own route, so navigating between them re-renders this
 * component in place — the draft, the row version and the autosave engine would
 * all carry over to a section they do not describe. `key={activeSection}` makes
 * that a remount instead: the pending patch for the section being left is
 * flushed by the hook's own unmount path, with the section id it was written
 * for still captured in `save`, and the section being opened starts from its own
 * stored row. What legitimately outlives a section — which rail panel is open —
 * is held here, above the key.
 */
export function ReportEditor({
  report,
  sections,
  photos,
  transcripts,
  activeSection,
  children,
}: {
  report: Report;
  /** The stored rows, carrying the `version` each autosave patches against. */
  sections: readonly SectionRecord[];
  photos: readonly ReportPhoto[];
  /** Sources the rail lists and the assistant analyses (README §11). */
  transcripts: readonly TranscriptSource[];
  activeSection: SectionId;
  children: ReactNode;
}) {
  const [railPanel, setRailPanel] = useState<RailPanel | null>("sources");

  const toggleRail = useCallback((panel: RailPanel) => {
    setRailPanel((current) => (current === panel ? null : panel));
  }, []);

  const closeRail = useCallback(() => setRailPanel(null), []);

  return (
    <SectionEditor
      key={activeSection}
      report={report}
      record={sections.find((section) => section.sectionId === activeSection)}
      photos={photos}
      transcripts={transcripts}
      activeSection={activeSection}
      railPanel={railPanel}
      onToggleRail={toggleRail}
      onCloseRail={closeRail}
    >
      {children}
    </SectionEditor>
  );
}

/** What the user chose in the conflict dialog, while that choice is settling. */
type Resolution = "reload" | "keep";

/** `serverValue` crosses the transport as `unknown`; this is what it must be. */
function isSectionDraft(value: unknown): value is SectionDraft {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.body === "string" && typeof candidate.excluded === "boolean"
  );
}

function SectionEditor({
  report,
  record,
  photos,
  transcripts,
  activeSection,
  railPanel,
  onToggleRail,
  onCloseRail,
  children,
}: {
  report: Report;
  record: SectionRecord | undefined;
  photos: readonly ReportPhoto[];
  transcripts: readonly TranscriptSource[];
  activeSection: SectionId;
  railPanel: RailPanel | null;
  onToggleRail: (panel: RailPanel) => void;
  onCloseRail: () => void;
  children: ReactNode;
}) {
  const { toast } = useToast();
  const router = useRouter();

  const [draft, setDraft] = useState<SectionDraft>(() => ({
    body: record?.body ?? "",
    excluded: record?.excluded ?? false,
  }));
  const [conflictOpen, setConflictOpen] = useState(false);
  const [resolving, setResolving] = useState<Resolution | undefined>(undefined);
  const [submitting, startSubmit] = useTransition();
  const [exporting, startExport] = useTransition();

  /**
   * Phase 2 §18 — the version the next patch is built on. It is seeded from the
   * stored row and moved on by each acknowledgement, never by a rejection:
   * re-sending the version the row was loaded at would be refused for as long
   * as the page stayed open, which is the failure mode this ref exists to
   * prevent. The hook's own `context.version` wins when it has one, because
   * after a resolution the hook knows something this ref does not.
   */
  const versionRef = useRef(record?.version ?? 1);

  /** Sections whose content is rows or photographs have no body to autosave. */
  const editable =
    record !== undefined && sectionBodyOf(report.sections, activeSection) !== null;

  const definition = SECTIONS.find((section) => section.id === activeSection);
  const sectionLabel = definition
    ? `${definition.number} ${definition.label}`.trim()
    : activeSection;

  const completion = useMemo(
    () => sectionCompletion(report, photos),
    [report, photos],
  );
  const completionPercent = useMemo(
    () => reportCompletion(report, photos),
    [report, photos],
  );

  /**
   * The autosave transport — one `report_sections` patch, matched on the
   * version above (Phase 2 §18).
   *
   * A `stale` rejection is answered with the row that won the race, read back
   * through `getSectionRecord`, because that is what the dialog has to describe
   * before the user can choose between the two. Nothing here adopts the newer
   * version: doing so would arm the overwrite that §18 asks the user to
   * authorise.
   */
  const save = useCallback(
    async (
      value: SectionDraft,
      context: AutosaveSaveContext,
    ): Promise<AutosaveOutcome> => {
      const result = await saveSection({
        reportId: report.id,
        sectionId: activeSection,
        body: value.body,
        excluded: value.excluded,
        version: context.version ?? versionRef.current,
      });

      if (result.ok) {
        versionRef.current = result.data.version;
        return {
          status: "saved",
          version: result.data.version,
          updatedAt: result.data.updatedAt,
        };
      }

      if (result.error.code !== "stale") {
        return { status: "error", message: result.error.message };
      }

      const latest = await getSectionRecord(report.id, activeSection);
      if (!latest.ok) {
        // A conflict we cannot describe is still a conflict: the hook stops
        // either way, and the dialog says only what it was told.
        return { status: "stale" };
      }

      return {
        status: "stale",
        serverVersion: latest.data.version,
        serverUpdatedAt: latest.data.updatedAt,
        serverValue: { body: latest.data.body, excluded: latest.data.excluded },
      };
    },
    [report.id, activeSection],
  );

  /**
   * README §7 — a section that was written before rests at "Last saved 11:42",
   * not at an empty slot. The row's own timestamp, so the indicator states a
   * fact rather than inventing one.
   */
  const storedLastSaved = useMemo(() => {
    const parsed = new Date(record?.updatedAt ?? report.lastUpdatedAt);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [record?.updatedAt, report.lastUpdatedAt]);

  const {
    state: autosave,
    saveNow,
    retry,
    resolveWithServer,
    resolveWithLocal,
  } = useAutosave({
    value: draft,
    save,
    enabled: editable,
    lastSavedAt: storedLastSaved,
  });

  const setBody = useCallback((body: string) => {
    setDraft((current) => (current.body === body ? current : { ...current, body }));
  }, []);

  const setExcluded = useCallback((excluded: boolean) => {
    setDraft((current) =>
      current.excluded === excluded ? current : { ...current, excluded },
    );
  }, []);

  const sectionDraft: SectionDraftValue = useMemo(
    () => ({
      reportId: report.id,
      sectionId: activeSection,
      draft,
      setBody,
      setExcluded,
      editable,
    }),
    [report.id, activeSection, draft, setBody, setExcluded, editable],
  );

  /**
   * "Reload latest version" — the user gave up their own text for the newer
   * one, so it is re-read before it replaces what is on screen.
   *
   * When the row is still at the version the dialog described, the value handed
   * back is the very object the transport reported, which the hook recognises
   * and does not send back to the server. When the row has moved on again since
   * the dialog was drawn, the newer text is taken instead and the next patch
   * goes out at a version the server will refuse — reopening the conflict with
   * the current facts, which is honest, rather than overwriting a third version
   * nobody has seen.
   */
  const reloadLatest = useCallback(async () => {
    setResolving("reload");
    const latest = await getSectionRecord(report.id, activeSection);
    setResolving(undefined);

    if (!latest.ok) {
      // Nothing is resolved and nothing is discarded: the draft is still in the
      // editor and the dialog is still open to be answered again.
      toast(latest.error.message, "error");
      return;
    }

    const described = autosave.conflict?.serverValue;
    const adopted =
      autosave.conflict?.serverVersion === latest.data.version &&
      isSectionDraft(described)
        ? described
        : { body: latest.data.body, excluded: latest.data.excluded };

    versionRef.current = latest.data.version;
    setDraft(adopted);
    resolveWithServer();
    setConflictOpen(false);
    toast("Reloaded the newer version of this section.");
  }, [report.id, activeSection, autosave.conflict, resolveWithServer, toast]);

  /** "Keep my changes" — the draft is re-sent at the version it replaces. */
  const keepMine = useCallback(() => {
    setConflictOpen(false);
    resolveWithLocal();
  }, [resolveWithLocal]);

  /**
   * README §6.2 — the navigator shows a warning triangle on sections carrying
   * a blocking issue. Captions are the one predicate that can be partially
   * satisfied, so it is the one warning that can be computed honestly today.
   */
  const warnings = useMemo(() => {
    const result: Partial<Record<SectionId, string>> = {};
    const regions: ReadonlyArray<[SectionId, string]> = [
      ["product-images", "MAIN_PRODUCT_IMAGES"],
      ["partner-images", "PARTNER_IMAGES"],
      ["appendix", "APPENDIX_IMAGES"],
    ];
    for (const [sectionId, region] of regions) {
      const inRegion = photos.filter((photo) => photo.region === region);
      const missing = inRegion.filter((photo) => !photo.caption.trim()).length;
      if (inRegion.length > 0 && missing > 0) {
        result[sectionId] =
          `${missing} ${missing === 1 ? "image has" : "images have"} no caption — required before export`;
      }
    }
    return result;
  }, [photos]);

  /**
   * Phase 2 §12 — there is no approval workflow. "Submit for Review" is the
   * status field and nothing else, so the toast says so instead of implying an
   * approver was notified.
   */
  const submitForReview = useCallback(() => {
    startSubmit(async () => {
      const result = await setReportStatus(report.id, "in_review");
      if (!result.ok) {
        toast(result.error.message, "error");
        return;
      }
      toast(
        "Status set to In Review — there is no approval step, so anyone with edit access can move it on again.",
      );
      router.refresh();
    });
  }, [report.id, router, toast]);

  /**
   * README §24 — build the document, then hand it to the browser.
   *
   * The bytes come back base64 because a Buffer does not survive the server
   * action boundary. An object URL is used rather than a data: URL so Word gets
   * a real filename, and it is revoked as soon as the click has happened.
   */
  const exportDocx = useCallback(() => {
    startExport(async () => {
      const result = await exportReportDocx(report.id);
      if (!result.ok) {
        toast(result.error.message, "error");
        return;
      }

      const { fileName, content, skipped, templateNotice } = result.data;
      const bytes = Uint8Array.from(atob(content), (character) => character.charCodeAt(0));
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);

      // Two different things can go quietly wrong in an export, and neither may
      // be swallowed: photographs that could not be read, and a document that
      // did not get the corporate letterhead. The second one is the dangerous
      // one — the file opens, looks finished, and is branded like nothing else
      // the company sends. Both are said in the same breath, because telling
      // somebody half of what is wrong with a document is worse than silence.
      const notes: string[] = [];
      if (skipped.length > 0) {
        notes.push(
          `${skipped.length} photograph${skipped.length === 1 ? "" : "s"} could not be read and ${
            skipped.length === 1 ? "is" : "are"
          } missing from it.`,
        );
      }
      if (templateNotice) notes.push(templateNotice);

      toast(
        notes.length === 0 ? `${fileName} downloaded.` : `${fileName} downloaded. ${notes.join(" ")}`,
        notes.length === 0 ? undefined : "warning",
      );
    });
  }, [report.id, toast]);

  return (
    <div>
      <EditorHeader
        report={report}
        activeSection={activeSection}
        autosave={autosave}
        onSaveNow={saveNow}
        onRetrySave={retry}
        onReviewConflict={() => setConflictOpen(true)}
        onPreview={() =>
          toast("Export the Word file to see the document — an in-app preview is not built yet.")
        }
        onToggleSources={() => onToggleRail("sources")}
        onToggleAssistant={() => onToggleRail("assistant")}
        onExport={exportDocx}
        exporting={exporting}
        onMoreActions={() =>
          toast(
            "Archive a report from the reports list; duplicating one is not built yet.",
          )
        }
      />

      <div
        className="flex items-stretch"
        style={{ minHeight: "calc(100vh - var(--editor-header-offset))" }}
      >
        <SectionNavigator
          reportId={report.id}
          activeSection={activeSection}
          completion={completion}
          completionPercent={completionPercent}
          warnings={warnings}
          submitting={submitting}
          onSubmitForReview={submitForReview}
        />

        <div
          className="min-w-0 flex-1"
          style={{
            padding: "22px 26px 48px",
            maxWidth: 1080,
            // README §2 — the writing column narrows while the rail is open.
            ["--writing-column" as string]: railPanel ? "532px" : "840px",
          }}
        >
          <SectionDraftProvider value={sectionDraft}>
            {children}
          </SectionDraftProvider>
        </div>

        {railPanel ? (
          <EditorRail
            panel={railPanel}
            onClose={onCloseRail}
            reportId={report.id}
            transcripts={transcripts}
            observations={report.sections.observations}
          />
        ) : null}
      </div>

      <ConflictDialog
        open={conflictOpen && autosave.status === "conflict"}
        onDismiss={() => setConflictOpen(false)}
        onReloadLatest={() => void reloadLatest()}
        onKeepMine={keepMine}
        conflict={autosave.conflict}
        sectionLabel={sectionLabel}
        pending={resolving}
      />
    </div>
  );
}
