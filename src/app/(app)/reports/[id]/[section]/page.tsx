import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ReportEditor } from "@/components/reports/report-editor";
import { renderSection } from "@/components/reports/sections";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { listReportPhotos } from "@/lib/data/photo-actions";
import { getReport } from "@/lib/data/reports";
import { signCertificateUrls } from "@/lib/data/supplier-actions";
import { getSupplierCertificates } from "@/lib/data/suppliers";
import { listTranscripts } from "@/lib/data/transcript-actions";
import { REPORT_PHOTOS } from "@/lib/mock-data";
import { isMockMode } from "@/lib/supabase/env";
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
 * Photographs come from `listReportPhotos`, which reads the report's own
 * `report_images` rows and signs each stored object before handing them down.
 * They used to be the Phase 1 seed, and the difference was not academic: the
 * exporter read the real rows while every screen drew somebody else's visit, so
 * a photograph taken on the phone was in the Word document and nowhere on
 * screen. Demo mode still gets the seed, because it has no storage to read.
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

  // The rail lists these on every section, so they are read once here.
  const transcripts = await listTranscripts(id);

  // Every region's screen is drawn from this one read — §4.1, §8.1 and §10 are
  // the same rows filtered by region — and the navigator's caption warnings and
  // the completion percentages are counted from it too.
  const storedPhotos = await listReportPhotos(id);
  const photos = isMockMode()
    ? REPORT_PHOTOS
    : storedPhotos.ok
      ? storedPhotos.data
      : [];

  // Only §7 draws them, so nothing else pays for the query.
  const certificates =
    section === "certificates"
      ? await getSupplierCertificates(report.supplierSnapshot.supplierId)
      : null;

  // The collected copies live in a private bucket, so the card cannot link to
  // one without a signed URL. Signed in one batch here rather than per card.
  const copyPaths =
    certificates?.ok
      ? certificates.data
          .map((certificate) => certificate.storagePath)
          .filter((path): path is string => Boolean(path))
      : [];
  const signedCopies = copyPaths.length > 0 ? await signCertificateUrls(copyPaths) : null;
  const certificateCopyUrls = signedCopies?.ok ? signedCopies.data : {};

  return (
    <ReportEditor
      report={report}
      sections={sections}
      photos={photos}
      transcripts={transcripts.ok ? transcripts.data : []}
      activeSection={section}
    >
      {renderSection(
        section,
        report,
        photos,
        transcripts.ok ? transcripts.data : [],
        certificates?.ok ? certificates.data : undefined,
        certificateCopyUrls,
      )}
    </ReportEditor>
  );
}
