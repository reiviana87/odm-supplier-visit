import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";
import { Blueprint } from "./blueprint";

/**
 * KPI card — README §4, prototype lines 200..205.
 *
 * `.card .blueprint`, `padding:14px 14px 12px`, `gap:2px`; 10px uppercase
 * label, Barlow Condensed 600 34px value, 11px delta. The README quotes the
 * value as "28–30px"; the prototype measures 34px and the prototype wins.
 */
export type KpiDeltaTone = "muted" | "warning" | "accent";

const DELTA_COLOR: Record<KpiDeltaTone, string> = {
  muted: "var(--color-neutral-600)",
  warning: "var(--color-warning-strong)",
  accent: "var(--color-accent-700)",
};

export interface KpiCardProps {
  label: ReactNode;
  value: ReactNode;
  /** Second line — "+2 this quarter", "2 need conclusion", "exported to DOCX". */
  delta?: ReactNode;
  deltaTone?: KpiDeltaTone;
  className?: string;
}

export function KpiCard({
  label,
  value,
  delta,
  deltaTone = "muted",
  className,
}: KpiCardProps) {
  return (
    <Blueprint
      className={cn("card", className)}
      style={{ gap: "2px", padding: "14px 14px 12px" }}
    >
      <div className="kicker-muted">{label}</div>
      <div
        style={{
          fontFamily: "var(--font-heading)",
          fontWeight: 600,
          fontSize: "34px",
          lineHeight: 1.05,
          letterSpacing: "-.02em",
        }}
      >
        {value}
      </div>
      {delta ? (
        <div style={{ fontSize: "11px", color: DELTA_COLOR[deltaTone] }}>{delta}</div>
      ) : null}
    </Blueprint>
  );
}

/** The 6-up dashboard row — prototype line 198. */
export interface KpiGridProps {
  children: ReactNode;
  className?: string;
}

export function KpiGrid({ children, className }: KpiGridProps) {
  return (
    <div
      className={cn(className)}
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
        gap: "14px",
        marginBottom: "26px",
      }}
    >
      {children}
    </div>
  );
}
