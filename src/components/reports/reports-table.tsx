"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type CSSProperties } from "react";

import { ReportStatusBadge } from "@/components/ui/badge";
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
import { archiveReport } from "@/lib/data/report-actions";
import type { ReportStatus } from "@/types/domain";

/**
 * Reports table — README §19 (Reports row), §1.3 (row actions).
 * Prototype lines 304..350; approved capture `screenshots/02-reports-list.png`.
 *
 * Columns: Document Number · Supplier · Visit Date · Owner · Status ·
 * Completion · Last Updated · Actions.
 *
 * Archive and Delete both archive (Phase 2 §33: a visit report is the record of
 * what was seen on a date, so it is never hard-deleted) behind the approved
 * confirmation, which says so. Duplicate, paging and the Word export are not
 * built; each says which of the three it is instead of naming a phase it will
 * not arrive in.
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
  /** 0–100, derived from the section predicates by the data layer (§6.2). */
  completion: number;
  lastUpdatedLabel: string;
}

export interface ReportsTableProps {
  rows: readonly ReportRow[];
  /** Reports in the database, not just the ones matching — the pager's "of 18". */
  totalCount: number;
  /** True while a search term or a status filter is narrowing `rows`. */
  filtered: boolean;
}

/** Which button opened the confirmation, so it can say what that button does. */
type ArchiveIntent = "archive" | "delete";

interface PendingArchive {
  row: ReportRow;
  intent: ArchiveIntent;
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

/**
 * README §22 — state what happens to the record, in the words of the action
 * that is actually taken. The Delete copy exists to correct the expectation the
 * button sets: nothing is deleted, and the user finds that out here rather than
 * after pressing it.
 */
function confirmCopy(pending: PendingArchive | null): {
  title: string;
  body: string;
} {
  if (!pending) return { title: "", body: "" };

  const record = `${pending.row.documentNumber} — ${pending.row.supplierShortName}`;
  if (pending.intent === "delete") {
    return {
      title: "Delete this report?",
      body:
        `${record}. A visit report is the record of what was seen and said on a date, so it is ` +
        "never deleted: it is archived instead. It leaves this list and the dashboard, keeps its " +
        "photographs and stays readable at its own address.",
    };
  }

  return {
    title: "Archive this report?",
    body:
      `${record}. It leaves this list and the dashboard and stays readable at its own address. ` +
      "Nothing is removed.",
  };
}

export function ReportsTable({ rows, totalCount, filtered }: ReportsTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState<PendingArchive | null>(null);
  const [archiving, startArchive] = useTransition();

  function confirmArchive() {
    if (!pending) return;
    const { row } = pending;

    startArchive(async () => {
      const result = await archiveReport(row.id);
      if (!result.ok) {
        // The dialog stays open with the message beside it, so the action can
        // be tried again or abandoned deliberately.
        toast(result.error.message, "error");
        return;
      }
      setPending(null);
      toast(`${row.documentNumber} archived — it stays readable at its own address.`);
      router.refresh();
    });
  }

  const copy = confirmCopy(pending);

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
                            "Duplicating a report is not built yet — create a new report and pick the same supplier.",
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
                        onClick={() => setPending({ row, intent: "archive" })}
                      />
                      <IconButton
                        variant="secondary"
                        name="trash"
                        label={`Delete ${row.documentNumber}`}
                        onClick={() => setPending({ row, intent: "delete" })}
                      />
                    </RowActions>
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      </TableFrame>

      {/* Pager — prototype lines 345..349. There is no paging behind it: the
          query returns every report that matches, so Previous is disabled and
          Next says what it would page through if there were pages. */}
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
            toast(
              "There are no further pages — every report that matches is already on this one.",
            )
          }
        >
          Next
        </Button>
      </div>

      <ConfirmModal
        open={pending !== null}
        onClose={() => {
          if (!archiving) setPending(null);
        }}
        onConfirm={confirmArchive}
        title={copy.title}
        body={copy.body}
        confirmLabel="Archive report"
        loading={archiving}
      />
    </>
  );
}
