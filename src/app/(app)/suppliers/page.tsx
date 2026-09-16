import type { Metadata } from "next";

import {
  queryFiltersFromSearchParams,
  toListOptions,
} from "@/components/suppliers/supplier-list-filters";
import {
  SuppliersHeaderActions,
  SuppliersTable,
} from "@/components/suppliers/suppliers-table";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { ErrorState } from "@/components/ui/states";
import { countSuppliers, listSuppliers } from "@/lib/data/suppliers";

/**
 * Suppliers list — README §1.6, §8.2, §19; prototype lines 351..423.
 *
 * The supplier master database built from the Excel data sheet requested from
 * every new supplier. The rows and the subtitle come from the data layer; the
 * four filters the query can answer arrive as search params, so a filtered list
 * is a real address (`/suppliers?country=China&sheet=pending`). The filter bar,
 * the sortable table and the two header controls are the client surface
 * (`suppliers-table.tsx`).
 */

export const metadata: Metadata = {
  title: "Suppliers",
};

interface SuppliersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SuppliersPage({ searchParams }: SuppliersPageProps) {
  const filters = queryFiltersFromSearchParams(await searchParams);

  const [suppliers, counts] = await Promise.all([
    listSuppliers(toListOptions(filters)),
    countSuppliers(),
  ]);

  // The subtitle counts the database, not the filtered view (README §1.6), so a
  // failed count drops the sentence rather than reporting a wrong total.
  const subtitle = counts.ok
    ? `ODM supplier database · ${counts.data.total} records · ${counts.data.dataSheetsReceived} data sheets received`
    : "ODM supplier database";

  return (
    <PageShell>
      <PageHeader
        title="Suppliers"
        subtitle={subtitle}
        actions={<SuppliersHeaderActions />}
        spacing={18}
      />
      {suppliers.ok ? (
        <SuppliersTable suppliers={suppliers.data} filters={filters} />
      ) : (
        <ErrorState variant="page" message={suppliers.error.message} />
      )}
    </PageShell>
  );
}
