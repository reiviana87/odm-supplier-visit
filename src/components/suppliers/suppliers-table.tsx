"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from "react";

import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { DataSheetBadge, SupplierStatusBadge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { EMPTY_STATE_COPY, EmptyState } from "@/components/ui/states";
import {
  RowActions,
  Table,
  TableFrame,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { SUPPLIER_STATUS_LABELS, type Supplier } from "@/types/domain";

import { supplierInitials } from "@/lib/suppliers/display";
import {
  EMPTY_LOCAL_FILTERS,
  EMPTY_QUERY_FILTERS,
  hasLocalFilter,
  hasQueryFilter,
  matchesLocalFilters,
  suppliersHref,
  type SupplierFilters,
  type SupplierLocalFilters,
  type SupplierQueryFilters,
} from "./supplier-list-filters";
import { SuppliersFilterBar } from "./suppliers-filter-bar";

/**
 * Suppliers list — README §1.6, §8.2, §19; prototype lines 366..419.
 *
 * The whole client surface of the screen: the filter bar, the sortable table
 * inside its 1180px-wide scrolling `.blueprint` frame, and the empty state.
 * The rows arrive filtered and ordered from `listSuppliers()`; this component
 * owns the sort the user clicks, the two refinements the query cannot express
 * (Region, Certification) and the search box's own text while the debounce
 * runs. Everything else it changes it writes to the URL.
 */

/* ─────────────────────────────────────────────────────────────────────────
   Columns — the prototype's nine, with "City · Region" merged into one
   (prototype line 380; confirmed by screenshots/13-suppliers-list.png).
   ───────────────────────────────────────────────────────────────────────── */

type SupplierSortKey =
  | "company"
  | "location"
  | "employees"
  | "factory"
  | "capacity"
  | "certification"
  | "contact"
  | "status";

interface SupplierColumn {
  /** A sort key, or `actions` for the trailing icon-button column. */
  id: SupplierSortKey | "actions";
  label: string;
  align?: "right";
  width?: number;
}

const SUPPLIER_COLUMNS: readonly SupplierColumn[] = [
  { id: "company", label: "Company" },
  { id: "location", label: "City · Region" },
  { id: "employees", label: "Employees", align: "right" },
  { id: "factory", label: "Factory", align: "right" },
  { id: "capacity", label: "Capacity / yr", align: "right" },
  { id: "certification", label: "Certification" },
  { id: "contact", label: "Sales contact" },
  { id: "status", label: "Status" },
  { id: "actions", label: "Actions", align: "right", width: 96 },
];

/**
 * Prototype line 359. Reading the Excel data sheet is not part of this phase,
 * so the control states where the import lands instead of faking a result. The
 * phase named here is the one the supplier form's own drop zone names.
 */
const IMPORT_TOAST =
  "Excel data-sheet import arrives in Phase 3 — the .xlsx columns will prefill the supplier fields";

/** The prototype writes an em dash wherever the data sheet had no value. */
const EM_DASH = "—";

/* ─────────────────────────────────────────────────────────────────────────
   Sorting — README §19: "any column, default company asc"
   ───────────────────────────────────────────────────────────────────────── */

type SortDirection = "asc" | "desc";

interface SortState {
  key: SupplierSortKey;
  direction: SortDirection;
}

const DEFAULT_SORT: SortState = { key: "company", direction: "asc" };

/** "200,000 m²" → 200000; "—"/null → null. Counts are sorted numerically. */
function numericValue(raw: string | null): number | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  return digits.length > 0 ? Number(digits) : null;
}

function locationText(supplier: Supplier): string {
  return [supplier.city, supplier.region].filter(Boolean).join(" · ");
}

function sortValue(
  supplier: Supplier,
  key: SupplierSortKey,
): string | number | null {
  switch (key) {
    case "company":
      return supplier.shortName;
    case "location":
      return locationText(supplier) || null;
    case "employees":
      return numericValue(supplier.employees);
    case "factory":
      return numericValue(supplier.factorySizeM2);
    case "capacity":
      return numericValue(supplier.productionCapacity);
    case "certification":
      return supplier.certifications;
    case "contact":
      return supplier.contactName;
    case "status":
      return SUPPLIER_STATUS_LABELS[supplier.status];
  }
}

/**
 * Sorts by the active column, then always by company name so the order is
 * stable. Records with no value for the column stay at the bottom in both
 * directions — a missing data-sheet field is not a low value.
 */
function compareSuppliers(a: Supplier, b: Supplier, sort: SortState): number {
  const left = sortValue(a, sort.key);
  const right = sortValue(b, sort.key);
  const tieBreak = a.shortName.localeCompare(b.shortName, "en");

  if (left === null && right === null) return tieBreak;
  if (left === null) return 1;
  if (right === null) return -1;

  const comparison =
    typeof left === "number" && typeof right === "number"
      ? left - right
      : String(left).localeCompare(String(right), "en");

  if (comparison === 0) return tieBreak;
  return sort.direction === "asc" ? comparison : -comparison;
}

/* ─────────────────────────────────────────────────────────────────────────
   Header cell
   ───────────────────────────────────────────────────────────────────────── */

/**
 * The sort control inherits every type property from `.table th`, so the
 * header keeps the approved 11px uppercase 60%-ink look and only gains a
 * pointer and a focus ring.
 */
const SORT_BUTTON: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  background: "transparent",
  border: 0,
  padding: 0,
  margin: 0,
  font: "inherit",
  color: "inherit",
  letterSpacing: "inherit",
  textTransform: "inherit",
  cursor: "pointer",
};

function SortableHeader({
  column,
  sort,
  onSort,
}: {
  column: SupplierColumn;
  sort: SortState;
  onSort: (key: SupplierSortKey) => void;
}) {
  if (column.id === "actions") {
    return (
      <Th align={column.align} width={column.width}>
        {column.label}
      </Th>
    );
  }

  const key = column.id;
  const active = sort.key === key;
  const nextDirection: SortDirection =
    active && sort.direction === "asc" ? "desc" : "asc";

  return (
    <Th
      align={column.align}
      width={column.width}
      aria-sort={
        active
          ? sort.direction === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <button
        type="button"
        style={SORT_BUTTON}
        onClick={() => onSort(key)}
        aria-label={`Sort by ${column.label}, ${nextDirection}ending`}
      >
        {column.label}
        {active ? (
          <Icon
            name="down"
            size={11}
            style={{
              opacity: 0.7,
              transform: sort.direction === "asc" ? "rotate(180deg)" : undefined,
            }}
          />
        ) : null}
      </button>
    </Th>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Cells
   ───────────────────────────────────────────────────────────────────────── */

/** Prototype line 391 — the 30px initials square. */
const INITIALS_SQUARE: CSSProperties = {
  width: "30px",
  height: "30px",
  flex: "none",
  border: "1px solid var(--color-divider)",
  display: "grid",
  placeItems: "center",
  fontFamily: "var(--font-heading)",
  fontWeight: 600,
  fontSize: "11.5px",
  color: "var(--color-accent-700)",
  letterSpacing: ".02em",
};

/**
 * The row's real affordance (README §19 / the table kit): a link, in the first
 * cell, wrapping the initials square and both name lines.
 */
function CompanyCell({ supplier }: { supplier: Supplier }) {
  return (
    <Link
      href={`/suppliers/${supplier.id}/overview`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "9px",
        textAlign: "left",
        color: "inherit",
        textDecoration: "none",
      }}
    >
      <span style={INITIALS_SQUARE} aria-hidden="true">
        {supplierInitials(supplier)}
      </span>
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: "14px",
            color: "var(--color-text)",
          }}
        >
          {supplier.shortName}
        </span>
        <span
          style={{
            display: "block",
            fontSize: "11px",
            color: "var(--color-neutral-600)",
          }}
        >
          {supplier.legalName}
        </span>
      </span>
    </Link>
  );
}

function SupplierRow({ supplier }: { supplier: Supplier }) {
  const router = useRouter();

  return (
    <Tr>
      <Td>
        <CompanyCell supplier={supplier} />
      </Td>
      <Td
        nowrap
        style={{ fontSize: "12.5px", color: "var(--color-neutral-700)" }}
      >
        {locationText(supplier) || EM_DASH}
      </Td>
      <Td align="right" nowrap style={{ fontSize: "12.5px" }}>
        {supplier.employees ?? EM_DASH}
      </Td>
      <Td
        align="right"
        nowrap
        style={{ fontSize: "12.5px", color: "var(--color-neutral-700)" }}
      >
        {supplier.factorySizeM2 ?? EM_DASH}
      </Td>
      <Td
        align="right"
        nowrap
        style={{ fontSize: "12.5px", color: "var(--color-neutral-700)" }}
      >
        {supplier.productionCapacity ?? EM_DASH}
      </Td>
      <Td
        style={{
          fontSize: "11.5px",
          color: "var(--color-neutral-700)",
          maxWidth: "186px",
        }}
      >
        {supplier.certifications ?? EM_DASH}
      </Td>
      <Td style={{ fontSize: "12px", maxWidth: "190px" }}>
        <span style={{ display: "block" }}>{supplier.contactName ?? EM_DASH}</span>
        {supplier.contactEmail ? (
          <span
            style={{
              display: "block",
              fontSize: "11px",
              color: "var(--color-neutral-600)",
              overflowWrap: "anywhere",
            }}
          >
            {supplier.contactEmail}
          </span>
        ) : null}
      </Td>
      <Td nowrap>
        <SupplierStatusBadge status={supplier.status} />
        <DataSheetBadge
          state={supplier.dataSheetState}
          className="ml-[4px]"
        />
      </Td>
      <Td align="right">
        <RowActions>
          <IconButton
            label="Open supplier"
            name="eye"
            variant="secondary"
            onClick={() => router.push(`/suppliers/${supplier.id}/overview`)}
          />
          <IconButton
            label="New visit report"
            name="file"
            variant="secondary"
            onClick={() => router.push("/reports/new")}
          />
          <IconButton
            label="Edit"
            name="pencil"
            variant="secondary"
            onClick={() => router.push(`/suppliers/${supplier.id}/edit`)}
          />
        </RowActions>
      </Td>
    </Tr>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Header actions
   ───────────────────────────────────────────────────────────────────────── */

/**
 * The page header's action pair. It lives beside the table rather than in the
 * page because `Import Data Sheet` needs a click handler: reading the Excel
 * data sheet is not part of this phase, so the control names the phase it lands
 * in instead of faking a result (prototype line 359).
 */
export function SuppliersHeaderActions() {
  const { toast } = useToast();

  return (
    <>
      <Button variant="secondary" icon="upload" onClick={() => toast(IMPORT_TOAST)}>
        Import Data Sheet
      </Button>
      <ButtonLink variant="primary" icon="plus" href="/suppliers/new">
        Add Supplier
      </ButtonLink>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   The list
   ───────────────────────────────────────────────────────────────────────── */

/**
 * Long enough that a query is sent once a word is typed rather than once a
 * letter is, short enough that the list still feels like it filters as you
 * type (README §1.6).
 */
const SEARCH_DEBOUNCE_MS = 300;

export interface SuppliersTableProps {
  /** Already filtered by `filters` and ordered short name A–Z by the query. */
  suppliers: readonly Supplier[];
  /** The four filters the address bar carries. */
  filters: SupplierQueryFilters;
}

export function SuppliersTable({ suppliers, filters }: SuppliersTableProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [local, setLocal] = useState<SupplierLocalFilters>(EMPTY_LOCAL_FILTERS);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);

  // The search box keeps its own text so typing stays instant while the URL
  // catches up one query behind it.
  const [draftQuery, setDraftQuery] = useState(filters.query);
  /** The query written into the URL by this component and not yet observed. */
  const pushedQuery = useRef<string | null>(null);

  const urlQuery = filters.query;

  const push = useCallback(
    (next: SupplierQueryFilters) => {
      // The box is only "ahead of the URL" while a push actually changes the
      // query; marking a no-op push would leave the ref set for ever and make
      // the next Back navigation look like our own.
      pushedQuery.current = next.query === urlQuery ? null : next.query;

      // `replace`, not `push`: refining a filter is not a step the Back button
      // should have to walk through one select at a time.
      startTransition(() => router.replace(suppliersHref(next), { scroll: false }));
    },
    [router, urlQuery],
  );

  useEffect(() => {
    // While a push of our own is in flight the box is ahead of the URL and must
    // keep what the user typed; any other navigation — Back, Clear filters —
    // is the new truth.
    if (pushedQuery.current !== null) {
      if (pushedQuery.current === urlQuery) pushedQuery.current = null;
      return;
    }
    setDraftQuery(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    if (draftQuery === urlQuery) return;

    const timer = setTimeout(() => push({ ...filters, query: draftQuery }), SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [draftQuery, urlQuery, filters, push]);

  const rows = useMemo(
    () =>
      suppliers
        .filter((supplier) => matchesLocalFilters(supplier, local))
        // `.sort()` mutates, and `suppliers` is a server prop: the filter above
        // already copied, so this sorts the copy.
        .sort((a, b) => compareSuppliers(a, b, sort)),
    [suppliers, local, sort],
  );

  function handleSort(key: SupplierSortKey) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    );
  }

  function handleFilterChange(patch: Partial<SupplierFilters>) {
    if (patch.query !== undefined) setDraftQuery(patch.query);

    if (patch.region !== undefined || patch.certification !== undefined) {
      setLocal((current) => ({
        region: patch.region ?? current.region,
        certification: patch.certification ?? current.certification,
      }));
    }

    if (
      patch.country !== undefined ||
      patch.status !== undefined ||
      patch.dataSheet !== undefined
    ) {
      push({
        ...filters,
        // Text typed but not yet debounced travels with the select, so
        // changing a filter never throws away half a search term.
        query: draftQuery,
        country: patch.country ?? filters.country,
        status: patch.status ?? filters.status,
        dataSheet: patch.dataSheet ?? filters.dataSheet,
      });
    }
  }

  function clearFilters() {
    setLocal(EMPTY_LOCAL_FILTERS);
    setDraftQuery("");
    push({ ...EMPTY_QUERY_FILTERS });
  }

  const filtered = hasQueryFilter(filters) || hasLocalFilter(local);

  return (
    <>
      <SuppliersFilterBar
        suppliers={suppliers}
        filters={{ ...filters, ...local, query: draftQuery }}
        onChange={handleFilterChange}
      />

      {rows.length === 0 ? (
        filtered ? (
          <EmptyState
            message="No supplier matches these filters."
            action={
              <Button
                variant="secondary"
                size="compact"
                icon="x"
                onClick={clearFilters}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            message={EMPTY_STATE_COPY.noSuppliers}
            action={
              <>
                <Button
                  variant="secondary"
                  size="compact"
                  icon="upload"
                  onClick={() => toast(IMPORT_TOAST)}
                >
                  Import Data Sheet
                </Button>
                <ButtonLink
                  variant="primary"
                  size="compact"
                  icon="plus"
                  href="/suppliers/new"
                >
                  Add Supplier
                </ButtonLink>
              </>
            }
          />
        )
      ) : (
        <TableFrame minWidth={1180}>
          <Table>
            <Thead>
              <Tr>
                {SUPPLIER_COLUMNS.map((column) => (
                  <SortableHeader
                    key={column.id}
                    column={column}
                    sort={sort}
                    onSort={handleSort}
                  />
                ))}
              </Tr>
            </Thead>
            <Tbody>
              {rows.map((supplier) => (
                <SupplierRow key={supplier.id} supplier={supplier} />
              ))}
            </Tbody>
          </Table>
        </TableFrame>
      )}
    </>
  );
}
