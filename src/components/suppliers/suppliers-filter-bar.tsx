"use client";

import { useMemo } from "react";

import { Select } from "@/components/ui/field";
import { FilterBar } from "@/components/ui/filter-bar";
import { SearchField } from "@/components/ui/search-field";
import {
  DATA_SHEET_LABELS,
  DATA_SHEET_STATES,
  SUPPLIER_STATUSES,
  SUPPLIER_STATUS_LABELS,
  type Supplier,
} from "@/types/domain";

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
 * The option sets are derived from the records actually present, so the bar
 * never offers a filter that returns nothing.
 */

export interface SupplierFilters {
  /** Free text over name, legal name, location and sales contact. */
  query: string;
  /** Exact `country` match; "" = no filter. */
  country: string;
  /** Exact `region` match as recorded on the data sheet; "" = no filter. */
  region: string;
  /** `SupplierStatus` value; "" = no filter. */
  status: string;
  /** One certification token, matched against the declared list; "" = no filter. */
  certification: string;
  /** `DataSheetState` value; "" = no filter. */
  dataSheet: string;
}

export const EMPTY_SUPPLIER_FILTERS: SupplierFilters = {
  query: "",
  country: "",
  region: "",
  status: "",
  certification: "",
  dataSheet: "",
};

export function isFilterActive(filters: SupplierFilters): boolean {
  return Object.values(filters).some((value) => value !== "");
}

/** "ISO9001, ISO14001, CE" → ["ISO9001", "ISO14001", "CE"]. */
function certificationTokens(certifications: string | null): string[] {
  if (!certifications) return [];
  return certifications
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function searchHaystack(supplier: Supplier): string {
  return [
    supplier.shortName,
    supplier.legalName,
    supplier.city,
    supplier.region,
    supplier.country,
    supplier.contactName,
    supplier.contactEmail,
    supplier.certifications,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
}

export function supplierMatchesFilters(
  supplier: Supplier,
  filters: SupplierFilters,
): boolean {
  const query = filters.query.trim().toLowerCase();
  if (query.length > 0 && !searchHaystack(supplier).includes(query)) return false;
  if (filters.country !== "" && supplier.country !== filters.country) return false;
  if (filters.region !== "" && supplier.region !== filters.region) return false;
  if (filters.status !== "" && supplier.status !== filters.status) return false;
  if (filters.dataSheet !== "" && supplier.dataSheetState !== filters.dataSheet) {
    return false;
  }
  if (
    filters.certification !== "" &&
    !certificationTokens(supplier.certifications).includes(filters.certification)
  ) {
    return false;
  }
  return true;
}

function uniqueSorted(values: readonly (string | null)[]): string[] {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value))),
  ).sort((a, b) => a.localeCompare(b, "en"));
}

export interface SuppliersFilterBarProps {
  /** The full record set — the option lists are derived from it. */
  suppliers: readonly Supplier[];
  filters: SupplierFilters;
  /** Receives only the changed keys. */
  onChange: (patch: Partial<SupplierFilters>) => void;
}

export function SuppliersFilterBar({
  suppliers,
  filters,
  onChange,
}: SuppliersFilterBarProps) {
  const countries = useMemo(
    () => uniqueSorted(suppliers.map((supplier) => supplier.country)),
    [suppliers],
  );
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
