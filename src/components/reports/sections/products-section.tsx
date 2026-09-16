"use client";

import { useId, useState } from "react";

import { useSectionDraft } from "@/components/reports/section-draft";
import { Tag } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/states";
import {
  Table,
  TableFrame,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  RowActions,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import type { Report } from "@/types/domain";

import { AiActionsRow, aiActionMessage } from "./prose-section";

/**
 * §4 Main Products — prototype lines 940..1019.
 *
 * Prose first, then the **optional** construction table. README §25: "Optional
 * is stated in the UI, not implied: the §4 product table and the §6 Q&A block
 * both carry an `Optional` tag and an explicit exclude control." The section
 * completes on the prose alone (README §6.2), so excluding the table never
 * blocks the report.
 */

const PRODUCTS_AI_ACTIONS = [
  "Improve with AI",
  "Extract Main Products from Transcript",
] as const;

/** Prototype line 954 — the sentence that states what "optional" means here. */
const OPTIONAL_NOTE = "Omitted from the report if left empty";

/**
 * The §4 rows are carried as they were imported: nothing writes
 * `report_product_rows` yet, so the controls say that rather than naming a
 * phase they are not in.
 */
const TABLE_READ_ONLY =
  "The §4 construction table cannot be edited yet — the prose above is saved, and the table is carried as it was imported.";

export function ProductsSection({ report }: { report: Report }) {
  const { toast } = useToast();
  const labelId = useId();

  // The prose is the section body, held and autosaved by the editor shell.
  const { draft, setBody } = useSectionDraft("products");
  const text = draft.body;
  const [included, setIncluded] = useState(true);

  const rows = report.sections.productRows;

  return (
    <div style={{ maxWidth: 900 }}>
      <AiActionsRow
        actions={PRODUCTS_AI_ACTIONS}
        onAction={(action) => toast(aiActionMessage(action))}
      />

      <label className="sr-only" htmlFor={labelId}>
        Main Products
      </label>
      <Textarea
        prose
        id={labelId}
        value={text}
        onChange={(event) => setBody(event.target.value)}
        minHeight={120}
        placeholder="Describe the product families the supplier manufactures…"
      />

      <div
        className="flex flex-wrap items-center"
        style={{ gap: 10, margin: "18px 0 8px" }}
      >
        <h6 style={{ margin: 0 }}>Product Table</h6>
        <Tag tone="outline">Optional</Tag>
        <Tag tone="neutral">
          {rows.length} {rows.length === 1 ? "row" : "rows"}
        </Tag>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: "var(--color-neutral-600)" }}>
          {OPTIONAL_NOTE}
        </span>
        <Button
          variant="ghost"
          size="compact"
          aria-pressed={!included}
          style={{ fontSize: 11.5, color: "var(--color-neutral-700)" }}
          onClick={() => setIncluded((current) => !current)}
        >
          {included ? "Exclude from report" : "Include in report"}
        </Button>
        <Button
          size="compact"
          icon="plus"
          onClick={() => toast(TABLE_READ_ONLY)}
        >
          Add row
        </Button>
      </div>

      {!included ? (
        <EmptyState
          message="Product table excluded from this report — §4 will contain the description only."
          action={
            <Button size="compact" onClick={() => setIncluded(true)}>
              Include again
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          message={OPTIONAL_NOTE}
          action={
            <Button
              size="compact"
              icon="plus"
              onClick={() => toast(TABLE_READ_ONLY)}
            >
              Add row
            </Button>
          }
        />
      ) : (
        <TableFrame>
          <Table>
            <Thead>
              <Tr>
                <Th width={180}>Type</Th>
                <Th width={170}>Standard</Th>
                <Th width={130}>Voltage</Th>
                <Th>Description</Th>
                <Th align="right" width={40}>
                  <span className="sr-only">Actions</span>
                </Th>
              </Tr>
            </Thead>
            <Tbody>
              {rows.map((row) => (
                <Tr key={row.id}>
                  <Td>
                    <span
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontWeight: 600,
                        fontSize: 13.5,
                      }}
                    >
                      {row.type}
                    </span>
                  </Td>
                  <Td nowrap style={{ fontSize: 12.5 }}>
                    {row.standard}
                  </Td>
                  <Td nowrap style={{ fontSize: 12.5 }}>
                    {row.voltage}
                  </Td>
                  <Td style={{ fontSize: 12.5 }}>{row.description}</Td>
                  <Td align="right">
                    <RowActions>
                      <IconButton
                        label={`Delete ${row.type}`}
                        name="trash"
                        size={24}
                        className="text-neutral-500"
                        onClick={() =>
                          toast(TABLE_READ_ONLY)
                        }
                      />
                    </RowActions>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableFrame>
      )}
    </div>
  );
}
