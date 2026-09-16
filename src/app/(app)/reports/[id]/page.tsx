import { redirect } from "next/navigation";

/**
 * `/reports/:id` has no editor of its own — README §25 lists
 * `/reports/:id/:section` as the route. Opening a report lands on §1 Purpose,
 * the first writing section (General Information is header metadata).
 */
export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/reports/${id}/purpose`);
}
