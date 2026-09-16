import { redirect } from "next/navigation";

/**
 * `/suppliers/:id` has no screen of its own — README §25 defines the supplier
 * detail as `/suppliers/:id/:tab`, and Overview is the tab that opens first.
 */
export default async function SupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/suppliers/${id}/overview`);
}
