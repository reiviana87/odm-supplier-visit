import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { SupplierForm } from "@/components/suppliers/supplier-form";
import { ErrorState } from "@/components/ui/states";
import { getSupplier, getSupplierCertificates } from "@/lib/data/suppliers";

interface EditSupplierPageProps {
  params: Promise<{ id: string }>;
}

/** `generateMetadata` and the page both need the record; this reads it once. */
const loadSupplier = cache(getSupplier);

export async function generateMetadata({
  params,
}: EditSupplierPageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await loadSupplier(id);
  return { title: result.ok ? `Edit ${result.data.shortName}` : "Edit Supplier" };
}

/** The form sits in the same column the form itself uses. */
function FormError({ message }: { message: string }) {
  return (
    <div style={{ padding: "22px 24px 0", maxWidth: 960 }}>
      <ErrorState variant="page" message={message} />
    </div>
  );
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
  const supplier = await loadSupplier(id);

  if (!supplier.ok) {
    if (supplier.error.code === "not_found") notFound();
    return <FormError message={supplier.error.message} />;
  }

  const certificates = await getSupplierCertificates(id);

  // The form is the whole record: saving it writes block 05 back and deletes
  // the rows it no longer carries. So a certificate read that failed must stop
  // the screen — opening the form on an empty block 05 would quietly throw the
  // collected copies away on the next save.
  if (!certificates.ok) {
    return <FormError message={certificates.error.message} />;
  }

  return <SupplierForm supplier={supplier.data} certificates={certificates.data} />;
}
