"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";
import { Blueprint } from "./blueprint";
import { Button } from "./button";

/**
 * Empty, error and loading states — README §21, §22, §23.
 *
 * The copy in §21 is approved verbatim; screens read it from
 * `EMPTY_STATE_COPY` instead of retyping it.
 */

/* ═══════════════════════════════════════════════════════════════════════════
   Empty states — README §21
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The nine approved empty-state situations. Copy is exact — short, factual,
 * with the next action named in the sentence. Do not paraphrase.
 */
export const EMPTY_STATE_COPY = Object.freeze({
  noSuppliers: "No suppliers yet — import a data sheet or add the first supplier.",
  noReports: "No visit reports yet. A report starts from a supplier and a visit date.",
  noImages:
    "No images in this section yet — drop photos here or upload from Visit Mode.",
  noTranscript:
    "No transcript attached. Upload a Plaud recording to enable AI extraction.",
  noCertificates:
    "Declared in the supplier data sheet — no certificate copies collected yet; they are photographed and read during the first visit.",
  noFindings: "No findings yet — run Analyze Transcript to extract observations.",
  noTemplate: "No Word template uploaded. Export needs the corporate template.",
  noSupplierFiles:
    "No documents uploaded for this supplier yet — presentations, catalogues and licences are collected before the first visit.",
  noSupplierVisits:
    "No visits recorded — this supplier is in the database from its data sheet only.",
} as const);

export type EmptyStateSituation = keyof typeof EMPTY_STATE_COPY;

/** `inline` sits inside a panel or tab; `page` owns the whole content area. */
export type StateVariant = "inline" | "page";

export interface EmptyStateProps {
  /** Usually `EMPTY_STATE_COPY.<situation>`; accepts nodes for inline emphasis. */
  message: ReactNode;
  /** One or two buttons — the next action named in the copy. */
  action?: ReactNode;
  variant?: StateVariant;
  className?: string;
}

export function EmptyState({
  message,
  action,
  variant = "inline",
  className,
}: EmptyStateProps) {
  const page = variant === "page";
  return (
    <div
      className={className}
      style={{
        border: "1px dashed var(--color-neutral-400)",
        padding: page ? 26 : action ? "13px 14px" : 14,
        display: page ? "block" : "flex",
        alignItems: page ? undefined : "center",
        gap: page ? undefined : 12,
        textAlign: page ? "center" : undefined,
      }}
    >
      <p
        style={{
          margin: 0,
          flex: page ? undefined : 1,
          fontSize: 12.5,
          color: "var(--color-neutral-700)",
        }}
      >
        {message}
      </p>
      {action ? (
        <div
          className="flex"
          style={{
            flex: "none",
            gap: 8,
            marginTop: page ? 12 : undefined,
            justifyContent: page ? "center" : undefined,
          }}
        >
          {action}
        </div>
      ) : null}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Error states — README §22
   ═══════════════════════════════════════════════════════════════════════════ */

export interface ErrorStateProps {
  /** Say what happened to the user's data and offer the retry (README §22). */
  message: ReactNode;
  onRetry?: () => void;
  variant?: StateVariant;
  className?: string;
}

export function ErrorState({
  message,
  onRetry,
  variant = "inline",
  className,
}: ErrorStateProps) {
  const page = variant === "page";
  return (
    <div
      role="alert"
      className={className}
      style={{
        border: "1px solid var(--color-danger-border)",
        background: "var(--color-danger-bg)",
        padding: page ? 26 : "13px 14px",
        display: page ? "block" : "flex",
        alignItems: page ? undefined : "center",
        gap: page ? undefined : 12,
        textAlign: page ? "center" : undefined,
      }}
    >
      <p
        style={{
          margin: 0,
          flex: page ? undefined : 1,
          fontSize: 12.5,
          color: "var(--color-danger-ink)",
        }}
      >
        {message}
      </p>
      {onRetry ? (
        <div
          className="flex"
          style={{
            flex: "none",
            marginTop: page ? 12 : undefined,
            justifyContent: page ? "center" : undefined,
          }}
        >
          <Button
            variant="secondary"
            size="compact"
            icon="refresh"
            onClick={onRetry}
            style={{ background: "var(--color-bg)" }}
          >
            Retry
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Loading states — README §23. Skeletons, never a page spinner.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  className?: string;
}

/** A single skeleton block at the real element's size. */
export function Skeleton({ width = "100%", height = 12, className }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("skeleton block", className)}
      style={{ width, height }}
    />
  );
}

export interface SkeletonTextProps {
  /** Number of stacked lines. */
  lines: number;
  /** Fixed width for every line; otherwise the last line is short. */
  width?: number | string;
  className?: string;
}

export function SkeletonText({ lines, width, className }: SkeletonTextProps) {
  return (
    <div className={cn("flex flex-col", className)} style={{ gap: 8 }}>
      {Array.from({ length: Math.max(0, lines) }, (_, i) => (
        <Skeleton
          key={i}
          height={12}
          width={width ?? (i === lines - 1 ? "68%" : "100%")}
        />
      ))}
    </div>
  );
}

/** Column weights of the widest approved table (reports, §19). */
const TABLE_COLUMNS = [1.5, 1.7, 1, 1, 0.8, 1, 1, 0.7];
const TABLE_ROWS = 7;

function TableSkeleton() {
  return (
    <Blueprint style={{ padding: "2px 12px 6px" }}>
      <div
        className="flex items-center"
        style={{
          gap: 16,
          height: 30,
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        {TABLE_COLUMNS.map((weight, i) => (
          <div key={i} style={{ flex: weight, minWidth: 0 }}>
            <Skeleton height={8} width="62%" />
          </div>
        ))}
      </div>
      {Array.from({ length: TABLE_ROWS }, (_, row) => (
        <div
          key={row}
          className="flex items-center"
          style={{
            gap: 16,
            height: 38,
            borderBottom:
              row === TABLE_ROWS - 1 ? undefined : "1px solid var(--rule-row)",
          }}
        >
          {TABLE_COLUMNS.map((weight, i) => (
            <div key={i} style={{ flex: weight, minWidth: 0 }}>
              <Skeleton height={10} width="84%" />
            </div>
          ))}
        </div>
      ))}
    </Blueprint>
  );
}

function PageSkeleton() {
  return (
    <div style={{ padding: "26px 24px 40px" }}>
      <div className="flex items-end" style={{ gap: 16, marginBottom: 22 }}>
        <div className="flex flex-col" style={{ flex: 1, gap: 7 }}>
          <Skeleton width={190} height={8} />
          <Skeleton width={220} height={26} />
          <Skeleton width={330} height={10} />
        </div>
        <Skeleton width={124} height={36} className="flex-none" />
        <Skeleton width={152} height={36} className="flex-none" />
      </div>

      <div
        className="grid"
        style={{
          gridTemplateColumns: "repeat(6,minmax(0,1fr))",
          gap: 14,
          marginBottom: 26,
        }}
      >
        {Array.from({ length: 6 }, (_, i) => (
          <Blueprint
            key={i}
            className="flex flex-col"
            style={{ padding: "14px 14px 12px", gap: 9 }}
          >
            <Skeleton width="62%" height={8} />
            <Skeleton width="44%" height={24} />
            <Skeleton width="80%" height={9} />
          </Blueprint>
        ))}
      </div>

      <TableSkeleton />
    </div>
  );
}

export interface LoadingStateProps {
  /** `page` = header + 6 KPI boxes + rows · `table` = rows only · `inline` = lines. */
  variant: "page" | "table" | "inline";
  className?: string;
}

export function LoadingState({ variant, className }: LoadingStateProps) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">Loading…</span>
      {variant === "page" ? (
        <PageSkeleton />
      ) : variant === "table" ? (
        <TableSkeleton />
      ) : (
        <SkeletonText lines={3} />
      )}
    </div>
  );
}
