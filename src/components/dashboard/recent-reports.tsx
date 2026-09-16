"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";

import { ReportStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
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
import type { ReportSummary } from "@/types/domain";

/**
 * Dashboard — "Recent Reports" table (README §1.2, prototype lines 215..233).
 *
 * The frame is the shared table blueprint at the dashboard's measured padding
 * `2px 10px 4px`; cells are the dense 12.5px set with the date and owner in
 * `--color-neutral-700` and the last-edit column right-aligned at 12px in
 * `--color-neutral-600`.
 *
 * Client component for two reasons, both real:
 *   • the prototype's rows are clickable (`cursor:pointer` + `open()`), which
 *     needs a router — the document-number link in the first cell stays the
 *     real, keyboard-reachable affordance and `<Tr>` swallows clicks that start
 *     on it, so the row never double-fires;
 *   • `EMPTY_STATE_COPY` lives in a "use client" module, and a Server Component
 *     cannot dot into a client module's exports.
 */

const DOCUMENT_LINK: CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontWeight: 600,
  fontSize: "13.5px",
  color: "var(--color-text)",
  textDecoration: "none",
};

const CELL: CSSProperties = { fontSize: "12.5px" };
const CELL_MUTED: CSSProperties = {
  fontSize: "12.5px",
  color: "var(--color-neutral-700)",
};
const CELL_UPDATED: CSSProperties = {
  fontSize: "12px",
  color: "var(--color-neutral-600)",
};

/** Every row opens the editor on §1 Purpose (README §25 route map). */
function reportHref(report: ReportSummary) {
  return `/reports/${report.id}/purpose`;
}

export interface RecentReportsProps {
  /** The dashboard shows the five most recent rows. */
  reports: readonly ReportSummary[];
}

export function RecentReports({ reports }: RecentReportsProps) {
  const router = useRouter();

  if (reports.length === 0) {
    return (
      <EmptyState
        message={EMPTY_STATE_COPY.noReports}
        action={
          <ButtonLink
            href="/reports/new"
            variant="primary"
            size="compact"
            icon="plus"
          >
            New Visit Report
          </ButtonLink>
        }
      />
    );
  }

  return (
    <TableFrame style={{ padding: "2px 10px 4px" }}>
      <Table>
        <Thead>
          <Tr>
            <Th>Document</Th>
            <Th>Supplier</Th>
            <Th>Visit Date</Th>
            <Th>Owner</Th>
            <Th>Status</Th>
            <Th align="right">Last Updated</Th>
          </Tr>
        </Thead>
        <Tbody>
          {reports.map((report) => (
            <Tr
              key={report.id}
              clickable
              onClick={() => router.push(reportHref(report))}
            >
              <Td nowrap style={CELL}>
                <Link
                  href={reportHref(report)}
                  className="hover:underline"
                  style={DOCUMENT_LINK}
                >
                  {report.documentNumber}
                </Link>
              </Td>
              <Td style={CELL}>{report.supplierShortName}</Td>
              <Td nowrap style={CELL_MUTED}>
                {report.visitDate}
              </Td>
              <Td style={CELL_MUTED}>{report.employee}</Td>
              <Td>
                <ReportStatusBadge status={report.status} />
              </Td>
              <Td align="right" nowrap style={CELL_UPDATED}>
                {report.lastUpdatedLabel}
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </TableFrame>
  );
}
