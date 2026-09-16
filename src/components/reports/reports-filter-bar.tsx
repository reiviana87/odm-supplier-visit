"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";

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
 * The two filters that are wired write themselves into the URL rather than into
 * local state: the page is a Server Component and `listReports` does the
 * filtering, so the address bar is what decides which rows exist. The other
 * five selects carry the approved label as their single option, exactly as the
 * prototype renders them, and change nothing — offering options that did not
 * filter would be a lie about what the control does. They start filtering when
 * the list query learns to express them.
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
 * Long enough that a typed word is one query rather than five, short enough
 * that the list still feels like it is following the keystrokes.
 */
const SEARCH_DEBOUNCE_MS = 300;

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
  /** The search term the rows on screen were read with. */
  query: string;
  status: ReportStatusFilter;
}

/** `/reports?q=…&status=…`, with the resting values left out entirely. */
function urlFor(pathname: string, query: string, status: ReportStatusFilter): string {
  const params = new URLSearchParams();
  const term = query.trim();
  if (term !== "") params.set("q", term);
  if (status !== "all") params.set("status", status);

  const search = params.toString();
  return search === "" ? pathname : `${pathname}?${search}`;
}

export function ReportsFilterBar({ query, status }: ReportsFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  // The input is typed into far faster than the round trip answers, so it holds
  // its own value and the URL follows it. It is seeded from the server's answer
  // and not re-synced: the prop only changes because this component pushed it.
  const [term, setTerm] = useState(query);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (debounce.current !== null) clearTimeout(debounce.current);
    },
    [],
  );

  function search(next: string) {
    setTerm(next);
    if (debounce.current !== null) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      debounce.current = null;
      // `replace`, not `push`: a search is a narrowing of the same screen, and
      // one history entry per keystroke would make Back unusable.
      router.replace(urlFor(pathname, next, status), { scroll: false });
    }, SEARCH_DEBOUNCE_MS);
  }

  function filterByStatus(next: ReportStatusFilter) {
    if (debounce.current !== null) {
      clearTimeout(debounce.current);
      debounce.current = null;
    }
    router.replace(urlFor(pathname, term, next), { scroll: false });
  }

  return (
    <FilterBar>
      <SearchField
        variant="page"
        placeholder="Search reports…"
        aria-label="Search reports"
        value={term}
        onChange={(event) => search(event.target.value)}
      />

      <InertFilter label="Supplier" />

      <Select
        filter
        style={FILTER_WIDTH}
        aria-label="Filter by status"
        value={status}
        onChange={(event) =>
          filterByStatus(event.target.value as ReportStatusFilter)
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
            toast(
              "Saved views are not built — the search box and Status are in the address bar, so a filtered list can be bookmarked and shared as it is.",
            )
          }
        >
          Saved views
        </Button>
      </div>
    </FilterBar>
  );
}
