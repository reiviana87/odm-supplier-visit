import type { Metadata } from "next";

import {
  ActiveTemplateCard,
  TemplateUploadButton,
  TemplatesTable,
} from "@/components/templates/templates-table";
import { PageHeader } from "@/components/ui/page-header";
import { EMPTY_STATE_COPY, EmptyState, ErrorState } from "@/components/ui/states";
import { listTemplates } from "@/lib/data/template-actions";

export const metadata: Metadata = {
  title: "Report Templates",
};

/** Prototype lines 1484..1543: 26px 24px 40px padding, 1000px content column. */
const PAGE_STYLE = { padding: "26px 24px 40px", maxWidth: 1000 } as const;

/**
 * `/templates` — README §16, transcribed from the approved prototype
 * (design-handoff/ODM Supplier Visit.dc.html lines 1484..1543): page padding
 * 26px 24px 40px, max-width 1000px, the active-template card above the version
 * history table.
 *
 * A Server Component: the versions are read here and handed to the client
 * surface, which owns the upload dialog and the confirmations. With the seeded
 * rows gone, the empty state is what the user meets first — and it carries the
 * upload button, because uploading the corporate template is the only thing
 * this screen can usefully do while there is none.
 */
export default async function TemplatesPage() {
  const templates = await listTemplates();

  if (!templates.ok) {
    return (
      <div className="anim-rise" style={PAGE_STYLE}>
        <PageHeader
          title="Report Templates"
          subtitle="The uploaded Word template controls the final document — layout, styles and pagination."
          spacing={20}
        />
        <ErrorState variant="page" message={templates.error.message} />
      </div>
    );
  }

  const versions = templates.data;
  const activeTemplate = versions.find((template) => template.isActive);

  return (
    <div className="anim-rise" style={PAGE_STYLE}>
      <PageHeader
        title="Report Templates"
        subtitle="The uploaded Word template controls the final document — layout, styles and pagination."
        spacing={20}
        actions={<TemplateUploadButton />}
      />

      {versions.length === 0 ? (
        <EmptyState
          variant="page"
          message={EMPTY_STATE_COPY.noTemplate}
          action={<TemplateUploadButton label="Upload template" />}
        />
      ) : (
        <>
          {activeTemplate ? (
            <ActiveTemplateCard template={activeTemplate} />
          ) : (
            // Uploaded versions with none chosen is a real state of the table,
            // and the export has nothing to build from until one is set active.
            <EmptyState
              className="mb-[22px]"
              message="No version is active. Set one active in the history below — until then the export has no corporate template to build from."
            />
          )}
          <h6 style={{ margin: "0 0 9px" }}>Version history</h6>
          <TemplatesTable templates={versions} />
        </>
      )}
    </div>
  );
}
