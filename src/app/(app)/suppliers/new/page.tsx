import type { Metadata } from "next";

import { SupplierForm } from "@/components/suppliers/supplier-form";

/** README §1.8 — `/suppliers/new`. */
export const metadata: Metadata = {
  title: "Add Supplier",
};

export default function NewSupplierPage() {
  return <SupplierForm />;
}
