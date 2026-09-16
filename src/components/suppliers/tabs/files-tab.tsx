"use client";

import { EMPTY_STATE_COPY, EmptyState } from "@/components/ui/states";
import { UploadZone } from "@/components/ui/upload-zone";
import { useToast } from "@/components/ui/toast";
import type { Supplier } from "@/types/domain";

/**
 * Supplier Files tab — README §1.7 / §21, prototype lines 591..623.
 *
 * Presentations, catalogues, licences and quality documents collected before a
 * visit. Phase 1 has no supplier document storage, so every supplier is empty:
 * the approved empty state sits above the drop zone and the drop zone reports
 * which phase brings the upload pipeline rather than pretending to store a
 * file.
 */
export function FilesTab({ supplier }: { supplier: Supplier }) {
  const { toast } = useToast();

  return (
    <div style={{ maxWidth: 920 }}>
      <EmptyState
        className="mb-[14px]"
        message={EMPTY_STATE_COPY.noSupplierFiles}
      />

      <UploadZone
        variant="large"
        title="Drag & drop files here, or browse"
        description="PDF, DOCX, XLSX, images · up to 50 MB each"
        accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
        multiple
        onFiles={(files) =>
          toast(
            `Supplier document storage arrives in Phase 2 — ${files.length} file${
              files.length === 1 ? "" : "s"
            } not uploaded for ${supplier.shortName}`,
          )
        }
      />
    </div>
  );
}
