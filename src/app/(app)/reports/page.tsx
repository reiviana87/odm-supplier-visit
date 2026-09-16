import { ReportsFilterBar } from "@/components/reports/reports-filter-bar";
import { ReportsHeaderActions } from "@/components/reports/reports-header-actions";
import { reportsSubtitle } from "@/components/reports/reports-subtitle";
import { ReportsTable } from "@/components/reports/reports-table";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { getCurrentUser } from "@/lib/auth/session";
import { countReports, listReports } from "@/lib/data/reports";
import { listSuppliers } from "@/lib/data/suppliers";
import { REPORT_STATUSES, type ReportStatus, type Supplier } from "@/types/domain";

/**
 * Reports list — README §1.3, §19. Prototype lines 271..350;
 * approved capture `design-handoff/screenshots/02-reports-list.png`.
 *
 * A Server Component: the rows, the counts and the create wizard's supplier
 * list are read through the data layer here (Phase 2 §24) and handed down. The
 * search box and the Status filter carry their state in the URL, so the query
 * that produced a screen is the query the address bar states, a filtered list
 * survives a reload and the database — not the browser — does the filtering.
 *
 * `loading.tsx` covers the segment while this runs.
 */

interface ReportsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** The first value of a repeated parameter; `""` when it is absent. */
function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const raw = params[key];
  if (Array.isArray(raw)) return raw[0] ?? "";
  return raw ?? "";
}

function toStatus(value: string): ReportStatus | undefined {
  return (REPORT_STATUSES as readonly string[]).includes(value)
    ? (value as ReportStatus)
    : undefined;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = await searchParams;
  const query = readParam(params, "q").trim();
  const status = toStatus(readParam(params, "status"));

  const [list, counts, suppliers, profile] = await Promise.all([
    listReports({ query: query || undefined, status }),
    countReports(),
    listSuppliers(),
    getCurrentUser(),
  ]);

  const rows = list.ok ? list.data : [];
  const supplierOptions: readonly Supplier[] = suppliers.ok ? suppliers.data : [];
  // The suggestion `nextDocumentNumber` makes is only a suggestion: the blur
  // check asks the database, and the unique constraint is what finally decides.
  // Feeding it the numbers on screen is therefore enough.
  const takenNumbers = rows.map((report) => report.documentNumber);

  return (
    <PageShell>
      <PageHeader
        title="Reports"
        // Stated only when it could be read. A count the server refused is not
        // worth guessing at from one page of rows.
        subtitle={counts.ok ? reportsSubtitle(counts.data) : undefined}
        spacing={18}
        actions={
          <ReportsHeaderActions
            suppliers={supplierOptions}
            currentUserName={profile?.fullName ?? ""}
            existingDocumentNumbers={takenNumbers}
          />
        }
      />

      <ReportsFilterBar query={query} status={status ?? "all"} />

      {list.ok ? (
        <ReportsTable
          rows={rows}
          totalCount={counts.ok ? counts.data.total : rows.length}
          filtered={query !== "" || status !== undefined}
        />
      ) : (
        <EmptyState variant="page" message={list.error.message} />
      )}
    </PageShell>
  );
}
