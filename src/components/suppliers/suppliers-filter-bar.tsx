"use client";

import { useMemo } from "react";

import { Select } from "@/components/ui/field";
import { FilterBar } from "@/components/ui/filter-bar";
import { SearchField } from "@/components/ui/search-field";
import { COUNTRY_OPTIONS, withCurrentValue } from "@/lib/suppliers/supplier-schema";
import {
  DATA_SHEET_LABELS,
  DATA_SHEET_STATES,
  SUPPLIER_STATUSES,
  SUPPLIER_STATUS_LABELS,
  type Supplier,
} from "@/types/domain";

import {
  certificationTokens,
  type SupplierFilters,
} from "./supplier-list-filters";

/**
 * Suppliers filter bar — README §1.6, §4 "Filter"; prototype lines 366..375.
 *
 * A `page` search field followed by the five approved selects: Country,
 * Region / Province, Status, Certification, Data sheet. The first option of
 * each select is the filter's own name and doubles as its "all" value, which
 * is what README §4 means by "active filter shows its value as the select
 * label" — the control is always self-describing, so no separate visible label
 * is added (that would change the approved row); the accessible name comes from
 * `aria-label`.
 *
 * Which filter is answered where is `supplier-list-filters.ts`; this component
 * only reports what the user picked.
 */

export interface SuppliersFilterBarProps {
  /**
   * The rows the query returned. Region and Certification are refinements over
   * exactly these records, so their options are derived from them and the bar
   * never offers a value that would return nothing.
   */
  suppliers: readonly Supplier[];
  filters: SupplierFilters;
  /** Receives only the changed keys. */
  onChange: (patch: Partial<SupplierFilters>) => void;
}

function uniqueSorted(values: readonly (string | null)[]): string[] {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value))),
  ).sort((a, b) => a.localeCompare(b, "en"));
}

export function SuppliersFilterBar({
  suppliers,
  filters,
  onChange,
}: SuppliersFilterBarProps) {
  const regions = useMemo(
    () => uniqueSorted(suppliers.map((supplier) => supplier.region)),
    [suppliers],
  );
  const certifications = useMemo(
    () =>
      uniqueSorted(
        suppliers.flatMap((supplier) =>
          certificationTokens(supplier.certifications),
        ),
      ),
    [suppliers],
  );

  // Country filters the query, so its options cannot come from the rows on
  // screen — picking "China" would leave China as the only country left to
  // pick. The approved vocabulary of the supplier form is used instead, plus
  // whatever country is currently selected.
  const countries = withCurrentValue(COUNTRY_OPTIONS, filters.country);

  return (
    <FilterBar>
      <SearchField
        variant="page"
        placeholder="Search supplier…"
        value={filters.query}
        onChange={(event) => onChange({ query: event.target.value })}
      />

      <Select
        filter
        aria-label="Filter by country"
        value={filters.country}
        onChange={(event) => onChange({ country: event.target.value })}
      >
        <option value="">Country</option>
        {countries.map((country) => (
          <option key={country} value={country}>
            {country}
          </option>
        ))}
      </Select>

      <Select
        filter
        aria-label="Filter by region or province"
        value={filters.region}
        onChange={(event) => onChange({ region: event.target.value })}
      >
        <option value="">Region / Province</option>
        {regions.map((region) => (
          <option key={region} value={region}>
            {region}
          </option>
        ))}
      </Select>

      <Select
        filter
        aria-label="Filter by status"
        value={filters.status}
        onChange={(event) => onChange({ status: event.target.value })}
      >
        <option value="">Status</option>
        {SUPPLIER_STATUSES.map((status) => (
          <option key={status} value={status}>
            {SUPPLIER_STATUS_LABELS[status]}
          </option>
        ))}
      </Select>

      <Select
        filter
        aria-label="Filter by certification"
        value={filters.certification}
        onChange={(event) => onChange({ certification: event.target.value })}
      >
        <option value="">Certification</option>
        {certifications.map((certification) => (
          <option key={certification} value={certification}>
            {certification}
          </option>
        ))}
      </Select>

      <Select
        filter
        aria-label="Filter by data sheet state"
        value={filters.dataSheet}
        onChange={(event) => onChange({ dataSheet: event.target.value })}
      >
        <option value="">Data sheet</option>
        {DATA_SHEET_STATES.map((state) => (
          <option key={state} value={state}>
            {DATA_SHEET_LABELS[state]}
          </option>
        ))}
      </Select>
    </FilterBar>
  );
}
