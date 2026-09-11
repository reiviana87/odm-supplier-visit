"use client";

import { Blueprint } from "@/components/ui/blueprint";
import { Button, IconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { TRANSCRIPT_META } from "@/lib/mock-data";

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
}: {
  panel: RailPanel;
  onClose?: () => void;
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

      {panel === "sources" ? <SourcesPanel /> : <AssistantPanel />}
    </aside>
  );
}

function SourcesPanel() {
  return (
    <div className="flex flex-col" style={{ gap: 10 }}>
      <div className="grid grid-cols-2" style={{ gap: 6 }}>
        <Button variant="secondary" icon="download" size="compact">
          Plaud Transcript
        </Button>
        <Button variant="secondary" icon="mic" size="compact">
          Audio
        </Button>
        <Button variant="secondary" icon="note" size="compact">
          Notes
        </Button>
        <Button variant="secondary" icon="file" size="compact">
          Documents
        </Button>
      </div>

      <Blueprint style={{ padding: "10px 11px" }}>
        <div className="flex items-start" style={{ gap: 8 }}>
          <Icon name="download" size={13} style={{ marginTop: 3, flex: "none" }} />
          <div className="min-w-0 flex-1">
            <div style={{ fontSize: 12.5, wordBreak: "break-word" }}>
              {TRANSCRIPT_META.fileName}
            </div>
            <div style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>
              Plaud Transcript · {TRANSCRIPT_META.words.toLocaleString("en-US")} words ·{" "}
              {TRANSCRIPT_META.uploadedLabel}
            </div>
          </div>
        </div>
        <div className="mt-2 flex" style={{ gap: 4 }}>
          <Button variant="primary" size="compact" className="flex-1">
            Analyze
          </Button>
          <Button variant="secondary" size="compact">
            Preview
          </Button>
          <IconButton label="Remove transcript" name="trash" size={26} />
        </div>
      </Blueprint>

      <SourceRow
        icon="note"
        title="Field notes — 12 Aug.md"
        subtitle="Notes · 7 entries · captured in Visit Mode"
      />
      <SourceRow
        icon="file"
        title="Huatong_Company_Presentation_EN.pdf"
        subtitle="Document · 42 pages · 18.4 MB"
      />
      <SourceRow
        icon="factory"
        title="Supplier record — HEBEI HUATONG"
        subtitle="Snapshot taken Aug 12, 2026"
      />
    </div>
  );
}

function SourceRow({
  icon,
  title,
  subtitle,
}: {
  icon: "note" | "file" | "factory";
  title: string;
  subtitle: string;
}) {
  return (
    <Blueprint style={{ padding: "10px 11px" }}>
      <div className="flex items-start" style={{ gap: 8 }}>
        <Icon name={icon} size={13} style={{ marginTop: 3, flex: "none" }} />
        <div className="min-w-0 flex-1">
          <div style={{ fontSize: 12.5, wordBreak: "break-word" }}>{title}</div>
          <div style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>
            {subtitle}
          </div>
        </div>
      </div>
    </Blueprint>
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
