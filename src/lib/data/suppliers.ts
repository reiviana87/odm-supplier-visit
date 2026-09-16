/**
 * Supplier reads — SERVER ONLY (Phase 2 §24).
 *
 * Together with `supplier-actions.ts` this is the only module that queries the
 * supplier tables: screens call these functions, never Supabase. Nothing here
 * throws — every function answers with a `DataResult`, so a page renders an
 * empty state or a message instead of a crash.
 *
 * While `isMockMode()` is true every read falls back to the seeded data behind
 * `mockData` at the bottom of the file, applying the same filtering and the
 * same order in memory, so the screens behave identically with and without a
 * project.
 */

import { fail, ok, toDataError, type DataResult } from "@/lib/data/errors";
import { rowToCertificate, rowToSupplier } from "@/lib/data/supplier-mappers";
import { CERTIFICATES_BY_SUPPLIER, SUPPLIERS } from "@/lib/mock-data";
import { isMockMode } from "@/lib/supabase/env";
import { getServerSupabase } from "@/lib/supabase/server";
import type {
  DataSheetState,
  Supplier,
  SupplierCertificate,
  SupplierStatus,
} from "@/types/domain";

export interface ListSuppliersOptions {
  /** Matches short name, legal name, Chinese name, supplier code and city. */
  query?: string;
  status?: SupplierStatus;
  country?: string;
  dataSheetState?: DataSheetState;
  /** Archived suppliers are left out unless a caller asks for them (§33). */
  includeArchived?: boolean;
}

export interface SupplierCounts {
  total: number;
  dataSheetsReceived: number;
}

/**
 * One round trip for the whole list: the supplier row, its contact cards and
 * the number of reports written against it. PostgREST resolves both embeds from
 * the foreign keys, which beats the three queries and the client-side join the
 * alternative needs.
 */
const SUPPLIER_SELECT = "*, supplier_contacts(*), reports(count)" as const;

/** PostgREST answers an embedded `count` with a single-element array. */
function reportCountOf(row: { reports: { count: number }[] }): number {
  return row.reports[0]?.count ?? 0;
}

/** Logs the PostgREST detail and answers with the sentence the user may see. */
function failFrom<T>(error: unknown, context: string): DataResult<T> {
  const dataError = toDataError(error, context);
  return fail(dataError.code, dataError.message);
}

/**
 * The PostgREST `or` grammar separates branches with commas and wraps a value
 * in parentheses, so a search for "Co., Ltd (Zhejiang)" would break the filter
 * itself. Those characters carry no meaning in a supplier search, so they are
 * dropped rather than escaped.
 */
function searchFilter(query: string): string {
  const term = query.replace(/[,()"\\]/g, " ").replace(/\s+/g, " ").trim();
  if (term === "") return "";

  return [
    "short_name",
    "legal_name",
    "chinese_name",
    "supplier_code",
    "city",
  ]
    .map((column) => `${column}.ilike.%${term}%`)
    .join(",");
}

export async function listSuppliers(
  options: ListSuppliersOptions = {},
): Promise<DataResult<Supplier[]>> {
  if (isMockMode()) return ok(mockData.list(options));

  const supabase = await getServerSupabase();
  if (!supabase) return fail("offline");

  let request = supabase.from("suppliers").select(SUPPLIER_SELECT);

  if (!options.includeArchived) request = request.is("archived_at", null);
  if (options.status) request = request.eq("status", options.status);
  if (options.country) request = request.eq("country", options.country);
  if (options.dataSheetState) request = request.eq("data_sheet_state", options.dataSheetState);

  const filter = searchFilter(options.query ?? "");
  if (filter !== "") request = request.or(filter);

  // README §19 — the list opens A–Z on the short name, which is the column the
  // user reads first.
  const { data, error } = await request.order("short_name", { ascending: true });
  if (error) return failFrom(error, "listSuppliers");

  const rows = data ?? [];
  return ok(rows.map((row) => rowToSupplier(row, row.supplier_contacts, reportCountOf(row))));
}

export async function getSupplier(id: string): Promise<DataResult<Supplier>> {
  if (isMockMode()) {
    const supplier = mockData.one(id);
    return supplier ? ok(supplier) : fail("not_found");
  }

  const supabase = await getServerSupabase();
  if (!supabase) return fail("offline");

  const { data, error } = await supabase
    .from("suppliers")
    .select(SUPPLIER_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) return failFrom(error, "getSupplier");
  if (!data) return fail("not_found");

  return ok(rowToSupplier(data, data.supplier_contacts, reportCountOf(data)));
}

/**
 * The certificate copies held for one supplier, in the author's order.
 *
 * A supplier with no collected copies answers with an empty list — README §1.7
 * then shows the certifications *declared* on the data sheet, which is a
 * rendering rule over `supplier.certifications`, not a row in this table.
 */
export async function getSupplierCertificates(
  supplierId: string,
): Promise<DataResult<SupplierCertificate[]>> {
  if (isMockMode()) return ok(mockData.certificates(supplierId));

  const supabase = await getServerSupabase();
  if (!supabase) return fail("offline");

  const { data, error } = await supabase
    .from("supplier_certificates")
    .select("*")
    .eq("supplier_id", supplierId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) return failFrom(error, "getSupplierCertificates");

  return ok((data ?? []).map(rowToCertificate));
}

/** The suppliers-page subtitle: "14 records · 12 data sheets received". */
export async function countSuppliers(): Promise<DataResult<SupplierCounts>> {
  if (isMockMode()) return ok(mockData.counts());

  const supabase = await getServerSupabase();
  if (!supabase) return fail("offline");

  // Two head requests rather than one `select('data_sheet_state')`: the payload
  // stays constant as the database grows, and the subtitle needs no rows.
  const [total, received] = await Promise.all([
    supabase.from("suppliers").select("id", { count: "exact", head: true }).is("archived_at", null),
    supabase
      .from("suppliers")
      .select("id", { count: "exact", head: true })
      .is("archived_at", null)
      .eq("data_sheet_state", "received"),
  ]);

  const error = total.error ?? received.error;
  if (error) return failFrom(error, "countSuppliers");

  return ok({ total: total.count ?? 0, dataSheetsReceived: received.count ?? 0 });
}

/**
 * Whether the EBARA supplier code is already taken — `exceptId` is the record
 * being edited, which is allowed to keep its own code. Archived suppliers count:
 * the unique index does not care that a record is out of the pickers.
 */
export async function supplierExistsByCode(
  code: string,
  exceptId?: string,
): Promise<DataResult<boolean>> {
  const trimmed = code.trim();
  if (trimmed === "") return ok(false);

  if (isMockMode()) return ok(mockData.existsByCode(trimmed, exceptId));

  const supabase = await getServerSupabase();
  if (!supabase) return fail("offline");

  let request = supabase
    .from("suppliers")
    .select("id", { count: "exact", head: true })
    .eq("supplier_code", trimmed);

  if (exceptId) request = request.neq("id", exceptId);

  const { count, error } = await request;
  if (error) return failFrom(error, "supplierExistsByCode");

  return ok((count ?? 0) > 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Seeded fallback — delete this block with `isMockMode()`
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The Phase 1 seed, filtered and ordered exactly as the queries above do it.
 * Every branch in this file points here and nowhere else, so removing the demo
 * mode is one deletion plus five `if (isMockMode())` lines.
 */
const mockData = {
  list(options: ListSuppliersOptions): Supplier[] {
    const term = options.query?.trim().toLowerCase() ?? "";

    return SUPPLIERS.filter((supplier) => {
      if (!options.includeArchived && supplier.archivedAt !== null) return false;
      if (options.status && supplier.status !== options.status) return false;
      if (options.country && supplier.country !== options.country) return false;
      if (options.dataSheetState && supplier.dataSheetState !== options.dataSheetState) {
        return false;
      }
      if (term === "") return true;

      return [
        supplier.shortName,
        supplier.legalName,
        supplier.chineseName,
        supplier.supplierCode,
        supplier.city,
      ].some((field) => field !== null && field.toLowerCase().includes(term));
    }).sort((a, b) => a.shortName.localeCompare(b.shortName, "en"));
  },

  one(id: string): Supplier | undefined {
    return SUPPLIERS.find((supplier) => supplier.id === id);
  },

  certificates(supplierId: string): SupplierCertificate[] {
    // Sorted the way the query sorts, and copied first: the fixture is a shared
    // module constant, so sorting it in place would reorder the seed for every
    // later read in the same process.
    return [...(CERTIFICATES_BY_SUPPLIER[supplierId] ?? [])].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "en"),
    );
  },

  counts(): SupplierCounts {
    const active = SUPPLIERS.filter((supplier) => supplier.archivedAt === null);
    return {
      total: active.length,
      dataSheetsReceived: active.filter((supplier) => supplier.dataSheetState === "received")
        .length,
    };
  },

  existsByCode(code: string, exceptId?: string): boolean {
    return SUPPLIERS.some(
      (supplier) => supplier.id !== exceptId && supplier.supplierCode === code,
    );
  },
};
