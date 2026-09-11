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
export function EditorHeader({
  report,
  activeSection,
  autosave,
  onSaveNow,
  onRetrySave,
  onPreview,
  onToggleSources,
  onToggleAssistant,
  onExport,
  onMoreActions,
}: {
  report: Report;
  activeSection: SectionId;
  autosave: AutosaveState;
  onSaveNow?: () => void;
  onRetrySave?: () => void;
  onPreview?: () => void;
  onToggleSources?: () => void;
  onToggleAssistant?: () => void;
  onExport?: () => void;
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
          <AutosaveIndicator state={autosave} onRetry={onRetrySave} />
        </div>

        <div className="flex flex-none" style={{ gap: 6 }}>
          <Button variant="secondary" icon="save" size="toolbar" onClick={onSaveNow}>
            Save
          </Button>
          <Button variant="secondary" icon="eye" size="toolbar" onClick={onPreview}>
            Preview
          </Button>
          <Button
            variant="secondary"
            icon="note"
            size="toolbar"
            onClick={onToggleSources}
          >
            Sources
          </Button>
          <Button
            variant="secondary"
            icon="spark"
            size="toolbar"
            onClick={onToggleAssistant}
            style={{
              borderColor: "var(--color-accent-300)",
              color: "var(--color-accent-800)",
            }}
          >
            AI Assistant
          </Button>
          <Button variant="primary" icon="download" size="toolbar" onClick={onExport}>
            Export Word
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
