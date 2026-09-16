import Link from "next/link";
import type { CSSProperties } from "react";

import { ReportStatusBadge, Tag } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import type { ReportStatus } from "@/types/domain";

/**
 * Dashboard — "Upcoming / Recent Visits" (README §1.2, prototype lines
 * 248..266).
 *
 * A 10px-gap column of `.card` rows: a 42px date block (9.5px uppercase month
 * over a 20px Barlow Condensed day, border-right, 10px right padding), the
 * supplier over its place line, and the status tag.
 *
 * A visit exists in this app only as the report written about it, so every card
 * is a link into that report — the page resolves the route and hands it over.
 * A visit still ahead of today is tagged `Planned`, which is a fact about the
 * date rather than a report status; every other card carries the report's own
 * approved status badge.
 */

const CARD: CSSProperties = {
  flexDirection: "row",
  alignItems: "center",
  gap: "12px",
  padding: "11px 12px",
  color: "var(--color-text)",
  textDecoration: "none",
};

const MONTH: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "9.5px",
  letterSpacing: ".1em",
  textTransform: "uppercase",
  color: "var(--color-neutral-600)",
};

const DAY: CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontWeight: 600,
  fontSize: "20px",
  lineHeight: 1.1,
};

const SUPPLIER: CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontWeight: 600,
  fontSize: "13px",
};

export interface VisitItem {
  id: string;
  /** Three-letter month, rendered uppercase. */
  month: string;
  day: string;
  supplier: string;
  /** "Deqing, Zhejiang · planned" — the report's location and where it stands. */
  place: string;
  /** The visit date has not arrived yet. */
  planned: boolean;
  status: ReportStatus;
  href: string;
}

export interface VisitListProps {
  visits: readonly VisitItem[];
  /** The sentence from a failed read (§27), shown instead of the cards. */
  error?: string;
}

export function VisitList({ visits, error }: VisitListProps) {
  if (visits.length === 0) {
    return <EmptyState message={error ?? "No visits recorded yet."} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {visits.map((visit) => (
        <Link
          key={visit.id}
          href={visit.href}
          className="card hover:bg-[var(--rule-hover)]"
          style={CARD}
        >
          <div
            style={{
              width: "42px",
              flex: "none",
              textAlign: "center",
              borderRight: "1px solid var(--color-divider)",
              paddingRight: "10px",
            }}
          >
            <div style={MONTH}>{visit.month}</div>
            <div style={DAY}>{visit.day}</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={SUPPLIER}>{visit.supplier}</div>
            <div style={{ fontSize: "11.5px", color: "var(--color-neutral-600)" }}>
              {visit.place}
            </div>
          </div>
          {visit.planned ? (
            <Tag tone="warning">Planned</Tag>
          ) : (
            <ReportStatusBadge status={visit.status} />
          )}
        </Link>
      ))}
    </div>
  );
}
