"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { CertificateStatusBadge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Field, FieldGrid, Input, Select } from "@/components/ui/field";
import { ConfirmModal, Modal, ModalActions } from "@/components/ui/modal";
import { EMPTY_STATE_COPY, EmptyState, ErrorState } from "@/components/ui/states";
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
import { deleteCertificate, upsertCertificate } from "@/lib/data/supplier-actions";
import {
  CERTIFICATE_OPTIONS,
  EMPTY_CERTIFICATE,
  toDateInputValue,
  withCurrentValue,
  type SupplierCertificateValues,
} from "@/lib/suppliers/supplier-schema";
import type { Supplier, SupplierCertificate } from "@/types/domain";

import { declaredCertificates } from "@/lib/suppliers/display";

/**
 * Supplier Certificates tab — README §1.7 / §19, prototype lines 563..590.
 *
 * A supplier whose copies were collected during a visit lists the real
 * certificates; every other supplier lists the certifications it *declared* on
 * the data sheet — `Declared` badge, em-dash number and dates, "No copy
 * collected" in the file column — under the approved §21 note.
 *
 * The declared rows have no `supplier_certificates` row behind them, so they
 * carry no row actions: the first certificate recorded here replaces the whole
 * declared list with collected ones.
 */

const EM_DASH = "—";

/** Phase 4 owns the storage; the control says so rather than looking broken. */
const UPLOAD_HINT =
  "Copies are photographed during the visit — attaching the file arrives in Phase 4.";

function cell(raw: string): string {
  return raw.trim().length > 0 ? raw : EM_DASH;
}

type Dialog =
  | { kind: "closed" }
  | { kind: "edit"; certificate: SupplierCertificate | null }
  | { kind: "remove"; certificate: SupplierCertificate };

function toValues(certificate: SupplierCertificate): SupplierCertificateValues {
  return {
    name: certificate.name,
    number: certificate.number,
    // The record holds the human form the certificate itself prints; the date
    // control only accepts yyyy-mm-dd.
    issueDate: toDateInputValue(certificate.issueDate),
    expirationDate: toDateInputValue(certificate.expirationDate),
  };
}

export interface CertificatesTabProps {
  supplier: Supplier;
  /** The copies collected for this supplier, in the author's order. */
  certificates: readonly SupplierCertificate[];
}

export function CertificatesTab({ supplier, certificates }: CertificatesTabProps) {
  const router = useRouter();
  const { toast } = useToast();
  const uploadControlId = useId();

  const [dialog, setDialog] = useState<Dialog>({ kind: "closed" });
  const [values, setValues] = useState<SupplierCertificateValues>({
    ...EMPTY_CERTIFICATE,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const declared = certificates.length === 0;
  const rows = declared ? declaredCertificates(supplier) : certificates;

  const note =
    !declared && supplier.lastVisitDate
      ? `Copies collected during the ${supplier.lastVisitDate} visit.`
      : EMPTY_STATE_COPY.noCertificates;

  function openEditor(certificate: SupplierCertificate | null) {
    setValues(certificate ? toValues(certificate) : { ...EMPTY_CERTIFICATE });
    setFieldErrors({});
    setMessage(null);
    setDialog({ kind: "edit", certificate });
  }

  function close() {
    if (busy) return;
    setDialog({ kind: "closed" });
    setFieldErrors({});
    setMessage(null);
  }

  function set(field: keyof SupplierCertificateValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function save(certificate: SupplierCertificate | null) {
    setBusy(true);
    setFieldErrors({});
    setMessage(null);

    const result = await upsertCertificate(supplier.id, {
      ...values,
      ...(certificate ? { id: certificate.id } : {}),
    });

    setBusy(false);

    if (!result.ok) {
      setFieldErrors(result.error.fieldErrors ?? {});
      setMessage(result.error.message);
      return;
    }

    setDialog({ kind: "closed" });
    toast(certificate ? `${values.name} updated.` : `${values.name} recorded.`);
    router.refresh();
  }

  async function remove(certificate: SupplierCertificate) {
    setBusy(true);
    setMessage(null);

    const result = await deleteCertificate(certificate.id);
    setBusy(false);

    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }

    setDialog({ kind: "closed" });
    toast(`${certificate.name} removed from ${supplier.shortName}.`);
    router.refresh();
  }

  const editing = dialog.kind === "edit" ? dialog.certificate : null;

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
        <h5 style={{ margin: 0, flex: 1 }}>Certificates</h5>
        <Button
          variant="secondary"
          icon="plus"
          style={{ fontSize: "12.5px" }}
          onClick={() => openEditor(null)}
        >
          Add Certificate
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          message={EMPTY_STATE_COPY.noCertificates}
          action={
            <Button
              variant="secondary"
              size="compact"
              icon="plus"
              onClick={() => openEditor(null)}
            >
              Add Certificate
            </Button>
          }
        />
      ) : (
        <>
          <p
            style={{
              fontSize: "11.5px",
              color: "var(--color-neutral-600)",
              margin: "0 0 9px",
            }}
          >
            {note}
          </p>

          <TableFrame>
            <Table>
              <Thead>
                <Tr>
                  <Th>Certificate</Th>
                  <Th>Certificate Number</Th>
                  <Th>Issue Date</Th>
                  <Th>Expiration</Th>
                  <Th>Status</Th>
                  <Th>File</Th>
                  {declared ? null : (
                    <Th align="right" width={72}>
                      Actions
                    </Th>
                  )}
                </Tr>
              </Thead>
              <Tbody>
                {rows.map((certificate) => (
                  <Tr key={certificate.id}>
                    <Td
                      style={{
                        fontSize: 13,
                        fontFamily: "var(--font-heading)",
                        fontWeight: 600,
                      }}
                    >
                      {certificate.name}
                    </Td>
                    <Td style={{ fontSize: "12.5px", color: "var(--color-neutral-700)" }}>
                      {cell(certificate.number)}
                    </Td>
                    <Td
                      nowrap
                      style={{ fontSize: "12.5px", color: "var(--color-neutral-700)" }}
                    >
                      {cell(certificate.issueDate)}
                    </Td>
                    <Td
                      nowrap
                      style={{ fontSize: "12.5px", color: "var(--color-neutral-700)" }}
                    >
                      {cell(certificate.expirationDate)}
                    </Td>
                    <Td>
                      <CertificateStatusBadge status={certificate.status} />
                    </Td>
                    <Td
                      style={{
                        fontSize: 12,
                        color: certificate.fileName
                          ? "var(--color-accent-700)"
                          : "var(--color-neutral-500)",
                      }}
                    >
                      {certificate.fileName ?? "No copy collected"}
                    </Td>
                    {declared ? null : (
                      <Td align="right">
                        <RowActions>
                          <IconButton
                            label={`Edit ${certificate.name}`}
                            name="pencil"
                            variant="secondary"
                            onClick={() => openEditor(certificate)}
                          />
                          <IconButton
                            label={`Remove ${certificate.name}`}
                            name="trash"
                            variant="secondary"
                            onClick={() => {
                              setMessage(null);
                              setDialog({ kind: "remove", certificate });
                            }}
                          />
                        </RowActions>
                      </Td>
                    )}
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableFrame>
        </>
      )}

      <Modal
        open={dialog.kind === "edit"}
        onClose={close}
        title={editing ? "Edit Certificate" : "Add Certificate"}
        subtitle={supplier.shortName}
        size="lg"
        footer={
          <ModalActions>
            <Button onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy} onClick={() => save(editing)}>
              Save Certificate
            </Button>
          </ModalActions>
        }
      >
        <FieldGrid columns={2} gap={12} style={{ margin: "14px 0 4px" }}>
          <Field label="Certificate" required error={fieldErrors.name}>
            <Select
              value={values.name}
              onChange={(event) => set("name", event.target.value)}
            >
              <option value="">Select a certificate</option>
              {withCurrentValue(CERTIFICATE_OPTIONS, values.name).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Certificate number" error={fieldErrors.number}>
            <Input
              value={values.number}
              onChange={(event) => set("number", event.target.value)}
            />
          </Field>
          <Field label="Issue date" error={fieldErrors.issueDate}>
            <Input
              type="date"
              value={values.issueDate}
              onChange={(event) => set("issueDate", event.target.value)}
            />
          </Field>
          <Field label="Expiration date" error={fieldErrors.expirationDate}>
            <Input
              type="date"
              value={values.expirationDate}
              onChange={(event) => set("expirationDate", event.target.value)}
            />
          </Field>
          <Field
            label="Certificate copy"
            htmlFor={uploadControlId}
            hint={UPLOAD_HINT}
            style={{ gridColumn: "span 2" }}
          >
            <Button id={uploadControlId} icon="upload" disabled>
              Upload file
            </Button>
          </Field>
        </FieldGrid>

        {message && Object.keys(fieldErrors).length === 0 ? (
          <ErrorState className="mt-[4px]" message={message} />
        ) : null}
      </Modal>

      <ConfirmModal
        open={dialog.kind === "remove"}
        onClose={close}
        onConfirm={() => {
          if (dialog.kind === "remove") void remove(dialog.certificate);
        }}
        title="Remove certificate"
        body={
          <>
            <p style={{ margin: 0 }}>
              {dialog.kind === "remove"
                ? `The collected copy of ${dialog.certificate.name} will be removed from ${supplier.shortName}. The certification declared on the data sheet is not changed.`
                : ""}
            </p>
            {message ? <ErrorState className="mt-[10px]" message={message} /> : null}
          </>
        }
        confirmLabel="Remove Certificate"
        destructive
        loading={busy}
      />
    </div>
  );
}
