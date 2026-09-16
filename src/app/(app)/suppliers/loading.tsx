import { PageShell } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/states";
import {
  Table,
  TableFrame,
  TableSkeleton,
  Th,
  Thead,
  Tr,
} from "@/components/ui/table";

/**
 * Suppliers list loading state — README §23: "skeleton of the real layout …
 * no spinner", 6–8 table rows at the real row height (44px default, §19).
 *
 * The header block repeats the geometry of `<PageHeader spacing={18}>` so the
 * page does not jump when the records arrive.
 */

/** Company · City · Region · Employees · Factory · Capacity · Certification · Sales contact · Status · Actions, with city and region merged. */
const COLUMN_COUNT = 9;

export default function SuppliersLoading() {
  return (
    <PageShell>
      <div role="status" aria-busy="true">
        <span className="sr-only">Loading suppliers…</span>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "16px",
            marginBottom: "18px",
          }}
        >
          <div
            className="flex flex-col"
            style={{ flex: 1, minWidth: 0, gap: "9px" }}
          >
            <Skeleton width={148} height={26} />
            <Skeleton width={300} height={11} />
          </div>
          <Skeleton width={152} height={36} className="flex-none" />
          <Skeleton width={126} height={36} className="flex-none" />
        </div>

        <TableFrame minWidth={1180}>
          <Table>
            <Thead>
              <Tr>
                {Array.from({ length: COLUMN_COUNT }, (_, column) => (
                  <Th key={column}>
                    <Skeleton height={8} width="62%" />
                  </Th>
                ))}
              </Tr>
            </Thead>
            <TableSkeleton rows={8} columns={COLUMN_COUNT} rowHeight={44} />
          </Table>
        </TableFrame>
      </div>
    </PageShell>
  );
}
