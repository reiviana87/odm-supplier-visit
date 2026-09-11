import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";
import {
  CERTIFICATE_STATUS_LABELS,
  DATA_SHEET_LABELS,
  REPORT_STATUS_LABELS,
  SUPPLIER_STATUS_LABELS,
  type CertificateStatus,
  type DataSheetState,
  type ReportStatus,
  type SupplierStatus,
} from "@/types/domain";

/**
 * Tag — README §3.2 / §4. 11px, padding 3px 10px, square.
 *
 * The colour pairs below are the approved ones and their contrast ratios are
 * recorded in the handoff; do not invent new pairs.
 */
export type TagTone =
  | "accent"
  | "neutral"
  | "neutral-soft"
  | "warning"
  | "danger"
  | "outline"
  | "outline-accent";

const TONE_CLASS: Record<TagTone, string> = {
  accent: "tag-accent",
  neutral: "tag-neutral",
  "neutral-soft": "tag-neutral-soft",
  warning: "tag-warning",
  danger: "tag-danger",
  outline: "tag-outline",
  "outline-accent": "tag-outline-accent",
};

export function Tag({
  tone = "neutral",
  className,
  style,
  children,
}: {
  tone?: TagTone;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <span className={cn("tag", TONE_CLASS[tone], className)} style={style}>
      {children}
    </span>
  );
}

/** README §3.2 — Draft / In Review / Final / Archived. */
const REPORT_STATUS_TONE: Record<ReportStatus, TagTone> = {
  draft: "neutral",
  in_review: "warning",
  final: "accent",
  archived: "outline",
};

export function ReportStatusBadge({
  status,
  className,
}: {
  status: ReportStatus;
  className?: string;
}) {
  return (
    <Tag tone={REPORT_STATUS_TONE[status]} className={className}>
      {REPORT_STATUS_LABELS[status]}
    </Tag>
  );
}

/** README §3.2 — Approved / Under Qualification / On Hold / Prospect. */
const SUPPLIER_STATUS_TONE: Record<SupplierStatus, TagTone> = {
  approved: "accent",
  under_qualification: "warning",
  on_hold: "neutral-soft",
  prospect: "neutral-soft",
};

export function SupplierStatusBadge({
  status,
  className,
}: {
  status: SupplierStatus;
  className?: string;
}) {
  return (
    <Tag tone={SUPPLIER_STATUS_TONE[status]} className={className}>
      {SUPPLIER_STATUS_LABELS[status]}
    </Tag>
  );
}

/** README §1.6 — Data sheet / Partial / Excel pending. */
const DATA_SHEET_TONE: Record<DataSheetState, TagTone> = {
  received: "accent",
  partial: "neutral-soft",
  pending: "warning",
};

export function DataSheetBadge({
  state,
  className,
}: {
  state: DataSheetState;
  className?: string;
}) {
  return (
    <Tag tone={DATA_SHEET_TONE[state]} className={className}>
      {DATA_SHEET_LABELS[state]}
    </Tag>
  );
}

/** README §3.2 — Valid / Not evidenced / Declared. */
const CERTIFICATE_STATUS_TONE: Record<CertificateStatus, TagTone> = {
  valid: "accent",
  not_evidenced: "danger",
  declared: "neutral-soft",
  expired: "danger",
};

export function CertificateStatusBadge({
  status,
  className,
}: {
  status: CertificateStatus;
  className?: string;
}) {
  return (
    <Tag tone={CERTIFICATE_STATUS_TONE[status]} className={className}>
      {CERTIFICATE_STATUS_LABELS[status]}
    </Tag>
  );
}
