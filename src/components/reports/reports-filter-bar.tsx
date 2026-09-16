"use client";

import type { CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { FilterBar } from "@/components/ui/filter-bar";
import { SearchField } from "@/components/ui/search-field";
import { useToast } from "@/components/ui/toast";
import {
  REPORT_STATUSES,
  REPORT_STATUS_LABELS,
  type ReportStatus,
} from "@/types/domain";

/**
 * Reports filter bar — README §1.3, §19. Prototype lines 286..302.
 *
 * `.blueprint` row: a 220px search followed by the seven approved filters in
 * order — Supplier · Status · Employee · Period · Year · Country · Product
 * Category — with a "Saved views" ghost control on the line below (screenshot
 * 02: the control wraps out of the select row and sits left-aligned inside the
 * same frame).
 *
 * README §25 asks for no advanced filtering logic yet "unless trivial", so
 * Phase 1 wires the two filters that are trivial against the seeded rows — the
 * search box and Status. The other five selects carry the approved label as
 * their single option, exactly as the prototype renders them, and change
 * nothing: offering options that did not filter would be a lie about what the
 * control does. They start filtering when the Supabase queries land.
 */

/** `all` is the resting option — the select shows its own label, "Status". */
export type ReportStatusFilter = ReportStatus | "all";

/**
 * Prototype line 292 — the reports bar sizes its selects at `min-width:112px`,
 * 12px tighter than the five-select suppliers bar the kit's `filter` variant is
 * measured from (line 373). The seven controls only share one line at the
 * approved width at 112.
 */
const FILTER_WIDTH: CSSProperties = { minWidth: 112 };

/** The five inert filters that follow Status, in prototype order. */
const INERT_AFTER_STATUS = [
  "Employee",
  "Period",
  "Year",
  "Country",
  "Product Category",
] as const;

/**
 * A filter select that renders but does not filter. The approved bar carries no
 * visible `<label>`, so the control is named for assistive tech (README §24)
 * and the option text is the label the screenshot shows.
 */
function InertFilter({ label }: { label: string }) {
  return (
    <Select
      filter
      style={FILTER_WIDTH}
      aria-label={`Filter by ${label.toLowerCase()}`}
    >
      <option>{label}</option>
    </Select>
  );
}

export interface ReportsFilterBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  status: ReportStatusFilter;
  onStatusChange: (value: ReportStatusFilter) => void;
}

export function ReportsFilterBar({
  query,
  onQueryChange,
  status,
  onStatusChange,
}: ReportsFilterBarProps) {
  const { toast } = useToast();

  return (
    <FilterBar>
      <SearchField
        variant="page"
        placeholder="Search reports…"
        aria-label="Search reports"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />

      <InertFilter label="Supplier" />

      <Select
        filter
        style={FILTER_WIDTH}
        aria-label="Filter by status"
        value={status}
        onChange={(event) =>
          onStatusChange(event.target.value as ReportStatusFilter)
        }
      >
        <option value="all">Status</option>
        {REPORT_STATUSES.map((value) => (
          <option key={value} value={value}>
            {REPORT_STATUS_LABELS[value]}
          </option>
        ))}
      </Select>

      {INERT_AFTER_STATUS.map((label) => (
        <InertFilter key={label} label={label} />
      ))}

      {/* Prototype line 297 — a `flex:1` spacer, not a full-width break. It
          absorbs the slack on the select line so "Saved views" sits at the end
          of the row when there is room and wraps beneath it when there is not,
          which is what the approved capture shows at its wider capture width. */}
      <div style={{ flex: 1 }} aria-hidden="true" />
      <div>
        <Button
          variant="ghost"
          size="compact"
          icon="filter"
          onClick={() =>
            toast("Saved views arrive with report persistence (Phase 2)")
          }
        >
          Saved views
        </Button>
      </div>
    </FilterBar>
  );
}
