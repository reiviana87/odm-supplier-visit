import { cn } from "@/lib/utils/cn";

/**
 * Progress bar and completion indicator — README §4, §6.1.
 *
 * 4px track `--color-neutral-300`, fill `--color-accent`; the editor navigator
 * uses the 5px / 17px pair measured from the prototype (lines 798..805).
 * Colour is always accent — completion never turns red or green.
 */

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export interface ProgressBarProps {
  /** 0–100. Ignored while `indeterminate`. */
  value?: number;
  /** Track height in px. 4px default; the navigator uses 5px. */
  height?: number;
  /** Export steps: work is running but the share is unknown. */
  indeterminate?: boolean;
  /** Accessible name for the bar — required whenever no adjacent label names it. */
  label?: string;
  className?: string;
}

export function ProgressBar({
  value = 0,
  height = 4,
  indeterminate = false,
  label,
  className,
}: ProgressBarProps) {
  const pct = clampPercent(value);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : Math.round(pct)}
      className={cn("w-full", className)}
      style={{ height, background: "var(--color-neutral-300)" }}
    >
      <div
        className={cn(indeterminate && "anim-pulse")}
        style={{
          height: "100%",
          width: indeterminate ? "100%" : `${pct}%`,
          background: "var(--color-accent)",
        }}
      />
    </div>
  );
}

/**
 * `navigator` is the editor rail treatment: the "REPORT COMPLETION" label with
 * the right-aligned percentage over a 5px bar. `inline` is the reports-table
 * cell: a 60px bar followed by the percentage (README §19).
 */
export type CompletionVariant = "navigator" | "inline";

export interface CompletionIndicatorProps {
  /** 0–100. */
  value: number;
  variant?: CompletionVariant;
  /** Label text — uppercased by the kicker style. Mobile Visit Mode uses "Completion". */
  label?: string;
  className?: string;
}

export function CompletionIndicator({
  value,
  variant = "navigator",
  label = "Report Completion",
  className,
}: CompletionIndicatorProps) {
  const pct = Math.round(clampPercent(value));

  if (variant === "inline") {
    return (
      <div
        className={cn("flex items-center", className)}
        style={{ gap: 7 }}
      >
        <ProgressBar
          value={pct}
          height={4}
          label={label}
          className="w-[60px] flex-none"
        />
        <span
          style={{
            fontSize: 11,
            color: "var(--color-neutral-700)",
            width: 30,
            textAlign: "right",
          }}
        >
          {pct}%
        </span>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-baseline" style={{ gap: 6 }}>
        <span className="kicker-muted" style={{ flex: 1 }}>
          {label}
        </span>
        <span
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: 17,
          }}
        >
          {pct}%
        </span>
      </div>
      <ProgressBar value={pct} height={5} label={label} className="mt-[6px]" />
    </div>
  );
}
