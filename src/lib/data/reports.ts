/**
 * Report reads — SERVER ONLY (Phase 2 §24).
 *
 * Together with `report-actions.ts` this is the only module that queries the
 * report tables: screens call these functions, never Supabase. Nothing here
 * throws — every function answers with a `DataResult`, so a page renders an
 * empty state or a message instead of a crash.
 *
 * While `isMockMode()` is true every read falls back to the seeded data behind
 * `mockData` at the bottom of the file, applying the same filtering and the
 * same order in memory, so the screens behave identically with and without a
 * project. That fallback is reached ONLY through `isMockMode()`: with a project
 * configured, an id that is not in the database is `not_found`, never a seeded
 * report that happens to share its shape. A report is evidence of a visit, and
 * showing one report's body under another report's id would be worse than
 * showing nothing at all.
 */

import { fail, ok, toDataError, type DataResult } from "@/lib/data/errors";
import {
  rowToReport,
  rowToReportSummary,
  rowsToSectionRecords,
  sectionBodyOf,
  type ReportChildren,
  type ReportJoinedRow,
  type ReportSectionRow,
} from "@/lib/data/report-mappers";
import { REPORTS, getReport as getSeededReport } from "@/lib/mock-data";
import { isMockMode } from "@/lib/supabase/env";
import { getServerSupabase } from "@/lib/supabase/server";
import {
  SECTION_IDS,
  type Report,
  type ReportStatus,
  type ReportSummary,
  type SectionRecord,
} from "@/types/domain";

export interface ListReportsOptions {
  /** Matches the document number, the supplier's name, the employee and the location. */
  query?: string;
  status?: ReportStatus;
  supplierId?: string;
  /** Archived reports are left out unless a caller asks for them (§33). */
  includeArchived?: boolean;
}

export interface ReportCounts {
  total: number;
  /** Still being written — draft or in review. */
  open: number;
  /** Reports with a finished DOCX behind them. */
  exported: number;
}

/**
 * The names a report row does not store: its supplier and its two people.
 * `reports` has two foreign keys to `profiles`, so each embed is aliased and
 * hinted by constraint name — without the hint PostgREST cannot tell which of
 * the two is meant and refuses the request.
 */
const REPORT_JOINS =
  "suppliers(short_name), " +
  "employee:profiles!reports_employee_id_fkey(full_name), " +
  "owner:profiles!reports_owner_id_fkey(full_name)";

/**
 * What the completion percentage measures (README §6.2): the section bodies,
 * the observation count and the target products. It is derived and never
 * stored, so the rows have to be read to answer it — the alternative is a
 * stored percentage that goes stale against the report it describes.
 *
 * These rows stay on the server. Only the mapped `ReportSummary` crosses to the
 * client.
 */
const COMPLETION_EMBEDS =
  "report_sections(*), report_observations(*), report_target_products(*)";

const REPORT_LIST_SELECT = `*, ${REPORT_JOINS}, ${COMPLETION_EMBEDS}` as const;

/** The detail adds the attendee chips and the §4 construction table. */
const REPORT_SELECT =
  `*, ${REPORT_JOINS}, ${COMPLETION_EMBEDS}, report_members(*), report_product_rows(*)` as const;

/** Logs the PostgREST detail and answers with the sentence the user may see. */
function failFrom<T>(error: unknown, context: string): DataResult<T> {
  const dataError = toDataError(error, context);
  return fail(dataError.code, dataError.message);
}

/**
 * The PostgREST `or` grammar separates branches with commas and wraps a value
 * in parentheses — the same rule `searchFilter` follows in `suppliers.ts`.
 * Those characters carry no meaning in a report search, so they are dropped
 * rather than escaped.
 */
function searchTerm(query: string): string {
  return query.replace(/[,()"\\]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * How many related ids one search may fold into the filter.
 *
 * The matched supplier and employee ids travel in the query string as an `in`
 * list, and a URL has a length limit. Fourteen suppliers and one sourcing
 * office are nowhere near it; the cap is here so that a one-letter search
 * against a grown database degrades into "the first 200 matches" instead of a
 * request the server rejects.
 */
const MAX_RELATED_IDS = 200;

/**
 * Ids of the suppliers and people whose names match the search.
 *
 * Two round trips, on purpose. PostgREST's top-level `or` cannot name a column
 * on an embedded table, so `document_number ilike … or supplier.short_name
 * ilike …` cannot be expressed in one filter. Making the supplier embed
 * `!inner` would express something else entirely — "reports whose supplier
 * matches" — and would drop the rows that match by document number, which is
 * the search §13 asks for first. Resolving the names to ids and folding them
 * into the same `or` keeps it one result set, correctly paged and ordered by
 * the database rather than filtered in memory afterwards.
 */
async function relatedIds(
  supabase: NonNullable<Awaited<ReturnType<typeof getServerSupabase>>>,
  term: string,
): Promise<DataResult<{ supplierIds: string[]; employeeIds: string[] }>> {
  const pattern = `%${term}%`;

  const [suppliers, profiles] = await Promise.all([
    supabase
      .from("suppliers")
      .select("id")
      .or(`short_name.ilike.${pattern},legal_name.ilike.${pattern}`)
      .limit(MAX_RELATED_IDS),
    supabase
      .from("profiles")
      .select("id")
      .ilike("full_name", pattern)
      .limit(MAX_RELATED_IDS),
  ]);

  const error = suppliers.error ?? profiles.error;
  if (error) return failFrom(error, "listReports:relatedIds");

  return ok({
    supplierIds: (suppliers.data ?? []).map((row) => row.id),
    employeeIds: (profiles.data ?? []).map((row) => row.id),
  });
}

/** The child rows PostgREST returned beside a report row. */
function childrenOf(row: {
  report_sections: ReportSectionRow[];
  report_observations?: ReportChildren["observations"];
  report_target_products?: ReportChildren["targetProducts"];
  report_members?: ReportChildren["members"];
  report_product_rows?: ReportChildren["productRows"];
}): ReportChildren {
  return {
    // PostgREST returns an embed in an arbitrary order; every collection in a
    // report is the author's own ordering, so it is restored here rather than
    // relying on the order the rows came back in.
    sections: row.report_sections,
    observations: sortBySortOrder(row.report_observations),
    targetProducts: sortBySortOrder(row.report_target_products),
    members: sortBySortOrder(row.report_members),
    productRows: sortBySortOrder(row.report_product_rows),
  };
}

function sortBySortOrder<T extends { sort_order: number }>(
  rows: readonly T[] | undefined,
): readonly T[] {
  return rows ? [...rows].sort((a, b) => a.sort_order - b.sort_order) : [];
}

export async function listReports(
  options: ListReportsOptions = {},
): Promise<DataResult<ReportSummary[]>> {
  if (isMockMode()) return ok(mockData.list(options));

  const supabase = await getServerSupabase();
  if (!supabase) return fail("offline");

  let request = supabase.from("reports").select(REPORT_LIST_SELECT);

  // Asking for the archived reports is asking to see them, whatever the
  // `includeArchived` default says.
  if (!options.includeArchived && options.status !== "archived") {
    request = request.is("archived_at", null);
  }
  if (options.status === "archived") {
    request = request.not("archived_at", "is", null);
  } else if (options.status) {
    request = request.eq("status", options.status);
  }
  if (options.supplierId) request = request.eq("supplier_id", options.supplierId);

  const term = searchTerm(options.query ?? "");
  if (term !== "") {
    const related = await relatedIds(supabase, term);
    if (!related.ok) return related;

    const pattern = `%${term}%`;
    const branches = [`document_number.ilike.${pattern}`, `location.ilike.${pattern}`];
    if (related.data.supplierIds.length > 0) {
      branches.push(`supplier_id.in.(${related.data.supplierIds.join(",")})`);
    }
    if (related.data.employeeIds.length > 0) {
      branches.push(`employee_id.in.(${related.data.employeeIds.join(",")})`);
    }

    request = request.or(branches.join(","));
  }

  // README §19 — the reports table opens on the most recently edited report.
  const { data, error } = await request.order("updated_at", { ascending: false });
  if (error) return failFrom(error, "listReports");

  const now = new Date();
  return ok(
    (data ?? []).map((row) => {
      const report = rowToReport(row as ReportJoinedRow, childrenOf(row), now);
      return rowToReportSummary(row as ReportJoinedRow, report.completion, now);
    }),
  );
}

/**
 * The report the editor opens, in both the shapes it needs: the rendering shape
 * and the section rows carrying the `version` each autosave patches against
 * (Phase 2 §18). They come from one nested select, so the two cannot describe
 * different moments of the same report.
 */
export async function getReport(
  id: string,
): Promise<DataResult<{ report: Report; sections: SectionRecord[] }>> {
  if (isMockMode()) {
    const seeded = mockData.one(id);
    return seeded ? ok(seeded) : fail("not_found");
  }

  const supabase = await getServerSupabase();
  if (!supabase) return fail("offline");

  const { data, error } = await supabase
    .from("reports")
    .select(REPORT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) return failFrom(error, "getReport");
  if (!data) return fail("not_found");

  const row = data as ReportJoinedRow;
  const children = childrenOf(data);

  return ok({
    report: rowToReport(row, children),
    sections: rowsToSectionRecords(children.sections),
  });
}

/**
 * Whether the GSO document number is already taken — README §9's blur check.
 * `exceptId` is the report being edited, which keeps its own number. Archived
 * reports count: the unique constraint does not care that a report is out of
 * the lists.
 */
export async function documentNumberExists(
  documentNumber: string,
  exceptId?: string,
): Promise<DataResult<boolean>> {
  const trimmed = documentNumber.trim();
  if (trimmed === "") return ok(false);

  if (isMockMode()) return ok(mockData.documentNumberExists(trimmed, exceptId));

  const supabase = await getServerSupabase();
  if (!supabase) return fail("offline");

  let request = supabase
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("document_number", trimmed);

  if (exceptId) request = request.neq("id", exceptId);

  const { count, error } = await request;
  if (error) return failFrom(error, "documentNumberExists");

  return ok((count ?? 0) > 0);
}

/**
 * The reports-page subtitle: "18 visit reports · 5 open · 11 exported to DOCX".
 *
 * `exported` counts reports with a finished DOCX behind them, not reports whose
 * status is Final: the subtitle claims a file exists, and only `report_exports`
 * knows whether one does. Until the export pipeline ships it is honestly zero.
 */
export async function countReports(): Promise<DataResult<ReportCounts>> {
  if (isMockMode()) return ok(mockData.counts());

  const supabase = await getServerSupabase();
  if (!supabase) return fail("offline");

  const [total, open, exports] = await Promise.all([
    supabase.from("reports").select("id", { count: "exact", head: true }).is("archived_at", null),
    supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .is("archived_at", null)
      .in("status", ["draft", "in_review"]),
    // Rows, not a head count: one report can be exported many times, and the
    // subtitle counts reports. The distinct is done here because PostgREST has
    // no `count(distinct …)`.
    supabase.from("report_exports").select("report_id").eq("status", "ready"),
  ]);

  const error = total.error ?? open.error ?? exports.error;
  if (error) return failFrom(error, "countReports");

  const exported = new Set((exports.data ?? []).map((row) => row.report_id));

  return ok({ total: total.count ?? 0, open: open.count ?? 0, exported: exported.size });
}

// ─────────────────────────────────────────────────────────────────────────────
// Seeded fallback — delete this block with `isMockMode()`
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The Phase 1 seed, filtered and ordered exactly as the queries above do it.
 * Every branch in this file points here and nowhere else, so removing the demo
 * mode is one deletion plus four `if (isMockMode())` lines.
 */
const mockData = {
  list(options: ListReportsOptions): ReportSummary[] {
    const term = options.query?.trim().toLowerCase() ?? "";

    return REPORTS.filter((report) => {
      // The seed has no `archivedAt` of its own; an archived report is one whose
      // status says so, which is what the mapper derives from the column.
      const archived = report.status === "archived";
      if (archived && !options.includeArchived && options.status !== "archived") return false;
      if (options.status && report.status !== options.status) return false;
      if (options.supplierId && report.supplierId !== options.supplierId) return false;
      if (term === "") return true;

      return [
        report.documentNumber,
        report.supplierShortName,
        report.employee,
        report.location,
      ].some((field) => field.toLowerCase().includes(term));
    }).sort((a, b) => b.lastUpdatedAt.localeCompare(a.lastUpdatedAt));
  },

  one(id: string): { report: Report; sections: SectionRecord[] } | undefined {
    const report = getSeededReport(id);
    if (!report) return undefined;

    // The seed holds the rendering shape, so the section rows are derived back
    // out of it. Version 1 is what a report that has never been patched carries.
    const sections: SectionRecord[] = SECTION_IDS.map((sectionId) => {
      const stored = sectionBodyOf(report.sections, sectionId);
      return {
        sectionId,
        body: stored?.body ?? "",
        excluded: stored?.excluded ?? false,
        version: 1,
        updatedAt: report.lastUpdatedAt,
      };
    });

    return { report, sections };
  },

  documentNumberExists(documentNumber: string, exceptId?: string): boolean {
    return REPORTS.some(
      (report) => report.id !== exceptId && report.documentNumber === documentNumber,
    );
  },

  /**
   * Derived from the six seeded rows, which are the first page of a database
   * the approved subtitle describes as 18 reports. The demo counts what the
   * demo actually holds rather than repeating a number it cannot show, and
   * `exported` is zero because no export exists yet in either mode.
   */
  counts(): ReportCounts {
    const active = REPORTS.filter((report) => report.status !== "archived");
    return {
      total: active.length,
      open: active.filter((report) => report.status === "draft" || report.status === "in_review")
        .length,
      exported: 0,
    };
  },
};
