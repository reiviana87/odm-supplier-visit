import type { ReportCounts } from "@/lib/data/reports";

/**
 * The reports page header line — "18 visit reports · 5 open · 11 exported to
 * DOCX" (README §19).
 *
 * Written once because two routes print it: /reports and the /reports/new
 * backdrop, which is the same header with the wizard over it. A second copy of
 * the sentence is a second copy to keep true.
 */
export function reportsSubtitle(counts: ReportCounts): string {
  const reports = counts.total === 1 ? "visit report" : "visit reports";
  return `${counts.total} ${reports} · ${counts.open} open · ${counts.exported} exported to DOCX`;
}
