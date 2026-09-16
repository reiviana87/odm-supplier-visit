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
 * Reports list loading state — README §23: "skeleton of the real layout", six
 * to eight table rows at the real row height, never a spinner.
 *
 * The header block and the column headings are the real geometry of
 * `page.tsx`: 18px under the header, the two action buttons at 36px, and the
 * eight approved columns above the skeleton rows.
 */
export default function ReportsLoading() {
  return (
    <PageShell>
      <div
        className="flex items-end"
        style={{ gap: 16, marginBottom: 18 }}
        aria-hidden="true"
      >
        <div className="flex flex-col" style={{ flex: 1, gap: 7 }}>
          <Skeleton width={124} height={26} />
          <Skeleton width={296} height={10} />
        </div>
        <Skeleton width={152} height={36} className="flex-none" />
        <Skeleton width={152} height={36} className="flex-none" />
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        Loading reports
      </div>

      <TableFrame>
        <Table>
          <Thead>
            <Tr>
              <Th>Document Number</Th>
              <Th>Supplier</Th>
              <Th>Visit Date</Th>
              <Th>Owner</Th>
              <Th>Status</Th>
              <Th width={104}>Completion</Th>
              <Th>Last Updated</Th>
              <Th align="right" width={126}>
                Actions
              </Th>
            </Tr>
          </Thead>
          <TableSkeleton rows={6} columns={8} />
        </Table>
      </TableFrame>
    </PageShell>
  );
}
