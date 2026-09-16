"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { NewReportModal } from "@/components/reports/new-report-modal";
import {
  ReportsFilterBar,
  type ReportStatusFilter,
} from "@/components/reports/reports-filter-bar";
import {
  ReportsTable,
  type ReportRow,
} from "@/components/reports/reports-table";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import {
  HUATONG_REPORT,
  REPORTS,
  REPORTS_PAGE_SUBTITLE,
  REPORT_PHOTOS,
  getReport,
} from "@/lib/mock-data";
import { reportCompletion } from "@/lib/reports/completion";
import type { ReportSummary } from "@/types/domain";

/**
 * Reports list — README §1.3, §19. Prototype lines 271..350;
 * approved capture `design-handoff/screenshots/02-reports-list.png`.
 *
 * The screen is a client component: the search box, the Status filter, the
 * five row actions, the delete confirmation and the create wizard are all
 * interactive, and the rows themselves are static seed data with nothing to
 * fetch. `loading.tsx` still covers the segment while its payload arrives.
 */

/**
 * The database total behind the pager and the header line. The seed holds the
 * first page; `REPORTS_PAGE_SUBTITLE` states the same 18 in prose, and there is
 * no numeric export to read it from, so it is named here once.
 */
const TOTAL_REPORTS = 18;

/**
 * README §6.2 — completion is derived from the thirteen section predicates,
 * never stored.
 *
 * Only GSO-2608001x00 has a section body and a photo set seeded, so it is the
 * one row that can be derived today (69% — the figure the editor header shows).
 * The other five reports have deliberately empty bodies, and deriving them
 * would report every one of them at 23% rather than the approved figures, so
 * they fall back to the summary's stored percentage. When Phase 2 persists the
 * section bodies the derived value takes over for every row and this fallback
 * goes away.
 */
function completionFor(summary: ReportSummary): number {
  const report = getReport(summary.id);
  if (!report || report.id !== HUATONG_REPORT.id) {
    return summary.completion;
  }
  return reportCompletion(report, REPORT_PHOTOS);
}

const ROWS: readonly ReportRow[] = REPORTS.map((summary) => ({
  id: summary.id,
  documentNumber: summary.documentNumber,
  supplierShortName: summary.supplierShortName,
  location: summary.location,
  visitDate: summary.visitDate,
  employee: summary.employee,
  status: summary.status,
  completion: completionFor(summary),
  lastUpdatedLabel: summary.lastUpdatedLabel,
}));

function matchesQuery(row: ReportRow, query: string): boolean {
  const haystack =
    `${row.documentNumber} ${row.supplierShortName} ${row.location} ${row.employee}`.toLowerCase();
  return haystack.includes(query);
}

export default function ReportsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ReportStatusFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const term = query.trim().toLowerCase();
  const rows = useMemo(
    () =>
      ROWS.filter(
        (row) =>
          (status === "all" || row.status === status) &&
          (term === "" || matchesQuery(row, term)),
      ),
    [status, term],
  );

  return (
    <PageShell>
      <PageHeader
        title="Reports"
        subtitle={REPORTS_PAGE_SUBTITLE}
        spacing={18}
        actions={
          <>
            <Button
              variant="secondary"
              icon="download"
              onClick={() =>
                toast("Export list (XLSX) arrives with the export pipeline (Phase 5)")
              }
            >
              Export list (XLSX)
            </Button>
            <Button
              variant="primary"
              icon="plus"
              onClick={() => setCreateOpen(true)}
            >
              New Visit Report
            </Button>
          </>
        }
      />

      <ReportsFilterBar
        query={query}
        onQueryChange={setQuery}
        status={status}
        onStatusChange={setStatus}
      />

      <ReportsTable
        rows={rows}
        openReportId={HUATONG_REPORT.id}
        totalCount={TOTAL_REPORTS}
        filtered={term !== "" || status !== "all"}
      />

      <NewReportModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(reportId) => {
          setCreateOpen(false);
          router.push(`/reports/${reportId}/purpose`);
        }}
      />
    </PageShell>
  );
}
