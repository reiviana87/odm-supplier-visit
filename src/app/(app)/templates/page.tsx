import type { Metadata } from "next";

import {
  ActiveTemplateCard,
  TemplateUploadButton,
  TemplatesTable,
} from "@/components/templates/templates-table";
import { PageHeader } from "@/components/ui/page-header";
import { EMPTY_STATE_COPY, EmptyState } from "@/components/ui/states";
import { TEMPLATES } from "@/lib/mock-data";

export const metadata: Metadata = {
  title: "Report Templates",
};

/**
 * `/templates` — README §16, transcribed from the approved prototype
 * (design-handoff/ODM Supplier Visit.dc.html lines 1484..1543): page padding
 * 26px 24px 40px, max-width 1000px, the active-template card above the version
 * history table.
 */
export default function TemplatesPage() {
  const activeTemplate = TEMPLATES.find((template) => template.isActive);

  return (
    <div className="anim-rise" style={{ padding: "26px 24px 40px", maxWidth: 1000 }}>
      <PageHeader
        title="Report Templates"
        subtitle="The uploaded Word template controls the final document — layout, styles and pagination."
        spacing={20}
        actions={<TemplateUploadButton />}
      />

      {TEMPLATES.length === 0 ? (
        <EmptyState
          variant="page"
          message={EMPTY_STATE_COPY.noTemplate}
          action={<TemplateUploadButton label="Upload template" />}
        />
      ) : (
        <>
          {activeTemplate ? <ActiveTemplateCard template={activeTemplate} /> : null}
          <h6 style={{ margin: "0 0 9px" }}>Version history</h6>
          <TemplatesTable />
        </>
      )}
    </div>
  );
}
