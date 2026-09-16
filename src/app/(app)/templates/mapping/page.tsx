import type { Metadata } from "next";

import {
  MappingTable,
  MappingWarning,
  RescanTemplateButton,
} from "@/components/templates/mapping-table";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Placeholder Mapping",
};

/**
 * `/templates/mapping` — README §16, transcribed from the approved prototype
 * (design-handoff/ODM Supplier Visit.dc.html lines 1544..1580): page padding
 * 26px 24px 40px, max-width 1040px, breadcrumb 14px above the header.
 */
export default function TemplateMappingPage() {
  return (
    <div className="anim-rise" style={{ padding: "26px 24px 40px", maxWidth: 1040 }}>
      <Breadcrumb
        items={[
          { label: "Templates", href: "/templates" },
          { label: "Placeholder mapping" },
        ]}
        className="mb-[14px]"
      />

      <PageHeader
        title="Template Mapping"
        subtitle="Each Word placeholder is bound to one app field. Sample values come from GSO-2608001x00."
        actions={<RescanTemplateButton />}
      />

      <MappingTable />
      <MappingWarning />
    </div>
  );
}
