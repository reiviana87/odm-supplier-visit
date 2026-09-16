"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type CSSProperties } from "react";

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
import { supplierInitials } from "@/lib/mock-data";
import { SUPPLIER_STATUS_LABELS, type Supplier } from "@/types/domain";

import {
  EMPTY_SUPPLIER_FILTERS,
  isFilterActive,
  supplierMatchesFilters,
  SuppliersFilterBar,
  type SupplierFilters,
} from "./suppliers-filter-bar";

/**
 * Suppliers list — README §1.6, §8.2, §19; prototype lines 366..419.
 *
 * The whole client surface of the screen: the filter bar, the sortable table
 * inside its 1180px-wide scrolling `.blueprint` frame, and the empty state.
 * Filtering and sorting are in-memory over the 14 seeded records (README §8.1),
 * which is what Phase 1 needs — the same predicates move into the Supabase
 * query later without changing this component's shape.
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
 * Prototype line 359. Reading the Excel data sheet is not a Phase 1 feature, so
 * the control states where the import lands instead of faking a result.
 */
const IMPORT_TOAST =
  "Excel data-sheet import arrives in Phase 2 — the .xlsx columns will prefill the supplier fields";

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
 * data sheet is not part of Phase 1, so the control names the phase it lands
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

export interface SuppliersTableProps {
  suppliers: readonly Supplier[];
}

export function SuppliersTable({ suppliers }: SuppliersTableProps) {
  const { toast } = useToast();
  const [filters, setFilters] = useState<SupplierFilters>(EMPTY_SUPPLIER_FILTERS);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);

  const rows = useMemo(
    () =>
      suppliers
        .filter((supplier) => supplierMatchesFilters(supplier, filters))
        .sort((a, b) => compareSuppliers(a, b, sort)),
    [suppliers, filters, sort],
  );

  function handleSort(key: SupplierSortKey) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    );
  }

  const filtered = isFilterActive(filters);

  return (
    <>
      <SuppliersFilterBar
        suppliers={suppliers}
        filters={filters}
        onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
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
                onClick={() => setFilters(EMPTY_SUPPLIER_FILTERS)}
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
