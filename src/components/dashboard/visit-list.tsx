import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { Tag } from "@/components/ui/badge";
import { REPORTS, type DashboardVisit } from "@/lib/mock-data";

/**
 * Dashboard — "Upcoming / Recent Visits" (README §1.2, prototype lines
 * 248..266).
 *
 * A 10px-gap column of `.card` rows: a 42px date block (9.5px uppercase month
 * over a 20px Barlow Condensed day, border-right, 10px right padding), the
 * supplier over its place line, and the status tag.
 *
 * **[INFERRED]** — the prototype's cards are static; each one is rendered here
 * as a link to that visit's report, resolved from the seeded reports by
 * supplier. A visit with no report keeps the identical card as plain markup
 * rather than a link that goes nowhere.
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

function reportHref(visit: DashboardVisit): string | undefined {
  const report = REPORTS.find(
    (candidate) => candidate.supplierShortName === visit.supplier,
  );
  return report ? `/reports/${report.id}/purpose` : undefined;
}

function VisitBody({ visit }: { visit: DashboardVisit }): ReactNode {
  return (
    <>
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
      <Tag tone={visit.tagTone}>{visit.tagLabel}</Tag>
    </>
  );
}

export interface VisitListProps {
  visits: readonly DashboardVisit[];
}

export function VisitList({ visits }: VisitListProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {visits.map((visit) => {
        const href = reportHref(visit);
        return href ? (
          <Link
            key={visit.id}
            href={href}
            className="card hover:bg-[var(--rule-hover)]"
            style={CARD}
          >
            <VisitBody visit={visit} />
          </Link>
        ) : (
          <div key={visit.id} className="card" style={CARD}>
            <VisitBody visit={visit} />
          </div>
        );
      })}
    </div>
  );
}
