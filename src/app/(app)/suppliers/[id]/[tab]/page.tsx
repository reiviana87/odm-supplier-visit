import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import {
  SupplierHeader,
  isSupplierTab,
  type SupplierTabId,
} from "@/components/suppliers/supplier-header";
import { CertificatesTab } from "@/components/suppliers/tabs/certificates-tab";
import { ContactsTab } from "@/components/suppliers/tabs/contacts-tab";
import { FilesTab } from "@/components/suppliers/tabs/files-tab";
import { HistoryTab } from "@/components/suppliers/tabs/history-tab";
import { OverviewTab } from "@/components/suppliers/tabs/overview-tab";
import { ProductsTab } from "@/components/suppliers/tabs/products-tab";
import { ErrorState } from "@/components/ui/states";
import { listReports } from "@/lib/data/reports";
import { getSupplier, getSupplierCertificates } from "@/lib/data/suppliers";
import type { Supplier } from "@/types/domain";

/**
 * Supplier detail — README §1.7 / §8.2, prototype lines 424..652.
 *
 * `/suppliers/:id/:tab`, tab ∈ overview|contacts|products|certificates|files|
 * history (README §25). Every tab is its own URL, which is what makes the tab
 * strip a set of links and keeps a tab shareable and back-button-able.
 *
 * The record is read once per request and each tab asks for only what it draws:
 * the certificate copies, the visit history, or nothing at all.
 */

/** `generateMetadata` and the page both need the record; this reads it once. */
const loadSupplier = cache(getSupplier);

interface SupplierTabPageProps {
  params: Promise<{ id: string; tab: string }>;
}

export async function generateMetadata({
  params,
}: SupplierTabPageProps): Promise<Metadata> {
  const { id, tab } = await params;
  if (!isSupplierTab(tab)) return { title: "Supplier" };

  const result = await loadSupplier(id);
  return { title: result.ok ? result.data.shortName : "Supplier" };
}

async function TabPanel({
  tab,
  supplier,
}: {
  tab: SupplierTabId;
  supplier: Supplier;
}) {
  switch (tab) {
    case "overview": {
      // The photo strip's "All … photos" link needs the report those photos
      // belong to. A supplier with no photographs needs no query at all.
      const reports =
        supplier.visitPhotoIds.length > 0
          ? await listReports({ supplierId: supplier.id })
          : null;

      return (
        <OverviewTab
          supplier={supplier}
          latestReportId={reports?.ok ? (reports.data[0]?.id ?? null) : null}
        />
      );
    }
    case "contacts":
      return <ContactsTab supplier={supplier} />;
    case "products":
      return <ProductsTab supplier={supplier} />;
    case "certificates": {
      const certificates = await getSupplierCertificates(supplier.id);
      if (!certificates.ok) {
        return <ErrorState message={certificates.error.message} />;
      }
      return <CertificatesTab supplier={supplier} certificates={certificates.data} />;
    }
    case "files":
      return <FilesTab supplier={supplier} />;
    case "history": {
      const reports = await listReports({ supplierId: supplier.id });
      if (!reports.ok) {
        return <ErrorState message={reports.error.message} />;
      }
      return <HistoryTab reports={reports.data} />;
    }
  }
}

export default async function SupplierTabPage({ params }: SupplierTabPageProps) {
  const { id, tab } = await params;

  if (!isSupplierTab(tab)) notFound();

  const result = await loadSupplier(id);

  // A bad id and a record this user may not read are the same answer (§27), and
  // that answer is the 404 — not an error panel inside the supplier chrome.
  if (!result.ok) {
    if (result.error.code === "not_found") notFound();

    return (
      <div style={{ padding: "20px 24px 40px" }}>
        <ErrorState variant="page" message={result.error.message} />
      </div>
    );
  }

  return (
    <div className="anim-rise">
      <SupplierHeader supplier={result.data} activeTab={tab} />
      <div style={{ padding: "20px 24px 40px" }}>
        <TabPanel tab={tab} supplier={result.data} />
      </div>
    </div>
  );
}
