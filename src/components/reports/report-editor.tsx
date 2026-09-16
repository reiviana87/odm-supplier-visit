"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";

import { EditorHeader } from "@/components/reports/editor-header";
import { EditorRail, type RailPanel } from "@/components/reports/sources-rail";
import { SectionNavigator } from "@/components/reports/section-navigator";
import { useToast } from "@/components/ui/toast";
import { useAutosave, type AutosaveOutcome } from "@/lib/autosave/use-autosave";
import { reportCompletion, sectionCompletion } from "@/lib/reports/completion";
import type { Report, ReportPhoto, SectionId } from "@/types/domain";

/**
 * Report editor shell — README §6.1.
 *
 *   Editor body: display flex · align-items stretch
 *                min-height calc(100vh - 156px)
 *   navigator 210 + content + rail 320
 *
 * The writing column is 532px with the rail open and ~840px with it closed
 * (README §2 "Page max width"); tables and photo grids are allowed the full
 * width, so each section decides — this shell only sets the outer padding and
 * the `--writing-column` custom property sections read from.
 *
 * Phase 1 wires the reusable autosave engine to a no-op transport: the state
 * machine, the five indicator states and the flush-on-navigate behaviour are
 * real, the Supabase patch is Phase 2.
 */
export function ReportEditor({
  report,
  photos,
  activeSection,
  children,
}: {
  report: Report;
  photos: readonly ReportPhoto[];
  activeSection: SectionId;
  children: ReactNode;
}) {
  const { toast } = useToast();
  const [railPanel, setRailPanel] = useState<RailPanel | null>("sources");

  const completion = useMemo(
    () => sectionCompletion(report, photos),
    [report, photos],
  );
  const completionPercent = useMemo(
    () => reportCompletion(report, photos),
    [report, photos],
  );

  /**
   * Placeholder transport. The real one — `saveSection` from
   * `@/lib/data/report-actions`, with the row version for optimistic
   * concurrency — is wired in the editor persistence pass; this keeps the
   * indicator exercising its real saving → saved → idle path until then.
   */
  const save = useCallback(async (): Promise<AutosaveOutcome> => {
    await Promise.resolve();
    return { status: "saved" };
  }, []);

  /**
   * README §7 — a report that was saved earlier rests at "Last saved 11:42",
   * not at an empty slot. The seed is the stored row's own timestamp, so the
   * indicator states a fact rather than inventing one.
   */
  const storedLastSaved = useMemo(() => {
    const parsed = new Date(report.lastUpdatedAt);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [report.lastUpdatedAt]);

  const { state: autosave, saveNow, retry } = useAutosave({
    value: report.sections,
    save,
    lastSavedAt: storedLastSaved,
  });

  /**
   * README §6.2 — the navigator shows a warning triangle on sections carrying
   * a blocking issue. Captions are the one predicate that can be partially
   * satisfied, so it is the one warning Phase 1 can compute honestly.
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

  const toggleRail = useCallback((panel: RailPanel) => {
    setRailPanel((current) => (current === panel ? null : panel));
  }, []);

  return (
    <div>
      <EditorHeader
        report={report}
        activeSection={activeSection}
        autosave={autosave}
        onSaveNow={saveNow}
        onRetrySave={retry}
        onPreview={() => toast("Document preview arrives with the DOCX export (Phase 5)")}
        onToggleSources={() => toggleRail("sources")}
        onToggleAssistant={() => toggleRail("assistant")}
        onExport={() => toast("Word export arrives in Phase 5")}
        onMoreActions={() => toast("Duplicate, archive and delete arrive in Phase 2")}
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
          onSubmitForReview={() =>
            toast("Review workflow arrives with report persistence (Phase 2)")
          }
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
          {children}
        </div>

        {railPanel ? (
          <EditorRail panel={railPanel} onClose={() => setRailPanel(null)} />
        ) : null}
      </div>
    </div>
  );
}
