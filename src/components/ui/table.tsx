"use client";

import type {
  ComponentPropsWithoutRef,
  CSSProperties,
  MouseEvent,
  ReactNode,
} from "react";

import { cn } from "@/lib/utils/cn";
import { Blueprint } from "./blueprint";

/**
 * Tables — README §19 (+ §4 "Table" row).
 *
 * Shared behaviour, fixed once here so no screen re-measures it:
 *   • wrapper is a `.blueprint` with `padding:2px 12px 6px` and corner marks;
 *   • header 11px uppercase 60% ink with a 1px bottom rule, row rule 8% ink,
 *     hover 4% ink, selected `--color-accent-100` — all of that lives in the
 *     `.table` class in globals.css, so these components only place elements;
 *   • numeric columns are right-aligned (`align="right"`);
 *   • the last column is a right-aligned group of 28px icon buttons
 *     (`<RowActions>`);
 *   • wide column sets (suppliers: 1180px) scroll horizontally inside the
 *     frame.
 *
 * This is deliberately a set of thin, composable elements rather than a
 * generic `DataTable`: the four approved tables (Reports, Suppliers,
 * Certificates, Templates) each have bespoke cells — completion bars, avatar
 * initials, stacked contact lines, double badges — that a column-config API
 * would only get in the way of.
 */

type Align = "left" | "right";

/* ─────────────────────────────────────────────────────────────────────────
   Frame
   ───────────────────────────────────────────────────────────────────────── */

interface TableFrameOwnProps {
  /**
   * Minimum width of the table inside the frame, in px (suppliers: 1180).
   * Published as `--table-min-width` and picked up by `<Table>`; setting it
   * also turns `scroll` on. Equivalent to `<TableFrame scroll>` around a
   * `<Table minWidth={…}>` — use whichever reads better at the call site.
   */
  minWidth?: number;
  /** Scroll the column set horizontally instead of squeezing it (README §19). */
  scroll?: boolean;
  className?: string;
  children?: ReactNode;
}

export type TableFrameProps = TableFrameOwnProps &
  Omit<ComponentPropsWithoutRef<"div">, keyof TableFrameOwnProps>;

/** `style` plus the custom property `<Table>` reads its `min-width` from. */
type FrameStyle = CSSProperties & Record<"--table-min-width", string>;

/**
 * The `.blueprint` container every table sits in.
 *
 * The scroll lives on an inner block, not on the frame itself: the four
 * registration marks are absolutely positioned 6px outside the border box and
 * an `overflow-x:auto` frame would clip them, which the approved suppliers
 * screenshot shows intact.
 */
export function TableFrame({
  minWidth,
  scroll,
  className,
  children,
  style,
  ...rest
}: TableFrameProps) {
  const scrolls = scroll ?? minWidth !== undefined;
  const frameStyle: FrameStyle | CSSProperties | undefined =
    minWidth === undefined
      ? style
      : { ...style, "--table-min-width": `${minWidth}px` };
  return (
    <Blueprint
      className={cn("px-[12px] pt-[2px] pb-[6px]", className)}
      style={frameStyle}
      {...rest}
    >
      <div className={scrolls ? "overflow-x-auto" : undefined}>{children}</div>
    </Blueprint>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Table
   ───────────────────────────────────────────────────────────────────────── */

interface TableOwnProps {
  /** Minimum width in px for a wide column set; the frame then scrolls. */
  minWidth?: number;
  className?: string;
  children?: ReactNode;
}

export type TableProps = TableOwnProps &
  Omit<ComponentPropsWithoutRef<"table">, keyof TableOwnProps>;

export function Table({
  minWidth,
  className,
  children,
  style,
  ...rest
}: TableProps) {
  return (
    <table
      className={cn("table", className)}
      style={{
        minWidth: minWidth ?? "var(--table-min-width, 0)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </table>
  );
}

export function Thead({
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<"thead">) {
  return (
    <thead className={className} {...rest}>
      {children}
    </thead>
  );
}

export function Tbody({
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<"tbody">) {
  return (
    <tbody className={className} {...rest}>
      {children}
    </tbody>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Rows and cells
   ───────────────────────────────────────────────────────────────────────── */

/** Anything inside a row that owns its own activation. */
const INTERACTIVE =
  "a,button,input,select,textarea,label,summary,[role='button'],[role='link'],[contenteditable='true']";

interface TrOwnProps {
  /** README §5 — selected rows fill with `--color-accent-100`. */
  selected?: boolean;
  /** Show the pointer cursor; pair it with `onClick`. */
  clickable?: boolean;
  className?: string;
  children?: ReactNode;
}

export type TrProps = TrOwnProps &
  Omit<ComponentPropsWithoutRef<"tr">, keyof TrOwnProps>;

/**
 * A table row.
 *
 * `onClick` is a **mouse convenience only**. The row is never given
 * `role="button"` or a tabindex — a focusable `<tr>` wrapping focusable cells
 * produces a duplicated, unreadable tab order and lies to assistive tech about
 * what the row is. The real affordance must live in the row's first cell (the
 * document-number button on Reports, the company button on Suppliers), which
 * is what keeps the row keyboard-operable and announced correctly; the row
 * click simply widens the hit area for pointer users.
 *
 * Clicks that originate inside a control in the row (the action buttons, a
 * checkbox, a link) do not bubble up into `onClick`, so the row never
 * double-fires with the control it contains.
 */
export function Tr({
  selected,
  clickable,
  className,
  children,
  onClick,
  ...rest
}: TrProps) {
  function handleClick(event: MouseEvent<HTMLTableRowElement>) {
    if (!onClick) return;
    const target = event.target;
    if (target instanceof Element && target.closest(INTERACTIVE)) return;
    onClick(event);
  }

  return (
    <tr
      data-selected={selected ? "true" : undefined}
      className={cn(clickable && "cursor-pointer", className)}
      onClick={onClick ? handleClick : undefined}
      {...rest}
    >
      {children}
    </tr>
  );
}

interface ThOwnProps {
  /** `right` for numeric columns and the action column (README §19). */
  align?: Align;
  /** Fixed column width in px — completion 104, report actions 126, supplier actions 96. */
  width?: number | string;
  className?: string;
  children?: ReactNode;
}

export type ThProps = ThOwnProps &
  Omit<ComponentPropsWithoutRef<"th">, keyof ThOwnProps>;

export function Th({
  align = "left",
  width,
  className,
  children,
  style,
  scope = "col",
  ...rest
}: ThProps) {
  return (
    <th
      scope={scope}
      className={className}
      style={{
        ...(align === "right" ? { textAlign: "right" as const } : null),
        ...(width === undefined ? null : { width }),
        ...style,
      }}
      {...rest}
    >
      {children}
    </th>
  );
}

interface TdOwnProps {
  /** `right` for numeric columns (README §3.1). */
  align?: Align;
  /** Dates, document numbers and counts never wrap. */
  nowrap?: boolean;
  /** Secondary cells — `--color-neutral-600` (last edit, meta lines). */
  muted?: boolean;
  className?: string;
  children?: ReactNode;
}

export type TdProps = TdOwnProps &
  Omit<ComponentPropsWithoutRef<"td">, keyof TdOwnProps>;

export function Td({
  align = "left",
  nowrap = false,
  muted = false,
  className,
  children,
  style,
  ...rest
}: TdProps) {
  return (
    <td
      className={cn(
        nowrap && "whitespace-nowrap",
        muted && "text-neutral-600",
        className,
      )}
      style={align === "right" ? { textAlign: "right", ...style } : style}
      {...rest}
    >
      {children}
    </td>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Action column
   ───────────────────────────────────────────────────────────────────────── */

interface RowActionsOwnProps {
  className?: string;
  children?: ReactNode;
}

export type RowActionsProps = RowActionsOwnProps &
  Omit<ComponentPropsWithoutRef<"div">, keyof RowActionsOwnProps>;

/**
 * The right-aligned action group that closes every row — a run of 28px
 * `<IconButton>`s, 2px apart (README §19, §4 "Icon button").
 */
export function RowActions({ className, children, ...rest }: RowActionsProps) {
  return (
    <div className={cn("flex justify-end gap-[2px]", className)} {...rest}>
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Loading
   ───────────────────────────────────────────────────────────────────────── */

/** Deterministic (SSR-safe) cell widths — a flat grid reads as a bug. */
const SKELETON_WIDTHS = ["78%", "54%", "88%", "62%", "46%", "70%", "58%", "84%"];

export interface TableSkeletonProps {
  /** README §23 — 6–8 rows. */
  rows?: number;
  columns: number;
  /** The real row height: 38px dense, 44px default. */
  rowHeight?: number;
  className?: string;
}

/**
 * A `<tbody>` of skeleton rows at the real row height (README §23: "6–8
 * skeleton rows", never a spinner). Drop it in place of `<Tbody>` while the
 * page is loading, keeping the real `<Thead>` above it.
 */
export function TableSkeleton({
  rows = 7,
  columns,
  rowHeight = 38,
  className,
}: TableSkeletonProps) {
  return (
    <tbody aria-hidden="true" className={className}>
      {Array.from({ length: rows }, (_, row) => (
        <tr key={row} style={{ height: rowHeight }}>
          {Array.from({ length: columns }, (_, column) => (
            <td key={column}>
              <div
                className="skeleton h-[11px]"
                style={{
                  width:
                    SKELETON_WIDTHS[
                      (row * 3 + column * 5) % SKELETON_WIDTHS.length
                    ],
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
