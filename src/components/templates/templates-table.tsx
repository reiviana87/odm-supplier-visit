"use client";

import { useState } from "react";

import { Tag } from "@/components/ui/badge";
import { Blueprint } from "@/components/ui/blueprint";
import { Button, ButtonLink, IconButton, IconButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Modal, ModalActions } from "@/components/ui/modal";
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
import { UploadZone } from "@/components/ui/upload-zone";
import { PLACEHOLDER_MAPPINGS, TEMPLATE_DETAILS, TEMPLATES } from "@/lib/mock-data";
import type { ReportTemplate } from "@/types/domain";

/**
 * Report Templates — README §16, transcribed from the approved prototype
 * (design-handoff/ODM Supplier Visit.dc.html lines 1484..1543). No screenshot
 * exists for this screen; the markup is the measured truth.
 *
 * Everything that writes — uploading a `.docx`, switching the active version,
 * archiving — is out of Phase 1: the approved controls are rendered and each
 * one reports the phase it lands in rather than faking a result.
 */

/** Prototype line 1502 — the fixed geometry of the corporate Word template. */
const PAGE_GEOMETRY = [
  "A4 portrait · 21.0 × 29.7 cm",
  "Margins 2.0 / 2.0 / 2.0 / 2.0 cm",
  "Text box 17.0 × 25.7 cm",
  "Appendix grid 2 columns",
  "Body Arial 10 pt · captions 8 pt",
];

/** The three `{{…}}`-less rows of the mapping are image regions (README §16). */
const IMAGE_REGION_COUNT = PLACEHOLDER_MAPPINGS.filter(
  (mapping) => !mapping.placeholder.startsWith("{{"),
).length;

/* ═══════════════════════════════════════════════════════════════════════════
   Upload
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The page's primary action. README §16: "on upload, the app parses the
 * placeholders and shows a mapping diff (found / missing / unknown)" — the
 * parser is Phase 5, so the dialog accepts the file and says so.
 */
export function TemplateUploadButton({ label = "Upload New Version" }: { label?: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="primary" icon="upload" onClick={() => setOpen(true)}>
        {label}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="md"
        title="Upload New Template Version"
        subtitle="The active template controls the output of every future export."
        footer={
          <ModalActions>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </ModalActions>
        }
      >
        <div style={{ margin: "16px 0 14px" }}>
          <UploadZone
            variant="large"
            icon="file"
            title="Drop the Word template here"
            description="Single .docx file · the placeholders are read from it on upload"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onFiles={(files) =>
              toast(
                `Template parsing lands in Phase 5 — “${files[0].name}” was not uploaded.`,
              )
            }
          />
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 12.5,
            lineHeight: 1.6,
            color: "var(--color-neutral-700)",
          }}
        >
          The new version is uploaded as a draft. Its placeholders are compared
          against the mapping and shown as found, missing or unknown before you
          make it active.
        </p>
      </Modal>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Active template card — prototype lines 1494..1521
   ═══════════════════════════════════════════════════════════════════════════ */

export function ActiveTemplateCard({ template }: { template: ReportTemplate }) {
  const { toast } = useToast();
  const detail = TEMPLATE_DETAILS[template.id];

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
            <Tag tone="accent">Active · {template.version}</Tag>
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: "var(--color-neutral-700)",
              marginTop: 3,
            }}
          >
            {detail.fileName} · uploaded {template.uploadedAt} by{" "}
            {template.uploadedBy} · {PLACEHOLDER_MAPPINGS.length} placeholders,{" "}
            {IMAGE_REGION_COUNT} image regions
          </div>

          <div
            style={{ display: "flex", gap: 7, marginTop: 11, flexWrap: "wrap" }}
          >
            <Button
              variant="secondary"
              style={{ fontSize: 12 }}
              onClick={() =>
                toast(
                  `Downloading ${detail.fileName} lands in Phase 5 — the Word pipeline is not wired yet.`,
                )
              }
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
              View Mapping
            </ButtonLink>
            <Button
              variant="secondary"
              style={{ fontSize: 12 }}
              onClick={() =>
                toast(`${template.version} is already the active template.`)
              }
            >
              Set Active
            </Button>
            <Button
              variant="secondary"
              style={{ fontSize: 12 }}
              onClick={() =>
                toast(
                  "Validating a template against a report lands in Phase 5 — the Word pipeline is not wired yet.",
                )
              }
            >
              Validate against a report
            </Button>
          </div>
        </div>

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
          <div
            style={{
              fontSize: 12,
              lineHeight: 1.75,
              color: "var(--color-neutral-800)",
            }}
          >
            {PAGE_GEOMETRY.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        </div>
      </div>
    </Blueprint>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Version history — prototype lines 1523..1541
   ═══════════════════════════════════════════════════════════════════════════ */

export function TemplatesTable() {
  const { toast } = useToast();

  return (
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
          {TEMPLATES.map((template) => {
            const detail = TEMPLATE_DETAILS[template.id];
            return (
              <Tr key={template.id} selected={template.isActive}>
                <Td
                  nowrap
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontWeight: 600,
                    fontSize: 13.5,
                  }}
                >
                  {template.version}
                </Td>
                <Td nowrap style={{ fontSize: 12.5, color: "var(--color-neutral-700)" }}>
                  {template.uploadedAt}
                </Td>
                <Td style={{ fontSize: 12.5, color: "var(--color-neutral-700)" }}>
                  {template.uploadedBy}
                </Td>
                <Td>
                  {template.isActive ? (
                    <Tag tone="accent">Active</Tag>
                  ) : (
                    <Tag tone="outline">Archived</Tag>
                  )}
                </Td>
                <Td style={{ fontSize: 12.5 }}>{detail.changeNote}</Td>
                <Td align="right">
                  <RowActions>
                    <IconButton
                      variant="secondary"
                      name="download"
                      size={28}
                      iconSize={14}
                      label={`Download ${template.version}`}
                      onClick={() =>
                        toast(
                          `Downloading ${detail.fileName} lands in Phase 5 — the Word pipeline is not wired yet.`,
                        )
                      }
                    />
                    {template.isActive ? null : (
                      <IconButton
                        variant="secondary"
                        name="check"
                        size={28}
                        iconSize={14}
                        label={`Set ${template.version} active`}
                        onClick={() =>
                          toast(
                            "Switching the active template lands in Phase 2 — every future export still uses the current version.",
                          )
                        }
                      />
                    )}
                    <IconButtonLink
                      href="/templates/mapping"
                      variant="secondary"
                      name="link"
                      label={`Map placeholders for ${template.version}`}
                    />
                    {template.isArchived ? null : (
                      <IconButton
                        variant="secondary"
                        name="archive"
                        size={28}
                        iconSize={14}
                        label={`Archive ${template.version}`}
                        onClick={() =>
                          toast(
                            `Archiving a template version lands in Phase 2 — ${template.version} is unchanged.`,
                          )
                        }
                      />
                    )}
                  </RowActions>
                </Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
    </TableFrame>
  );
}
