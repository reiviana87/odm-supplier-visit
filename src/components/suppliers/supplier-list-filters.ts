/**
 * The supplier list's filter contract — README §1.6 / §8.2.
 *
 * The bar draws six controls. Four of them are questions the database can
 * answer, so Phase 2 puts those in the URL and hands them to `listSuppliers()`:
 * a filtered list is then a real address that survives a reload and can be sent
 * to a colleague. The other two — Region / Province and Certification — have no
 * `ListSuppliersOptions` equivalent (region is free text on the data sheet and
 * `certifications` is one comma-separated string, not a column of tokens), so
 * they refine the rows the query returned, in the browser, as they did before.
 *
 * Deliberately not a `"use client"` module: the page calls
 * `queryFiltersFromSearchParams()` on the server and the filter bar imports the
 * same constants on the client, which a client module's exports could not do.
 */

import type { ListSuppliersOptions } from "@/lib/data/suppliers";
import {
  DATA_SHEET_STATES,
  SUPPLIER_STATUSES,
  type DataSheetState,
  type Supplier,
  type SupplierStatus,
} from "@/types/domain";

/** What the query answers. Mirrored in the URL, one key each. */
export interface SupplierQueryFilters {
  /** Matches short name, legal name, Chinese name, supplier code and city. */
  query: string;
  country: string;
  /** A `SupplierStatus` value; "" = no filter. */
  status: string;
  /** A `DataSheetState` value; "" = no filter. */
  dataSheet: string;
}

/** What the browser answers, over the rows the query returned. */
export interface SupplierLocalFilters {
  /** Exact `region` match as recorded on the data sheet; "" = no filter. */
  region: string;
  /** One certification token, matched against the declared list; "" = no filter. */
  certification: string;
}

export type SupplierFilters = SupplierQueryFilters & SupplierLocalFilters;

export const EMPTY_QUERY_FILTERS: SupplierQueryFilters = {
  query: "",
  country: "",
  status: "",
  dataSheet: "",
};

export const EMPTY_LOCAL_FILTERS: SupplierLocalFilters = {
  region: "",
  certification: "",
};

/** The URL keys, short enough to read in the address bar. */
const PARAM = {
  query: "q",
  country: "country",
  status: "status",
  dataSheet: "sheet",
} as const;

type SearchParamValue = string | string[] | undefined;

/** A repeated key (`?status=a&status=b`) is one filter, so the first wins. */
function single(value: SearchParamValue): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() ?? "";
}

/**
 * The filters as the address bar states them.
 *
 * A value outside the enum is dropped rather than passed on: a hand-typed
 * `?status=nonsense` then lists every supplier instead of asking PostgREST a
 * question it will refuse.
 */
export function queryFiltersFromSearchParams(
  params: Record<string, SearchParamValue>,
): SupplierQueryFilters {
  const status = single(params[PARAM.status]);
  const dataSheet = single(params[PARAM.dataSheet]);

  return {
    query: single(params[PARAM.query]),
    country: single(params[PARAM.country]),
    status: isSupplierStatus(status) ? status : "",
    dataSheet: isDataSheetState(dataSheet) ? dataSheet : "",
  };
}

function isSupplierStatus(value: string): value is SupplierStatus {
  return (SUPPLIER_STATUSES as readonly string[]).includes(value);
}

function isDataSheetState(value: string): value is DataSheetState {
  return (DATA_SHEET_STATES as readonly string[]).includes(value);
}

/** The filters as `listSuppliers()` takes them. Empty strings are no filter. */
export function toListOptions(filters: SupplierQueryFilters): ListSuppliersOptions {
  return {
    ...(filters.query !== "" ? { query: filters.query } : {}),
    ...(filters.country !== "" ? { country: filters.country } : {}),
    ...(isSupplierStatus(filters.status) ? { status: filters.status } : {}),
    ...(isDataSheetState(filters.dataSheet) ? { dataSheetState: filters.dataSheet } : {}),
  };
}

/** `/suppliers` with the active filters — the address the bar navigates to. */
export function suppliersHref(filters: SupplierQueryFilters): string {
  const params = new URLSearchParams();
  for (const [key, param] of Object.entries(PARAM)) {
    const value = filters[key as keyof SupplierQueryFilters];
    if (value !== "") params.set(param, value);
  }

  const search = params.toString();
  return search === "" ? "/suppliers" : `/suppliers?${search}`;
}

export function hasQueryFilter(filters: SupplierQueryFilters): boolean {
  return Object.values(filters).some((value) => value !== "");
}

export function hasLocalFilter(filters: SupplierLocalFilters): boolean {
  return Object.values(filters).some((value) => value !== "");
}

/** "ISO9001, ISO14001, CE" → ["ISO9001", "ISO14001", "CE"]. */
export function certificationTokens(certifications: string | null): string[] {
  if (!certifications) return [];
  return certifications
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

export function matchesLocalFilters(
  supplier: Supplier,
  filters: SupplierLocalFilters,
): boolean {
  if (filters.region !== "" && supplier.region !== filters.region) return false;
  if (
    filters.certification !== "" &&
    !certificationTokens(supplier.certifications).includes(filters.certification)
  ) {
    return false;
  }
  return true;
}
