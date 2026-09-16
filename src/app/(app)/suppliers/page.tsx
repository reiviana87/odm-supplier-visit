import type { Metadata } from "next";

import {
  SuppliersHeaderActions,
  SuppliersTable,
} from "@/components/suppliers/suppliers-table";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { SUPPLIER_COUNT_LABEL, SUPPLIERS } from "@/lib/mock-data";

/**
 * Suppliers list — README §1.6, §8.2, §19; prototype lines 351..423.
 *
 * The supplier master database built from the Excel data sheet requested from
 * every new supplier. The page itself is static chrome; the filter bar, the
 * sortable table and the two header controls are the client surface
 * (`suppliers-table.tsx`).
 */

export const metadata: Metadata = {
  title: "Suppliers",
};

export default function SuppliersPage() {
  return (
    <PageShell>
      <PageHeader
        title="Suppliers"
        subtitle={`ODM supplier database · ${SUPPLIER_COUNT_LABEL}`}
        actions={<SuppliersHeaderActions />}
        spacing={18}
      />
      <SuppliersTable suppliers={SUPPLIERS} />
    </PageShell>
  );
}
