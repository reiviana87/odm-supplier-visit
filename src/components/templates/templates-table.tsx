"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { TemplateUpload } from "@/components/templates/template-upload";
import { Tag } from "@/components/ui/badge";
import { Blueprint } from "@/components/ui/blueprint";
import { Button, ButtonLink, IconButton, IconButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ConfirmModal } from "@/components/ui/modal";
import { ErrorState } from "@/components/ui/states";
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
import {
  archiveTemplate,
  deleteTemplate,
  restoreTemplate,
  setActiveTemplate,
  type TemplateGeometry,
  type TemplateRecord,
} from "@/lib/data/template-actions";

/**
 * Report Templates — README §16, transcribed from the approved prototype
 * (design-handoff/ODM Supplier Visit.dc.html lines 1484..1543). No screenshot
 * exists for this screen; the markup is the measured truth.
 *
 * The approved layout is unchanged. What changed is that every row is a
 * `report_templates` row and every control calls the action it names: uploading
 * a version, switching the one the export builds from, archiving, restoring,
 * deleting.
 *
 * Two affordances in the approved design have no action behind them —
 * downloading the stored `.docx` and validating a template against a report.
 * They are rendered disabled with the reason said out loud, because a button
 * that toasts an excuse teaches the user to distrust the rest of the screen.
 */

const EM_DASH = "—";

/** A field the row may hold as an empty string, shown as the card's dash. */
function display(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : EM_DASH;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * `2026-09-02T08:14:22Z` → `Sep 02, 2026`, parsed by hand rather than through
 * `Date` so the string renders identically on the server and in the browser,
 * whatever the viewer's time zone (the same reason `company-section.tsx` does
 * it this way).
 */
function formatDate(value: string | null | undefined): string {
  if (!value) return EM_DASH;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return value.trim();
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return value.trim();
  return `${month} ${match[3]}, ${match[1]}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Page geometry — the right-hand block of the approved card
   ═══════════════════════════════════════════════════════════════════════════ */

/** `2` → "2.0", `0.98` → "0.98": one decimal at least, two at most. */
function cm(value: number): string {
  return Number.isInteger(value * 10) ? value.toFixed(1) : value.toFixed(2);
}

/** A4 within a rounding tolerance, either way up. Nothing else is named. */
function paperName(width: number, height: number): string | null {
  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);
  const isA4 = Math.abs(shortSide - 21) <= 0.15 && Math.abs(longSide - 29.7) <= 0.15;
  return isA4 ? "A4" : null;
}

function pageLine(geometry: TemplateGeometry): string | null {
  const { pageWidthCm: width, pageHeightCm: height } = geometry;
  if (width === undefined || height === undefined) return null;

  const orientation = geometry.orientation ?? (width > height ? "landscape" : "portrait");
  const paper = paperName(width, height);
  return `${paper ? `${paper} ` : ""}${orientation} · ${cm(width)} × ${cm(height)} cm`;
}

function marginLine(geometry: TemplateGeometry): string | null {
  const sides = [
    geometry.marginTopCm,
    geometry.marginRightCm,
    geometry.marginBottomCm,
    geometry.marginLeftCm,
  ];
  if (sides.some((side) => side === undefined)) return null;
  // Top / right / bottom / left, the order the four numbers are read in CSS and
  // in Word's own Page Setup dialog.
  return `Margins ${sides.map((side) => cm(side as number)).join(" / ")} cm`;
}

function textBoxLine(geometry: TemplateGeometry): string | null {
  const { textWidthCm: width, textHeightCm: height } = geometry;
  if (width === undefined || height === undefined) return null;
  return `Text box ${cm(width)} × ${cm(height)} cm`;
}

function appendixLine(geometry: TemplateGeometry): string | null {
  const columns = geometry.appendixColumns;
  if (columns === undefined) return null;
  return `Appendix grid ${columns} column${columns === 1 ? "" : "s"}`;
}

function bodyLine(geometry: TemplateGeometry): string | null {
  const { bodyFont: font, bodyFontSizePt: size } = geometry;
  if (!font && size === undefined) return null;
  if (!font) return `Body ${size} pt`;
  return size === undefined ? `Body ${font}` : `Body ${font} ${size} pt`;
}

/**
 * The five lines of the approved block (prototype line 1502), each built from
 * what was measured out of the uploaded `.docx` when it was stored.
 *
 * The measurements belong to the document, so they are read from the row.
 * Hard-coding "A4 · margins 2 cm" here — which is what this screen used to do —
 * would keep describing the old template after someone uploads a new one. A
 * value that was not measured reads as an em dash against its label: the card
 * never states a measurement it was not given.
 */
const GEOMETRY_ROWS: ReadonlyArray<{
  label: string;
  line: (geometry: TemplateGeometry) => string | null;
}> = [
  { label: "Page", line: pageLine },
  { label: "Margins", line: marginLine },
  { label: "Text box", line: textBoxLine },
  { label: "Appendix grid", line: appendixLine },
  { label: "Body", line: bodyLine },
];

function PageGeometry({ geometry }: { geometry: TemplateGeometry }) {
  const rows = GEOMETRY_ROWS.map((row) => ({
    label: row.label,
    value: row.line(geometry),
  }));
  const measuredAnything = rows.some((row) => row.value !== null);

  return (
    <div
      style={{
        width: 210,
        flex: "none",
        borderLeft: "1px solid var(--color-divider)",
        paddingLeft: 16,
      }}
    >
      <div className="kicker-muted" style={{ marginBottom: 6 }}>
        Page geometry
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.75, color: "var(--color-neutral-800)" }}>
        {rows.map((row) => (
          <div key={row.label}>{row.value ?? `${row.label} ${EM_DASH}`}</div>
        ))}
      </div>
      {measuredAnything ? null : (
        <p
          style={{
            margin: "6px 0 0",
            fontSize: 11.5,
            color: "var(--color-neutral-600)",
          }}
        >
          Nothing could be measured out of this file.
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Upload
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The page's primary action, and the action inside the empty state. The dialog
 * is `template-upload.tsx`; this owns nothing but whether it is open and the
 * refresh that follows a successful upload.
 */
export function TemplateUploadButton({ label = "Upload New Version" }: { label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="primary" icon="upload" onClick={() => setOpen(true)}>
        {label}
      </Button>

      <TemplateUpload
        open={open}
        onClose={() => setOpen(false)}
        onUploaded={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Active template card — prototype lines 1494..1521
   ═══════════════════════════════════════════════════════════════════════════ */

export function ActiveTemplateCard({ template }: { template: TemplateRecord }) {
  return (
    <Blueprint style={{ padding: 16, marginBottom: 22 }}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div
          style={{
            width: 58,
            height: 74,
            flex: "none",
            border: "1px solid var(--color-divider)",
            background: "var(--color-neutral-100)",
            display: "grid",
            placeItems: "center",
            color: "var(--color-accent-700)",
          }}
        >
          <Icon name="file" size={22} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <h4 style={{ margin: 0 }}>{template.name}</h4>
            <Tag tone="accent">Active · {display(template.version)}</Tag>
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: "var(--color-neutral-700)",
              marginTop: 3,
              overflowWrap: "anywhere",
            }}
          >
            {display(template.fileName)} · uploaded {formatDate(template.uploadedAt)} by{" "}
            {display(template.uploadedBy)}
          </div>

          <div style={{ display: "flex", gap: 7, marginTop: 11, flexWrap: "wrap" }}>
            <Button
              variant="secondary"
              style={{ fontSize: 12 }}
              disabled
              title="Downloading the stored .docx needs a signed-download action this build does not have."
            >
              <Icon name="download" size={13} />
              Download Template
            </Button>
            <ButtonLink
              href="/templates/mapping"
              variant="secondary"
              style={{ fontSize: 12 }}
            >
              <Icon name="link" size={13} />
              Export Sections
            </ButtonLink>
            <Button
              variant="secondary"
              style={{ fontSize: 12 }}
              disabled
              title="This is already the active template."
            >
              Set Active
            </Button>
            <Button
              variant="secondary"
              style={{ fontSize: 12 }}
              disabled
              title="Checking a template against a report needs an action this build does not have."
            >
              Validate against a report
            </Button>
          </div>

          <p
            style={{
              margin: "8px 0 0",
              fontSize: 11.5,
              color: "var(--color-neutral-600)",
            }}
          >
            Downloading this file and validating it against a report are not
            wired up yet — those two buttons stay disabled rather than pretend.
          </p>
        </div>

        <PageGeometry geometry={template.geometry} />
      </div>
    </Blueprint>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Version history — prototype lines 1523..1541
   ═══════════════════════════════════════════════════════════════════════════ */

/** Which confirmation is open, and which version it is about. */
type Pending = {
  kind: "activate" | "archive" | "restore" | "delete";
  template: TemplateRecord;
} | null;

/** How a version reads in the Status column. */
function StatusTag({ template }: { template: TemplateRecord }) {
  if (template.isActive) return <Tag tone="accent">Active</Tag>;
  if (template.isArchived) return <Tag tone="outline">Archived</Tag>;
  // An upload is stored without being activated, so "neither" is a real state
  // of the table. Calling it "Archived" would be a lie about the row.
  return <Tag tone="neutral-soft">Not active</Tag>;
}

function nameOf(template: TemplateRecord): string {
  const version = template.version.trim();
  return version ? `${template.name} ${version}` : template.name;
}

export function TemplatesTable({ templates }: { templates: readonly TemplateRecord[] }) {
  const router = useRouter();
  const { toast } = useToast();

  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  /** The sentence the data layer sent back, shown inside the open dialog. */
  const [message, setMessage] = useState<string | null>(null);

  function open(next: NonNullable<Pending>) {
    setMessage(null);
    setPending(next);
  }

  function close() {
    if (busy) return;
    setPending(null);
    setMessage(null);
  }

  async function handleActivate(template: TemplateRecord) {
    setBusy(true);
    const result = await setActiveTemplate(template.id);
    setBusy(false);

    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }
    setPending(null);
    toast(`${nameOf(template)} is the active template — every export from now on uses it.`);
    router.refresh();
  }

  async function handleArchive(template: TemplateRecord) {
    setBusy(true);
    const result = await archiveTemplate(template.id);
    setBusy(false);

    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }
    setPending(null);
    toast(`${nameOf(template)} archived — the uploaded file is kept.`);
    router.refresh();
  }

  async function handleRestore(template: TemplateRecord) {
    setBusy(true);
    const result = await restoreTemplate(template.id);
    setBusy(false);

    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }
    setPending(null);
    toast(`${nameOf(template)} is back in the version list.`);
    router.refresh();
  }

  /**
   * Deleting the active template is refused by the action. That refusal is
   * carried into the dialog offering the thing the user can accept instead —
   * archiving — the way §33 does it for a supplier that has been visited. The
   * delete is attempted rather than pre-judged, so the reason shown is the
   * server's own.
   */
  async function handleDelete(template: TemplateRecord) {
    setBusy(true);
    const result = await deleteTemplate(template.id);
    setBusy(false);

    if (!result.ok) {
      setMessage(result.error.message);
      if (template.isActive || result.error.code === "conflict") {
        setPending({ kind: "archive", template });
      }
      return;
    }
    setPending(null);
    toast(`${nameOf(template)} deleted.`);
    router.refresh();
  }

  const target = pending?.template ?? null;

  return (
    <>
      <TableFrame>
        <Table>
          <Thead>
            <Tr>
              <Th>Version</Th>
              <Th>Uploaded</Th>
              <Th>By</Th>
              <Th>Status</Th>
              <Th>Change</Th>
              <Th align="right">Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {templates.map((template) => (
              <Tr key={template.id} selected={template.isActive}>
                <Td
                  nowrap
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontWeight: 600,
                    fontSize: 13.5,
                  }}
                >
                  {display(template.version)}
                </Td>
                <Td nowrap style={{ fontSize: 12.5, color: "var(--color-neutral-700)" }}>
                  {formatDate(template.uploadedAt)}
                </Td>
                <Td style={{ fontSize: 12.5, color: "var(--color-neutral-700)" }}>
                  {display(template.uploadedBy)}
                </Td>
                <Td>
                  <StatusTag template={template} />
                </Td>
                <Td style={{ fontSize: 12.5 }}>{display(template.changeNote)}</Td>
                <Td align="right">
                  <RowActions>
                    <IconButton
                      variant="secondary"
                      name="download"
                      size={28}
                      iconSize={14}
                      disabled
                      label={`Download ${display(template.version)} — not available in this build`}
                    />
                    {template.isActive ? null : (
                      <IconButton
                        variant="secondary"
                        name="check"
                        size={28}
                        iconSize={14}
                        label={`Set ${display(template.version)} active`}
                        onClick={() => open({ kind: "activate", template })}
                      />
                    )}
                    <IconButtonLink
                      href="/templates/mapping"
                      variant="secondary"
                      name="link"
                      label={`How the export fills ${display(template.version)}`}
                    />
                    {template.isArchived ? (
                      <IconButton
                        variant="secondary"
                        name="refresh"
                        size={28}
                        iconSize={14}
                        label={`Restore ${display(template.version)}`}
                        onClick={() => open({ kind: "restore", template })}
                      />
                    ) : (
                      <IconButton
                        variant="secondary"
                        name="archive"
                        size={28}
                        iconSize={14}
                        label={`Archive ${display(template.version)}`}
                        onClick={() => open({ kind: "archive", template })}
                      />
                    )}
                    <IconButton
                      variant="secondary"
                      name="trash"
                      size={28}
                      iconSize={14}
                      label={`Delete ${display(template.version)}`}
                      onClick={() => open({ kind: "delete", template })}
                    />
                  </RowActions>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableFrame>

      {target ? (
        <>
          <ConfirmModal
            open={pending?.kind === "activate"}
            onClose={close}
            onConfirm={() => void handleActivate(target)}
            title="Make this version active"
            body={
              <>
                <p style={{ margin: 0 }}>
                  {`Every report exported from now on is built from ${nameOf(target)}. The version that is active today stays in the history and can be set back at any time.`}
                </p>
                {message ? <ErrorState className="mt-[10px]" message={message} /> : null}
              </>
            }
            confirmLabel="Set Active"
            loading={busy}
          />

          <ConfirmModal
            open={pending?.kind === "archive"}
            onClose={close}
            onConfirm={() => void handleArchive(target)}
            title="Archive this version"
            body={
              <>
                <p style={{ margin: 0 }}>
                  {`${nameOf(target)} drops out of the versions offered for export. The uploaded file is kept and it can be restored at any time.`}
                </p>
                {message ? <ErrorState className="mt-[10px]" message={message} /> : null}
              </>
            }
            confirmLabel="Archive Version"
            loading={busy}
          />

          <ConfirmModal
            open={pending?.kind === "restore"}
            onClose={close}
            onConfirm={() => void handleRestore(target)}
            title="Restore this version"
            body={
              <>
                <p style={{ margin: 0 }}>
                  {`${nameOf(target)} returns to the version list. Restoring it does not make it active — the export keeps using the active version until you change that.`}
                </p>
                {message ? <ErrorState className="mt-[10px]" message={message} /> : null}
              </>
            }
            confirmLabel="Restore Version"
            loading={busy}
          />

          <ConfirmModal
            open={pending?.kind === "delete"}
            onClose={close}
            onConfirm={() => void handleDelete(target)}
            title="Delete this version"
            body={
              <>
                <p style={{ margin: 0 }}>
                  {`${nameOf(target)} and its uploaded file are removed. This cannot be undone. Reports already exported are not affected.`}
                </p>
                {message ? <ErrorState className="mt-[10px]" message={message} /> : null}
              </>
            }
            confirmLabel="Delete Version"
            destructive
            loading={busy}
          />
        </>
      ) : null}
    </>
  );
}
