"use client";

import { useId, useState } from "react";

import { Blueprint } from "@/components/ui/blueprint";
import { Button, IconButton } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import type { Report } from "@/types/domain";

/**
 * General Information — prototype lines 826..858.
 *
 * The report's own header fields as a bordered fact list: a 170px uppercase
 * label column, the value column, a hairline between rows. Below it the member
 * chips and the provenance line.
 *
 * Fields the report does not own are read-only: the document number is
 * allocated by the numbering rule (README §9) and the supplier name comes from
 * the snapshot frozen at creation (README §8.3).
 */

const ROW_STYLE = {
  display: "flex",
  gap: 14,
  padding: "9px 13px",
  alignItems: "center",
} as const;

const ROW_RULE = "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)";

const LABEL_STYLE = {
  width: 170,
  flex: "none",
  fontSize: 11.5,
  letterSpacing: ".04em",
  textTransform: "uppercase",
  color: "var(--color-neutral-600)",
} as const;

interface FactRow {
  key: string;
  label: string;
  value: string;
  /** Read-only rows render the value as text; the rest are compact inputs. */
  editable: boolean;
  type?: "text" | "time";
}

const EM_DASH = "—";

function value(raw: string | null): string {
  return raw ?? "";
}

function rowsFor(report: Report): FactRow[] {
  return [
    {
      key: "documentNumber",
      label: "Document Number",
      value: report.documentNumber,
      editable: false,
    },
    { key: "employee", label: "Employee", value: report.employee, editable: false },
    { key: "period", label: "Period", value: report.period, editable: true },
    {
      key: "supplierName",
      label: "Supplier Name",
      value: report.supplierSnapshot.legalName,
      editable: false,
    },
    { key: "visitDate", label: "Visit Date", value: report.visitDate, editable: true },
    {
      key: "location",
      label: "Visit Location",
      value: report.location,
      editable: true,
    },
    {
      key: "startTime",
      label: "Start Time",
      value: value(report.startTime),
      editable: true,
      type: "time",
    },
    {
      key: "endTime",
      label: "End Time",
      value: value(report.endTime),
      editable: true,
      type: "time",
    },
    { key: "project", label: "Project", value: value(report.project), editable: true },
    {
      key: "businessUnit",
      label: "Business Unit",
      value: value(report.businessUnit),
      editable: true,
    },
    {
      key: "productCategory",
      label: "Product Category",
      value: value(report.productCategory),
      editable: true,
    },
    {
      key: "reportOwner",
      label: "Report Owner",
      value: report.reportOwner,
      editable: false,
    },
  ];
}

/** "Reinaldo Alves" → "RA" — the 20px square in front of a member chip. */
function memberInitials(name: string): string {
  const parts = name.split(/\s+/).filter((part) => part.length > 0);
  const letters = parts.slice(0, 2).map((part) => part.charAt(0));
  return letters.join("").toUpperCase() || "?";
}

export function GeneralSection({ report }: { report: Report }) {
  const { toast } = useToast();
  const fieldId = useId();
  const rows = rowsFor(report);

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((row) => [row.key, row.value])),
  );

  return (
    <div style={{ maxWidth: 760 }}>
      <Blueprint style={{ padding: 0, marginBottom: 16 }}>
        {rows.map((row, index) => {
          const controlId = `${fieldId}-${row.key}`;
          const last = index === rows.length - 1;

          return (
            <div
              key={row.key}
              style={{
                ...ROW_STYLE,
                borderBottom: last ? undefined : ROW_RULE,
              }}
            >
              <label style={LABEL_STYLE} htmlFor={row.editable ? controlId : undefined}>
                {row.label}
              </label>
              {row.editable ? (
                <Input
                  compact
                  id={controlId}
                  type={row.type ?? "text"}
                  value={values[row.key] ?? ""}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [row.key]: event.target.value,
                    }))
                  }
                  style={{ flex: 1, minWidth: 0, background: "var(--color-bg)" }}
                />
              ) : (
                <span style={{ flex: 1, fontSize: 13 }}>
                  {row.value.length > 0 ? row.value : EM_DASH}
                </span>
              )}
            </div>
          );
        })}
      </Blueprint>

      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 11.5,
            letterSpacing: ".04em",
            textTransform: "uppercase",
            color: "var(--color-neutral-600)",
            marginBottom: 7,
          }}
        >
          Members
        </div>
        <div className="flex flex-wrap items-center" style={{ gap: 7 }}>
          {report.members.map((member) => (
            <span
              key={member}
              className="flex items-center"
              style={{
                gap: 7,
                border: "1px solid var(--color-divider)",
                padding: "4px 9px 4px 5px",
                fontSize: 12.5,
              }}
            >
              <span
                aria-hidden="true"
                className="grid place-items-center"
                style={{
                  width: 20,
                  height: 20,
                  background: "var(--color-accent-100)",
                  color: "var(--color-accent-800)",
                  fontSize: 9.5,
                  fontFamily: "var(--font-heading)",
                  fontWeight: 600,
                }}
              >
                {memberInitials(member)}
              </span>
              {member}
              <IconButton
                label={`Remove ${member}`}
                name="x"
                size={16}
                iconSize={12}
                className="text-neutral-500"
                onClick={() =>
                  toast("Editing the member list arrives with report persistence (Phase 2)")
                }
              />
            </span>
          ))}
          <Button
            size="compact"
            icon="plus"
            onClick={() =>
              toast("Editing the member list arrives with report persistence (Phase 2)")
            }
          >
            Add member
          </Button>
        </div>
      </div>

      <div
        className="flex"
        style={{
          gap: 22,
          fontSize: 12,
          color: "var(--color-neutral-600)",
          borderTop: "1px solid var(--color-divider)",
          paddingTop: 12,
        }}
      >
        <span>Owned by {report.reportOwner}</span>
        <span>Last updated {report.lastUpdatedLabel}</span>
        <span>
          <Button
            variant="ghost"
            size="compact"
            style={{ padding: 0, fontSize: 12 }}
            onClick={() =>
              toast("Version history arrives with report persistence (Phase 2)")
            }
          >
            Version history
          </Button>
        </span>
      </div>
    </div>
  );
}
