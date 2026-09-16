import { NewReportRoute } from "@/components/reports/new-report-modal";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { REPORTS_PAGE_SUBTITLE } from "@/lib/mock-data";

export const metadata = {
  title: "New Visit Report",
};

/**
 * `/reports/new` — README §1 routes, §9 workflow.
 *
 * The approved design has no standalone "new report" screen: the wizard is a
 * modal opened over the reports list (prototype lines 1718..1788). The route
 * exists so the step can be linked and reloaded, so it renders the reports page
 * header as the backdrop and opens the modal over it. `NewReportRoute` owns the
 * navigation — Cancel returns to /reports, Create Report opens the new draft.
 *
 * The backdrop is the header only, not the reports table: the table lives on
 * /reports, and duplicating it here would put a second, diverging copy of that
 * screen in the codebase for the fraction of a second it is visible.
 */
export default function NewReportPage() {
  return (
    <PageShell>
      <PageHeader title="Reports" subtitle={REPORTS_PAGE_SUBTITLE} />
      <NewReportRoute />
    </PageShell>
  );
}
