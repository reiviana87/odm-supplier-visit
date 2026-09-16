"use client";

import { Fragment } from "react";

import { Tag } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  Table,
  TableFrame,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { PLACEHOLDER_MAPPINGS } from "@/lib/mock-data";

/**
 * Placeholder mapping — README §16, transcribed from the approved prototype
 * (design-handoff/ODM Supplier Visit.dc.html lines 1544..1580).
 *
 * "A placeholder present in the template but unmapped, or mapped but missing
 * from the template, is flagged `#8a6a12` in the status column" — that is
 * `var(--color-warning-strong)`, on the prototype's warning ground.
 */

const UNMAPPED = PLACEHOLDER_MAPPINGS.filter((mapping) => !mapping.isMapped);

/** Re-reading the `.docx` is part of the Word pipeline (Phase 5). */
export function RescanTemplateButton() {
  const { toast } = useToast();

  return (
    <Button
      variant="secondary"
      icon="refresh"
      onClick={() =>
        toast(
          "Re-scanning the template lands in Phase 5 — the mapping below is unchanged.",
        )
      }
    >
      Re-scan template
    </Button>
  );
}

export function MappingTable() {
  return (
    <TableFrame style={{ marginBottom: 20 }}>
      <Table>
        <Thead>
          <Tr>
            <Th width={250}>Word Placeholder</Th>
            <Th>App Field</Th>
            <Th>Sample value</Th>
            <Th width={88}>Status</Th>
          </Tr>
        </Thead>
        <Tbody>
          {PLACEHOLDER_MAPPINGS.map((mapping) => (
            <Tr key={mapping.placeholder}>
              <Td className="mono" style={{ color: "var(--color-accent-800)" }}>
                {mapping.placeholder}
              </Td>
              <Td style={{ fontSize: 12.5 }}>{mapping.source}</Td>
              <Td style={{ fontSize: 12, color: "var(--color-neutral-700)", maxWidth: 300 }}>
                {mapping.sampleValue}
              </Td>
              <Td>
                {mapping.isMapped ? (
                  <Tag tone="accent">Bound</Tag>
                ) : (
                  <Tag tone="warning" style={{ color: "var(--color-warning-strong)" }}>
                    Empty
                  </Tag>
                )}
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </TableFrame>
  );
}

/**
 * The band under the table — prototype lines 1576..1579. It only appears while
 * something in the mapping resolves to nothing; the count and the placeholder
 * names come from the data.
 */
export function MappingWarning() {
  if (UNMAPPED.length === 0) return null;

  const one = UNMAPPED.length === 1;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 9,
        padding: "11px 13px",
        border: "1px solid var(--color-warning-border)",
        background: "var(--color-warning-bg)",
        fontSize: 12.5,
        lineHeight: 1.6,
      }}
    >
      <Icon
        name="alert"
        size={14}
        style={{ marginTop: 2, flex: "none", color: "var(--color-warning-ink)" }}
      />
      {/* #5f4610 is the prototype's band ink; it has no token of its own. */}
      <span style={{ color: "#5f4610" }}>
        <strong style={{ fontWeight: 500 }}>
          {UNMAPPED.length} placeholder{one ? "" : "s"} resolve{one ? "s" : ""} to
          empty:
        </strong>{" "}
        {UNMAPPED.map((mapping, index) => (
          <Fragment key={mapping.placeholder}>
            {index > 0 ? ", " : null}
            <span className="mono">{mapping.placeholder}</span>
          </Fragment>
        ))}{" "}
        — the source section has not been written. The export will leave the
        heading with no body text unless you generate or write it first.
      </span>
    </div>
  );
}
