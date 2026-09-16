"use client";

import { useCallback, useId, useRef, useState, useTransition } from "react";

import { Blueprint } from "@/components/ui/blueprint";
import { Button, IconButton } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { updateReportMeta } from "@/lib/data/report-actions";
import type { ReportMetaValues } from "@/lib/data/report-mappers";
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
 *
 * The editable rows and the chips are `reports` columns rather than section
 * bodies, so they go through `updateReportMeta` rather than the section
 * autosave — one field at a time, when the user leaves it, because a fact list
 * is corrected rather than written.
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

/** The report columns this list can correct — `ReportMetaValues`'s own names. */
type MetaKey = Extract<
  keyof ReportMetaValues,
  | "period"
  | "visitDate"
  | "location"
  | "startTime"
  | "endTime"
  | "project"
  | "businessUnit"
  | "productCategory"
>;

interface FactRow {
  key: string;
  label: string;
  value: string;
  /** Read-only rows render the value as text; the rest are compact inputs. */
  editable: boolean;
  type?: "text" | "time";
  /** The column an edit writes to. Present on exactly the editable rows. */
  metaKey?: MetaKey;
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
    {
      key: "period",
      label: "Period",
      value: report.period,
      editable: true,
      metaKey: "period",
    },
    {
      key: "supplierName",
      label: "Supplier Name",
      value: report.supplierSnapshot.legalName,
      editable: false,
    },
    {
      key: "visitDate",
      label: "Visit Date",
      value: report.visitDate,
      editable: true,
      metaKey: "visitDate",
    },
    {
      key: "location",
      label: "Visit Location",
      value: report.location,
      editable: true,
      metaKey: "location",
    },
    {
      key: "startTime",
      label: "Start Time",
      value: value(report.startTime),
      editable: true,
      type: "time",
      metaKey: "startTime",
    },
    {
      key: "endTime",
      label: "End Time",
      value: value(report.endTime),
      editable: true,
      type: "time",
      metaKey: "endTime",
    },
    {
      key: "project",
      label: "Project",
      value: value(report.project),
      editable: true,
      metaKey: "project",
    },
    {
      key: "businessUnit",
      label: "Business Unit",
      value: value(report.businessUnit),
      editable: true,
      metaKey: "businessUnit",
    },
    {
      key: "productCategory",
      label: "Product Category",
      value: value(report.productCategory),
      editable: true,
      metaKey: "productCategory",
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

/**
 * The visit date as the column stores it, `yyyy-mm-dd`.
 *
 * The row prints the display date — "Aug 12, 2026" — and is edited as text, so
 * what comes back has to be read as a calendar date again. An ISO date is taken
 * as written (parsing it through `Date` would shift a day west of Greenwich);
 * anything else is parsed and re-formatted from its local parts. `null` when it
 * is not a date at all, which the caller reports rather than sends.
 */
function toStoredDate(input: string): string | null {
  const trimmed = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;

  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${parsed.getFullYear()}-${month}-${day}`;
}

const DATE_UNREADABLE =
  "That is not a date this can read — write it like Aug 12, 2026.";

export function GeneralSection({ report }: { report: Report }) {
  const { toast } = useToast();
  const fieldId = useId();
  const memberFieldId = useId();
  const rows = rowsFor(report);

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((row) => [row.key, row.value])),
  );
  const [members, setMembers] = useState<readonly string[]>(() => report.members);
  const [adding, setAdding] = useState(false);
  const [newMember, setNewMember] = useState("");
  const [, startSave] = useTransition();

  /** What the server is known to hold, so an untouched field is not re-sent. */
  const stored = useRef<Record<string, string>>(
    Object.fromEntries(rows.map((row) => [row.key, row.value])),
  );

  const write = useCallback(
    (patch: ReportMetaValues) => {
      startSave(async () => {
        const result = await updateReportMeta(report.id, patch);
        if (!result.ok) toast(result.error.message, "error");
      });
    },
    [report.id, toast],
  );

  /** README §9 — a fact is corrected when the user leaves the field. */
  const commitField = useCallback(
    (row: FactRow) => {
      const metaKey = row.metaKey;
      if (!metaKey) return;

      const next = values[row.key] ?? "";
      if (next === stored.current[row.key]) return;

      if (metaKey === "visitDate") {
        const date = toStoredDate(next);
        if (date === null) {
          toast(DATE_UNREADABLE, "warning");
          return;
        }
        // The row goes on printing what was typed until the page is read again,
        // which is what the user is looking at; the column gets the calendar
        // date it is declared as.
        stored.current = { ...stored.current, [row.key]: next };
        write({ visitDate: date });
        return;
      }

      stored.current = { ...stored.current, [row.key]: next };
      write({ [metaKey]: next } as ReportMetaValues);
    },
    [toast, values, write],
  );

  const removeMember = useCallback(
    (name: string) => {
      const next = members.filter((member) => member !== name);
      setMembers(next);
      write({ members: [...next] });
    },
    [members, write],
  );

  const addMember = useCallback(() => {
    const name = newMember.trim();
    setNewMember("");
    setAdding(false);
    if (name === "" || members.includes(name)) return;

    const next = [...members, name];
    setMembers(next);
    write({ members: next });
  }, [members, newMember, write]);

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
                  onBlur={() => commitField(row)}
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
          {members.map((member) => (
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
                onClick={() => removeMember(member)}
              />
            </span>
          ))}

          {/* The approved row is chips plus one "Add member" button, so the
              button becomes the field rather than opening a dialog over it. */}
          {adding ? (
            <>
              <label className="sr-only" htmlFor={memberFieldId}>
                Name of the member to add
              </label>
              <Input
                compact
                autoFocus
                id={memberFieldId}
                value={newMember}
                placeholder="Name"
                style={{ width: 176, background: "var(--color-bg)" }}
                onChange={(event) => setNewMember(event.target.value)}
                onBlur={addMember}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addMember();
                  }
                  if (event.key === "Escape") {
                    setNewMember("");
                    setAdding(false);
                  }
                }}
              />
            </>
          ) : (
            <Button size="compact" icon="plus" onClick={() => setAdding(true)}>
              Add member
            </Button>
          )}
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
              toast(
                "There is no version history — a section keeps its current text and the time it was last saved.",
              )
            }
          >
            Version history
          </Button>
        </span>
      </div>
    </div>
  );
}
