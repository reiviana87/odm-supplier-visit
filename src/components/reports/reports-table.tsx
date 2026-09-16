"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";

import { ReportStatusBadge, Tag } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/modal";
import { CompletionIndicator } from "@/components/ui/progress";
import { EMPTY_STATE_COPY, EmptyState } from "@/components/ui/states";
import {
  RowActions,
  Table,
  TableFrame,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import type { ReportStatus } from "@/types/domain";

/**
 * Reports table — README §19 (Reports row), §1.3 (row actions).
 * Prototype lines 304..350; approved capture `screenshots/02-reports-list.png`.
 *
 * Columns: Document Number · Supplier · Visit Date · Owner · Status ·
 * Completion · Last Updated · Actions.
 *
 * Phase 1 boundary: duplicate, export, archive and paging are reported through
 * a toast naming the phase they land in; delete opens the approved confirm
 * modal (README §1.3) and then says the same, because removing a row from a
 * seeded list would present a deletion that did not happen.
 */

export interface ReportRow {
  id: string;
  documentNumber: string;
  supplierShortName: string;
  /** "City, Region" — the second line of the supplier cell. */
  location: string;
  visitDate: string;
  employee: string;
  status: ReportStatus;
  /** 0–100. See `completionFor()` on the page for where the number comes from. */
  completion: number;
  lastUpdatedLabel: string;
}

export interface ReportsTableProps {
  rows: readonly ReportRow[];
  /** The report open in the editor — it carries the `OPEN` tag (screenshot 02). */
  openReportId?: string;
  /** Reports in the database, not just on this page — the pager's "of 18". */
  totalCount: number;
  /** True while a search term or a status filter is narrowing `rows`. */
  filtered: boolean;
}

/** A local override of the accent token, read by the progress fill. */
type AccentOverride = CSSProperties & Record<"--color-accent", string>;

/**
 * Prototype line 2672 — a part-complete bar is drawn in `--color-accent-400`
 * and only a finished report gets the full accent. `CompletionIndicator` fills
 * with `var(--color-accent)`, so the lighter tone is applied by rebinding that
 * token on the cell rather than by re-implementing the bar.
 */
function barTone(value: number): AccentOverride | undefined {
  return value >= 100
    ? undefined
    : { "--color-accent": "var(--color-accent-400)" };
}

function sectionHref(id: string): string {
  return `/reports/${id}/purpose`;
}

export function ReportsTable({
  rows,
  openReportId,
  totalCount,
  filtered,
}: ReportsTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pendingDelete, setPendingDelete] = useState<ReportRow | null>(null);

  return (
    <>
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

          <Tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: "12px 0 14px" }}>
                  <EmptyState
                    message={
                      filtered
                        ? // README §21 has no copy for a filtered-empty reports
                          // table; this states the situation and the way out.
                          "No reports match this search and status filter."
                        : EMPTY_STATE_COPY.noReports
                    }
                  />
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <Tr
                  key={row.id}
                  clickable
                  onClick={() => router.push(sectionHref(row.id))}
                >
                  <Td nowrap>
                    <Link
                      href={sectionHref(row.id)}
                      className="font-heading text-text! no-underline hover:text-accent-700!"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        fontWeight: 600,
                        fontSize: 13.5,
                      }}
                    >
                      {row.documentNumber}
                      {row.id === openReportId ? (
                        <Tag
                          tone="outline-accent"
                          style={{
                            fontSize: 9.5,
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            padding: "1px 5px",
                            borderColor: "var(--color-accent-300)",
                          }}
                        >
                          Open
                        </Tag>
                      ) : null}
                    </Link>
                  </Td>

                  <Td style={{ fontSize: 12.5 }}>
                    {row.supplierShortName}
                    <div
                      style={{ fontSize: 11, color: "var(--color-neutral-600)" }}
                    >
                      {row.location}
                    </div>
                  </Td>

                  <Td
                    nowrap
                    style={{ fontSize: 12.5, color: "var(--color-neutral-700)" }}
                  >
                    {row.visitDate}
                  </Td>

                  <Td style={{ fontSize: 12.5, color: "var(--color-neutral-700)" }}>
                    {row.employee}
                  </Td>

                  <Td>
                    <ReportStatusBadge status={row.status} />
                  </Td>

                  <Td style={barTone(row.completion)}>
                    <CompletionIndicator
                      variant="inline"
                      value={row.completion}
                      label={`${row.documentNumber} completion`}
                    />
                  </Td>

                  <Td
                    nowrap
                    style={{ fontSize: 12, color: "var(--color-neutral-600)" }}
                  >
                    {row.lastUpdatedLabel}
                  </Td>

                  <Td>
                    <RowActions>
                      <IconButton
                        variant="secondary"
                        name="pencil"
                        label={`Open ${row.documentNumber}`}
                        onClick={() => router.push(sectionHref(row.id))}
                      />
                      <IconButton
                        variant="secondary"
                        name="copy"
                        label={`Duplicate ${row.documentNumber}`}
                        onClick={() =>
                          toast(
                            "Duplicate arrives with report persistence (Phase 2)",
                          )
                        }
                      />
                      <IconButton
                        variant="secondary"
                        name="download"
                        label={`Export ${row.documentNumber} to Word`}
                        onClick={() => toast("Word export arrives in Phase 5")}
                      />
                      <IconButton
                        variant="secondary"
                        name="archive"
                        label={`Archive ${row.documentNumber}`}
                        onClick={() =>
                          toast(
                            "Archive arrives with report persistence (Phase 2)",
                          )
                        }
                      />
                      <IconButton
                        variant="secondary"
                        name="trash"
                        label={`Delete ${row.documentNumber}`}
                        onClick={() => setPendingDelete(row)}
                      />
                    </RowActions>
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      </TableFrame>

      {/* Pager — prototype lines 345..349. README §19 marks pagination
          [INFERRED]: the seeded rows fit one page, so Previous is disabled and
          Next reports that there is nothing further to page to. */}
      <div
        className="flex items-center"
        style={{
          gap: 12,
          marginTop: 12,
          fontSize: 12,
          color: "var(--color-neutral-600)",
        }}
      >
        <span aria-live="polite">
          Showing {rows.length} of {totalCount}
        </span>
        <div style={{ flex: 1 }} />
        <Button variant="secondary" size="compact" icon="left" disabled>
          Previous
        </Button>
        <Button
          variant="secondary"
          size="compact"
          trailingIcon="right"
          onClick={() =>
            toast("Paging arrives with the Supabase queries (Phase 2)")
          }
        >
          Next
        </Button>
      </div>

      <ConfirmModal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          setPendingDelete(null);
          toast("Delete arrives with report persistence (Phase 2)");
        }}
        title="Delete this report?"
        body={
          pendingDelete
            ? `${pendingDelete.documentNumber} — ${pendingDelete.supplierShortName}. The report, its photos and its transcript will be moved to trash. Recoverable for 30 days, after which deletion is permanent.`
            : ""
        }
        confirmLabel="Delete report"
        destructive
      />
    </>
  );
}
