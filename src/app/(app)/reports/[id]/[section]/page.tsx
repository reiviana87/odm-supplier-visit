import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ReportEditor } from "@/components/reports/report-editor";
import { renderSection } from "@/components/reports/sections";
import { REPORT_PHOTOS, getReport } from "@/lib/mock-data";
import { isSectionId } from "@/types/domain";

/**
 * Report editor — README §6, route `/reports/:id/:section`.
 *
 * The shell (header, navigator, rail, autosave) belongs to `<ReportEditor>`;
 * this page resolves the route, loads the report and hands the shell the one
 * section the URL asks for. Each section is its own address, so the browser
 * back button, a bookmark and the navigator all agree (README §6.3).
 */

interface EditorPageProps {
  params: Promise<{ id: string; section: string }>;
}

export async function generateMetadata({
  params,
}: EditorPageProps): Promise<Metadata> {
  const { id } = await params;
  const report = getReport(id);

  return { title: report ? report.documentNumber : "Report" };
}

export default async function ReportSectionPage({ params }: EditorPageProps) {
  const { id, section } = await params;

  if (!isSectionId(section)) {
    notFound();
  }

  const report = getReport(id);
  if (!report) {
    notFound();
  }

  return (
    <ReportEditor report={report} photos={REPORT_PHOTOS} activeSection={section}>
      {renderSection(section, report, REPORT_PHOTOS)}
    </ReportEditor>
  );
}
