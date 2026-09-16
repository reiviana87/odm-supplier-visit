import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SupplierForm } from "@/components/suppliers/supplier-form";
import { CERTIFICATES_BY_SUPPLIER, getSupplier } from "@/lib/mock-data";

interface EditSupplierPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: EditSupplierPageProps): Promise<Metadata> {
  const { id } = await params;
  const supplier = getSupplier(id);
  return { title: supplier ? `Edit ${supplier.shortName}` : "Edit Supplier" };
}

/**
 * README §1.8 — `/suppliers/:id/edit`.
 *
 * The live master record feeds the form; the certificate copies already
 * collected for this supplier fill block 05 (README §8.3 — this screen edits
 * master data, never a report snapshot).
 */
export default async function EditSupplierPage({ params }: EditSupplierPageProps) {
  const { id } = await params;
  const supplier = getSupplier(id);

  if (!supplier) {
    notFound();
  }

  return (
    <SupplierForm
      supplier={supplier}
      certificates={CERTIFICATES_BY_SUPPLIER[supplier.id] ?? []}
    />
  );
}
