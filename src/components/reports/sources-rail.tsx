"use client";

import { Blueprint } from "@/components/ui/blueprint";
import { Button, IconButton } from "@/components/ui/button";
import { TranscriptPanel } from "@/components/reports/transcript-panel";
import type { TranscriptSource } from "@/lib/data/transcript-actions";
import type { Observation } from "@/types/domain";

/**
 * The editor rail — README §2 ("Editor rail"), §6.1 ("Right — rail"), §20.
 *
 *   width 320px · flex none · border-left 1px solid var(--color-divider)
 *   position sticky, top 156px · max-height calc(100vh - 156px) · overflow auto
 *
 * Two panels toggled from the editor header: **Sources** (transcript,
 * documents, photos, supplier record) and **AI Assistant** (scoped chat).
 * README §20: "drawer for reference material used *while* working".
 *
 * Prototype: design-handoff/ODM Supplier Visit.dc.html — the Sources rail is
 * visible in screenshots/04-report-editor.png and 05-editor-visit-relevant-
 * information.png.
 */
export type RailPanel = "sources" | "assistant";

export function EditorRail({
  panel,
  onClose,
  reportId,
  transcripts,
  observations,
}: {
  panel: RailPanel;
  onClose?: () => void;
  reportId: string;
  transcripts: readonly TranscriptSource[];
  /** §6's list, so a finding added from here appends to it. */
  observations: readonly Observation[];
}) {
  return (
    <aside
      aria-label={panel === "sources" ? "Sources" : "AI Assistant"}
      className="anim-slide flex-none self-start overflow-auto"
      style={{
        width: "var(--editor-rail-width)",
        borderLeft: "1px solid var(--color-divider)",
        position: "sticky",
        top: "var(--editor-header-offset)",
        maxHeight: "calc(100vh - var(--editor-header-offset))",
        padding: "16px 16px 24px",
      }}
    >
      <div className="mb-3 flex items-center" style={{ gap: 8 }}>
        <h5 className="flex-1" style={{ margin: 0 }}>
          {panel === "sources" ? "Sources" : "AI Assistant"}
        </h5>
        <IconButton label="Close panel" name="x" size={24} onClick={onClose} />
      </div>

      {panel === "sources" ? (
        <TranscriptPanel
          reportId={reportId}
          transcripts={transcripts}
          observations={observations}
        />
      ) : (
        <AssistantPanel />
      )}
    </aside>
  );
}

function AssistantPanel() {
  return (
    <div className="flex flex-col" style={{ gap: 10 }}>
      <p style={{ fontSize: 12.5, color: "var(--color-neutral-700)", margin: 0 }}>
        Ask a question scoped to this report. Answers cite the section and the
        transcript timestamp they came from.
      </p>
      <Blueprint dashed style={{ padding: 13 }}>
        <div style={{ fontSize: 12.5, color: "var(--color-neutral-700)" }}>
          The assistant arrives in Phase 4 together with the rest of the AI contract
          (README §11). The rail, its toggle and the scoping are in place.
        </div>
      </Blueprint>
    </div>
  );
}
