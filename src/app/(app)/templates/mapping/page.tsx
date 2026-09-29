import type { Metadata } from "next";

import {
  ExportSectionsTable,
  ExportShellNote,
} from "@/components/templates/mapping-table";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Export Sections",
};

/**
 * `/templates/mapping` — README §16, transcribed from the approved prototype
 * (design-handoff/ODM Supplier Visit.dc.html lines 1544..1580): page padding
 * 26px 24px 40px, max-width 1040px, breadcrumb 14px above the header.
 *
 * The route and the frame are the approved ones. The content is not a mapping
 * any more: the corporate template holds no placeholders, so there is nothing to
 * bind fields to. The screen explains what the export actually does with the
 * template and lists the sections it writes.
 */
export default function TemplateMappingPage() {
  return (
    <div className="anim-rise" style={{ padding: "26px 24px 40px", maxWidth: 1040 }}>
      <Breadcrumb
        items={[
          { label: "Templates", href: "/templates" },
          { label: "Export sections" },
        ]}
        className="mb-[14px]"
      />

      <PageHeader
        title="How the Export Fills the Template"
        subtitle="The corporate template has no placeholders — the export writes the report into its shell, section by section."
      />

      <ExportShellNote />
      <ExportSectionsTable />
    </div>
  );
}
