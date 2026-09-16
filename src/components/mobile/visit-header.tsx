import { ReportStatusBadge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import type { ReportStatus } from "@/types/domain";

/**
 * Visit Mode header — README §17, prototype lines 2187..2198.
 *
 *   padding 14px 16px 12px · border-bottom 1px solid var(--color-divider)
 *   supplier name  Barlow Condensed 600 22px / 1.1
 *   visit line     12.5px var(--color-neutral-700)
 *   status badge   the report's own status tag
 *   banner         margin-top 9 · 11.5px · padding 5px 8px ·
 *                  var(--color-warning-bg) on a 1px var(--color-warning-border)
 *                  border · var(--color-warning-ink) ink · 13px wifi-off icon
 *
 * Two measurements differ from README §17, which gives the supplier name as
 * 19px and describes the banner icon without a size. The prototype is the
 * measured truth on both counts: the name is 22px and the icon is 13px.
 *
 * Offline sync is not Phase 1. The banner is real UI and the queue count is
 * seeded — nothing is queued, watched or replayed behind it yet.
 */
export interface VisitHeaderProps {
  supplierName: string;
  /** e.g. "Factory Visit · Aug 12 · 10:32". */
  visitLine: string;
  status: ReportStatus;
  /** Seeded count shown in the weak-signal banner. */
  queuedItems: number;
}

export function VisitHeader({
  supplierName,
  visitLine,
  status,
  queuedItems,
}: VisitHeaderProps) {
  return (
    <header
      style={{
        padding: "14px 16px 12px",
        borderBottom: "1px solid var(--color-divider)",
        flex: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 600,
              fontSize: 22,
              lineHeight: 1.1,
              letterSpacing: "normal",
              margin: 0,
            }}
          >
            {supplierName}
          </h1>
          <p style={{ fontSize: 12.5, color: "var(--color-neutral-700)", margin: 0 }}>
            {visitLine}
          </p>
        </div>
        <ReportStatusBadge status={status} />
      </div>

      <p
        role="status"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          margin: "9px 0 0",
          fontSize: 11.5,
          color: "var(--color-warning-ink)",
          background: "var(--color-warning-bg)",
          border: "1px solid var(--color-warning-border)",
          padding: "5px 8px",
        }}
      >
        <Icon name="wifi-off" size={13} style={{ flex: "none" }} />
        Weak factory signal · {queuedItems} items queued
      </p>
    </header>
  );
}
