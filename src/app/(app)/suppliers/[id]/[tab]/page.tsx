import type { Metadata } from "next";
import { notFound } from "next/navigation";

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
import { getSupplier } from "@/lib/mock-data";
import type { Supplier } from "@/types/domain";

/**
 * Supplier detail — README §1.7 / §8.2, prototype lines 424..652.
 *
 * `/suppliers/:id/:tab`, tab ∈ overview|contacts|products|certificates|files|
 * history (README §25). Every tab is its own URL, which is what makes the tab
 * strip a set of links and keeps a tab shareable and back-button-able.
 */

interface SupplierTabPageProps {
  params: Promise<{ id: string; tab: string }>;
}

export async function generateMetadata({
  params,
}: SupplierTabPageProps): Promise<Metadata> {
  const { id, tab } = await params;
  const supplier = isSupplierTab(tab) ? getSupplier(id) : undefined;
  return { title: supplier ? supplier.shortName : "Supplier" };
}

function TabPanel({
  tab,
  supplier,
}: {
  tab: SupplierTabId;
  supplier: Supplier;
}) {
  switch (tab) {
    case "overview":
      return <OverviewTab supplier={supplier} />;
    case "contacts":
      return <ContactsTab supplier={supplier} />;
    case "products":
      return <ProductsTab supplier={supplier} />;
    case "certificates":
      return <CertificatesTab supplier={supplier} />;
    case "files":
      return <FilesTab supplier={supplier} />;
    case "history":
      return <HistoryTab supplier={supplier} />;
  }
}

export default async function SupplierTabPage({ params }: SupplierTabPageProps) {
  const { id, tab } = await params;

  if (!isSupplierTab(tab)) notFound();

  const supplier = getSupplier(id);
  if (!supplier) notFound();

  return (
    <div className="anim-rise">
      <SupplierHeader supplier={supplier} activeTab={tab} />
      <div style={{ padding: "20px 24px 40px" }}>
        <TabPanel tab={tab} supplier={supplier} />
      </div>
    </div>
  );
}
