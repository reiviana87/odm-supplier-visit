import type { ReactNode } from "react";

import { PhotoSection } from "@/components/photos/photo-section";
import type { TranscriptSource } from "@/lib/data/transcript-actions";
import {
  SECTIONS,
  type ImageRegion,
  type Report,
  type ReportPhoto,
  type SectionId,
  type SupplierCertificate,
} from "@/types/domain";

import { CertificatesSection } from "./certificates-section";
import { CompanySection } from "./company-section";
import { ConclusionSection } from "./conclusion-section";
import { GeneralSection } from "./general-section";
import { ProductsSection } from "./products-section";
import { ProseSection } from "./prose-section";
import { TargetSection } from "./target-section";
import { VisitSection } from "./visit-section";

export { AiActionsRow, aiActionMessage } from "./prose-section";

/**
 * The section workspace — README §6.1, prototype lines 819..824.
 *
 * The title row sits outside every section branch in the prototype, so it is
 * written once here and `renderSection` wraps whatever the active section
 * renders:
 *
 *   number  Barlow Condensed 600 15px, --color-accent-700
 *   title   h4 (20px), baseline-aligned, 9px gap, 16px below
 */
export function SectionFrame({
  number,
  title,
  children,
}: {
  /** "1.", "4.1", or "" for General Information. */
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="anim-rise">
      <div
        className="flex items-baseline"
        style={{ gap: 9, marginBottom: 16 }}
      >
        {number.length > 0 ? (
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 600,
              fontSize: 15,
              color: "var(--color-accent-700)",
            }}
          >
            {number}
          </span>
        ) : null}
        <h4 style={{ margin: 0 }}>{title}</h4>
      </div>
      {children}
    </section>
  );
}

function photoSection(
  region: ImageRegion,
  report: Report,
  photos: readonly ReportPhoto[],
): ReactNode {
  return <PhotoSection region={region} report={report} photos={photos} />;
}

function sectionBody(
  sectionId: SectionId,
  report: Report,
  photos: readonly ReportPhoto[],
  certificates: readonly SupplierCertificate[] | undefined,
  transcripts: readonly TranscriptSource[],
): ReactNode {
  switch (sectionId) {
    case "general":
      return <GeneralSection report={report} />;
    case "purpose":
    case "overview":
    case "partners":
      // The text itself lives on the editor's section draft, so the prose
      // sections need nothing from the report but their own id.
      return <ProseSection sectionId={sectionId} reportId={report.id} />;
    case "company":
      return <CompanySection report={report} />;
    case "products":
      return <ProductsSection report={report} />;
    case "target":
      return <TargetSection report={report} />;
    case "visit":
      return <VisitSection report={report} transcripts={transcripts} photos={photos} />;
    case "certificates":
      return <CertificatesSection report={report} certificates={certificates} />;
    case "conclusion":
      // The conclusion is its section's body, which the editor draft holds.
      return <ConclusionSection reportId={report.id} />;
    // README §16 — the three image regions, each with its own export geometry.
    case "product-images":
      return photoSection("MAIN_PRODUCT_IMAGES", report, photos);
    case "partner-images":
      return photoSection("PARTNER_IMAGES", report, photos);
    case "appendix":
      return photoSection("APPENDIX_IMAGES", report, photos);
  }
}

/**
 * One component per section id (README §25, `<SectionOutlet>`), under the
 * shared title row.
 */
export function renderSection(
  sectionId: SectionId,
  report: Report,
  photos: readonly ReportPhoto[],
  transcripts: readonly TranscriptSource[],
  certificates?: readonly SupplierCertificate[],
): ReactNode {
  const definition =
    SECTIONS.find((section) => section.id === sectionId) ?? SECTIONS[0];

  return (
    <SectionFrame number={definition.number} title={definition.label}>
      {sectionBody(sectionId, report, photos, certificates, transcripts)}
    </SectionFrame>
  );
}
