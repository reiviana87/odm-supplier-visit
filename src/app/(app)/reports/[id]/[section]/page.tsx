import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ReportEditor } from "@/components/reports/report-editor";
import { renderSection } from "@/components/reports/sections";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { getReport } from "@/lib/data/reports";
import { getSupplierCertificates } from "@/lib/data/suppliers";
import { REPORT_PHOTOS } from "@/lib/mock-data";
import { isSectionId } from "@/types/domain";

/**
 * Report editor — README §6, route `/reports/:id/:section`.
 *
 * The shell (header, navigator, rail, autosave) belongs to `<ReportEditor>`;
 * this page resolves the route, reads the report through the data layer and
 * hands the shell the one section the URL asks for. Each section is its own
 * address, so the browser back button, a bookmark and the navigator all agree
 * (README §6.3).
 *
 * `getReport` answers with the report **and** its stored section rows. Both go
 * down: the rendering shape draws the screen, the rows carry the `version` each
 * autosave patches against (Phase 2 §18). They come from one query, so the two
 * cannot describe different moments of the same report.
 *
 * Section 7 lists the certificate copies collected for the supplier, which are
 * live rows rather than part of the frozen snapshot: a copy handed over after
 * the visit still belongs in the report. When that read fails or returns
 * nothing, the section falls back to what the snapshot says was declared.
 *
 * Photographs are still the seeded set — they are Phase 4, and nothing in the
 * data layer serves them yet.
 */

interface EditorPageProps {
  params: Promise<{ id: string; section: string }>;
}

export async function generateMetadata({
  params,
}: EditorPageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await getReport(id);

  return { title: result.ok ? result.data.report.documentNumber : "Report" };
}

export default async function ReportSectionPage({ params }: EditorPageProps) {
  const { id, section } = await params;

  if (!isSectionId(section)) {
    notFound();
  }

  const result = await getReport(id);
  if (!result.ok) {
    // A report that is not there is a 404. Anything else — a read the policies
    // refused, a server that did not answer — is not, and saying "not found"
    // would send the user looking for a report that exists (README §22).
    if (result.error.code === "not_found") {
      notFound();
    }
    return (
      <PageShell>
        <PageHeader title="Report" />
        <EmptyState variant="page" message={result.error.message} />
      </PageShell>
    );
  }

  const { report, sections } = result.data;

  // Only §7 draws them, so nothing else pays for the query.
  const certificates =
    section === "certificates"
      ? await getSupplierCertificates(report.supplierSnapshot.supplierId)
      : null;

  return (
    <ReportEditor
      report={report}
      sections={sections}
      photos={REPORT_PHOTOS}
      activeSection={section}
    >
      {renderSection(
        section,
        report,
        REPORT_PHOTOS,
        certificates?.ok ? certificates.data : undefined,
      )}
    </ReportEditor>
  );
}
