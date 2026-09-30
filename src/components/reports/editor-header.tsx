"use client";

import { AutosaveIndicator } from "@/components/reports/autosave-indicator";
import { ReportStatusBadge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button, IconButton } from "@/components/ui/button";
import type { AutosaveState } from "@/lib/autosave/use-autosave";
import type { Report, SectionId } from "@/types/domain";
import { SECTIONS } from "@/types/domain";

/**
 * Editor header — README §2 and §6.1.
 *
 *   position sticky, top 50px · z-index 15 · padding 14px 20px 0
 *   total height 106px, so the content offset below it is 156px
 *
 * Rows, top to bottom:
 *   1. breadcrumb  Reports › GSO-2608001x00 › {section name}
 *   2. title row   document number (h3 scale) · status badge · access note ·
 *                  autosave indicator · Save · Preview · Sources · AI Assistant ·
 *                  Export Word (primary) · overflow
 *   3. subtitle    HEBEI HUATONG Factory Visit · Aug 12, 2026 · Tangshan, Hebei
 *
 * Prototype: design-handoff/ODM Supplier Visit.dc.html lines 766..794, and
 * design-handoff/screenshots/04-report-editor.png for the action set.
 */
/** README §4 — a toggle that is on carries the accent border and ground. */
const PRESSED = {
  borderColor: "var(--color-accent)",
  background: "var(--color-accent-100)",
} as const;

export function EditorHeader({
  report,
  activeSection,
  autosave,
  onSaveNow,
  canSaveNow = true,
  railPanel,
  onRetrySave,
  onReviewConflict,
  onToggleSources,
  onToggleAssistant,
  onExport,
  exporting = false,
  onMoreActions,
}: {
  report: Report;
  activeSection: SectionId;
  autosave: AutosaveState;
  onSaveNow?: () => void;
  /** False on the sections whose content is rows or photographs. */
  canSaveNow?: boolean;
  /** Which rail is open, so its toggle can look pressed. */
  railPanel?: "sources" | "assistant" | null;
  onRetrySave?: () => void;
  /** Phase 2 §18 — opens the conflict dialog from the indicator. */
  onReviewConflict?: () => void;
  onToggleSources?: () => void;
  onToggleAssistant?: () => void;
  onExport?: () => void;
  /** README §24 — the export runs on the server; the button says so meanwhile. */
  exporting?: boolean;
  onMoreActions?: () => void;
}) {
  const section = SECTIONS.find((s) => s.id === activeSection) ?? SECTIONS[0];

  return (
    <header
      className="sticky z-[15]"
      style={{
        top: "var(--topbar-height)",
        borderBottom: "1px solid var(--color-divider)",
        padding: "14px 20px 0",
        background: "var(--color-bg)",
      }}
    >
      <div style={{ marginBottom: 8 }}>
        <Breadcrumb
          items={[
            { label: "Reports", href: "/reports" },
            { label: report.documentNumber },
            { label: section.label },
          ]}
        />
      </div>

      <div
        className="flex items-start"
        style={{ gap: 14, paddingBottom: 12 }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center" style={{ gap: 10 }}>
            <h3 style={{ margin: 0, letterSpacing: "-.01em" }}>
              {report.documentNumber}
            </h3>
            <ReportStatusBadge status={report.status} />
            <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
              Editor · you have write access
            </span>
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--color-neutral-700)",
              marginTop: 2,
            }}
          >
            {report.supplierShortName} Factory Visit · {report.visitDate} ·{" "}
            {report.location}
          </div>
        </div>

        <div style={{ marginRight: 4 }}>
          <AutosaveIndicator
            state={autosave}
            onRetry={onRetrySave}
            onReviewConflict={onReviewConflict}
          />
        </div>

        <div className="flex flex-none" style={{ gap: 6 }}>
          {/* Disabled on the sections that have no body of their own — General
              Information, Company Information and the three image regions save
              through their own controls. Save used to be clickable there and
              return on its first line, which is indistinguishable from broken. */}
          <Button
            variant="secondary"
            icon="save"
            size="toolbar"
            onClick={onSaveNow}
            disabled={!canSaveNow}
            title={
              canSaveNow
                ? "Save this section now"
                : "This section saves through its own controls as you change it"
            }
          >
            Save
          </Button>
          {/* Preview is gone rather than disabled: there is no in-app preview to
              enable, and a button whose only effect was a "not built yet" toast
              read as a broken control. Export Word is the preview. */}
          <Button
            variant="secondary"
            icon="note"
            size="toolbar"
            onClick={onToggleSources}
            aria-pressed={railPanel === "sources"}
            style={railPanel === "sources" ? PRESSED : undefined}
          >
            Sources
          </Button>
          <Button
            variant="secondary"
            icon="spark"
            size="toolbar"
            onClick={onToggleAssistant}
            aria-pressed={railPanel === "assistant"}
            style={{
              borderColor: "var(--color-accent-300)",
              color: "var(--color-accent-800)",
              ...(railPanel === "assistant" ? PRESSED : {}),
            }}
          >
            AI Assistant
          </Button>
          <Button
            variant="primary"
            icon="download"
            size="toolbar"
            onClick={onExport}
            disabled={exporting}
          >
            {exporting ? "Generating…" : "Export Word"}
          </Button>
          <IconButton
            label="More actions"
            name="more"
            variant="secondary"
            size={36}
            iconSize={15}
            onClick={onMoreActions}
          />
        </div>
      </div>
    </header>
  );
}
