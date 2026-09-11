import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * The list-page header — prototype lines 183..194 (dashboard: kicker, 22px
 * bottom margin) and 273..279 (reports: no kicker, 18px bottom margin).
 *
 * `display:flex; align-items:flex-end; gap:16px`. The text block takes
 * `flex:1`, so `actions` is right-aligned; actions are rendered as direct flex
 * children, which is what puts the approved 16px between them.
 */
export interface PageHeaderProps {
  /** 10px uppercase accent eyebrow — "Global Sourcing Office · ODM Activities". */
  kicker?: ReactNode;
  title: ReactNode;
  /** 13px muted line under the title. */
  subtitle?: ReactNode;
  /** Buttons. Pass a fragment — each child becomes a flex child of the row. */
  actions?: ReactNode;
  /**
   * Bottom margin in px. Defaults to the measured 22px when a kicker is
   * present (dashboard) and 18px when it is not (reports, suppliers).
   */
  spacing?: number;
  className?: string;
}

export function PageHeader({
  kicker,
  title,
  subtitle,
  actions,
  spacing,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(className)}
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: "16px",
        marginBottom: spacing ?? (kicker ? 22 : 18),
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        {kicker ? (
          <div className="kicker" style={{ marginBottom: "5px" }}>
            {kicker}
          </div>
        ) : null}
        <h2 style={{ margin: "0 0 3px" }}>{title}</h2>
        {subtitle ? (
          <p className="text-muted" style={{ fontSize: "13px", margin: 0 }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions}
    </div>
  );
}

/**
 * The "Recent Reports" block heading — prototype lines 210..214.
 * `h5` on a baseline row, optional right-aligned ghost action, 8px below.
 */
export interface SectionHeaderProps {
  title: ReactNode;
  /** Right-aligned control — normally a ghost `Button` at 11.5px. */
  action?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, action, className }: SectionHeaderProps) {
  return (
    <div
      className={cn(className)}
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: "10px",
        marginBottom: "8px",
      }}
    >
      <h5 style={{ margin: 0 }}>{title}</h5>
      {action ? (
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "baseline",
            gap: "8px",
          }}
        >
          {action}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The standard page padding wrapper — README §2: page padding `26px 24px 40px`
 * (dashboard, reports, suppliers) plus the `riseIn .16s` entrance.
 */
export interface PageShellProps {
  children: ReactNode;
  className?: string;
}

export function PageShell({ children, className }: PageShellProps) {
  return (
    <div className={cn("anim-rise", className)} style={{ padding: "26px 24px 40px" }}>
      {children}
    </div>
  );
}
