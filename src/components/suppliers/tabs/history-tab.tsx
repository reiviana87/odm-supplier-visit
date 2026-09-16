"use client";

import Link from "next/link";

import { ReportStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { CompletionIndicator } from "@/components/ui/progress";
import { EMPTY_STATE_COPY, EmptyState } from "@/components/ui/states";
import {
  Table,
  TableFrame,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@/components/ui/table";
import { REPORTS } from "@/lib/mock-data";
import type { Supplier } from "@/types/domain";

/**
 * Supplier Visit History tab — README §1.7 / §21, prototype lines 624..652.
 *
 * Every visit report bound to this supplier. The document number is the
 * affordance: it opens the report editor at General Information.
 *
 * Rendered on the client only because `EMPTY_STATE_COPY` is exported from the
 * `"use client"` states module: read from a Server Component it arrives as a
 * client reference and the approved sentence renders blank.
 */
export function HistoryTab({ supplier }: { supplier: Supplier }) {
  const reports = REPORTS.filter((report) => report.supplierId === supplier.id);

  if (reports.length === 0) {
    return (
      <EmptyState
        className="max-w-[1000px]"
        message={EMPTY_STATE_COPY.noSupplierVisits}
        action={
          <ButtonLink
            variant="primary"
            size="compact"
            icon="plus"
            href="/reports/new"
          >
            New Visit Report
          </ButtonLink>
        }
      />
    );
  }

  return (
    <TableFrame style={{ maxWidth: 1000 }}>
      <Table>
        <Thead>
          <Tr>
            <Th>Document Number</Th>
            <Th>Visit Date</Th>
            <Th>Owner</Th>
            <Th>Status</Th>
            <Th width={104}>Completion</Th>
          </Tr>
        </Thead>
        <Tbody>
          {reports.map((report) => (
            <Tr key={report.id}>
              <Td nowrap>
                <Link
                  href={`/reports/${report.id}/general`}
                  className="hover:underline"
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontWeight: 600,
                    fontSize: "13.5px",
                    color: "var(--color-text)",
                  }}
                >
                  {report.documentNumber}
                </Link>
              </Td>
              <Td nowrap style={{ fontSize: "12.5px", color: "var(--color-neutral-700)" }}>
                {report.visitDate}
              </Td>
              <Td style={{ fontSize: "12.5px", color: "var(--color-neutral-700)" }}>
                {report.employee}
              </Td>
              <Td>
                <ReportStatusBadge status={report.status} />
              </Td>
              <Td>
                <CompletionIndicator
                  value={report.completion}
                  variant="inline"
                  label={`${report.documentNumber} completion`}
                />
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </TableFrame>
  );
}
