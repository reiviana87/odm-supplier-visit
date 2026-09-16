"use client";

import { useId, useState } from "react";

import { useSectionDraft } from "@/components/reports/section-draft";
import { Blueprint } from "@/components/ui/blueprint";
import { CertificateStatusBadge, Tag } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { EmptyState, EMPTY_STATE_COPY } from "@/components/ui/states";
import { UploadZone } from "@/components/ui/upload-zone";
import { useToast } from "@/components/ui/toast";
import { declaredCertificates } from "@/lib/suppliers/display";
import type { Report, SupplierCertificate } from "@/types/domain";

/**
 * §7 Certificates — README §19 (last paragraph), prototype lines 1139..1185.
 *
 * "Certificates in the report editor are photo-first, not a table": a drop zone
 * over a `minmax(404px,1fr)` card grid, each card an 86×112 image slot plus the
 * three extracted fields, a read line and a confirm action.
 *
 * Reading a certificate photo is Phase 4, so nothing here claims to have read
 * one: every seeded card is shown confirmed except the single card kept in the
 * unconfirmed treatment, which the note under the grid labels as a design
 * reference.
 */

/** README §19 — the AI-filled, unconfirmed field line. */
const OCR_READ_LINE = "Read from photo · 86% — check the dates";

/** The one card kept in the unconfirmed state (prototype: certs 3..5 are pending). */
const UNCONFIRMED_DEMO_INDEX = 3;

/**
 * §7 lists the supplier's certificates (README §8.3), so the place to add one
 * is the supplier record — which is where the writer for them lives.
 */
const CERTIFICATES_ARE_THE_SUPPLIERS =
  "Certificates belong to the supplier record — add one on the supplier’s Certificates tab and it appears here.";

const OCR_PHASE = "Reading certificate photos arrives in Phase 4";

const EM_DASH = "—";

const SLOT_LABEL = {
  fontSize: 9.5,
  letterSpacing: ".04em",
  textAlign: "center",
  lineHeight: 1.35,
  padding: "0 6px",
  maxWidth: "100%",
  overflowWrap: "anywhere",
} as const;

const FIELD_LABEL = { fontSize: 9.5, letterSpacing: ".09em" } as const;

const FIELD_INPUT = { fontSize: 11.5, padding: "4px 6px" } as const;

function fieldValue(raw: string): string {
  return raw.trim().length > 0 ? raw : "";
}

function CertificateCard({
  certificate,
  pendingOcr,
}: {
  certificate: SupplierCertificate;
  /** Renders the AI-filled, unconfirmed treatment (README §5, §19). */
  pendingOcr: boolean;
}) {
  const { toast } = useToast();
  const [confirmed, setConfirmed] = useState(!pendingOcr);
  const [edited, setEdited] = useState(false);
  const [values, setValues] = useState({
    number: fieldValue(certificate.number),
    issue: fieldValue(certificate.issueDate),
    expiry: fieldValue(certificate.expirationDate),
  });

  const hasPhoto = certificate.fileName !== null;
  const unconfirmed = hasPhoto && !confirmed;

  const patch = (key: keyof typeof values, next: string) => {
    setValues((current) => ({ ...current, [key]: next }));
    setEdited(true);
    setConfirmed(true);
  };

  const readNote = !hasPhoto
    ? "No image — upload a photo or type the data"
    : edited
      ? "Entered manually"
      : unconfirmed
        ? OCR_READ_LINE
        : "Confirmed";

  const confirmLabel = !hasPhoto
    ? "Upload photo"
    : unconfirmed
      ? "Confirm data"
      : "Replace photo";

  return (
    <Blueprint
      className="flex items-start"
      style={{ padding: "11px 12px", gap: 12 }}
    >
      <button
        type="button"
        className="flex flex-col items-center justify-center"
        aria-label={
          hasPhoto
            ? `Replace the photo of ${certificate.name}`
            : `Add a photo of ${certificate.name}`
        }
        onClick={() => toast(OCR_PHASE)}
        style={{
          width: 86,
          height: 112,
          flex: "none",
          gap: 5,
          cursor: "pointer",
          border: hasPhoto
            ? "1px solid var(--color-divider)"
            : "1px dashed var(--color-neutral-400)",
          background: hasPhoto ? "var(--color-neutral-100)" : "transparent",
          color: hasPhoto ? "var(--color-accent-700)" : "var(--color-neutral-500)",
        }}
      >
        <Icon name="file" size={18} />
        <span style={SLOT_LABEL}>{certificate.fileName ?? "Add photo"}</span>
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="flex items-center" style={{ gap: 7, marginBottom: 8 }}>
          <div
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 600,
              fontSize: 14,
              flex: 1,
              minWidth: 0,
            }}
          >
            {certificate.name}
          </div>
          {hasPhoto ? (
            <CertificateStatusBadge status={certificate.status} />
          ) : (
            <Tag tone="neutral-soft">No photo</Tag>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.25fr 1fr 1fr",
            gap: 6,
          }}
        >
          <Field
            label={<span style={FIELD_LABEL}>Certificate no.</span>}
            style={{ margin: 0 }}
          >
            <Input
              compact
              aiPending={unconfirmed}
              value={values.number}
              placeholder={EM_DASH}
              onChange={(event) => patch("number", event.target.value)}
              style={FIELD_INPUT}
            />
          </Field>
          <Field label={<span style={FIELD_LABEL}>Issue</span>} style={{ margin: 0 }}>
            <Input
              compact
              aiPending={unconfirmed}
              value={values.issue}
              placeholder={EM_DASH}
              onChange={(event) => patch("issue", event.target.value)}
              style={FIELD_INPUT}
            />
          </Field>
          <Field label={<span style={FIELD_LABEL}>Expiry</span>} style={{ margin: 0 }}>
            <Input
              compact
              aiPending={unconfirmed}
              value={values.expiry}
              placeholder={EM_DASH}
              onChange={(event) => patch("expiry", event.target.value)}
              style={FIELD_INPUT}
            />
          </Field>
        </div>

        <div className="flex items-center" style={{ gap: 8, marginTop: 9 }}>
          <span
            aria-live="polite"
            style={{
              fontSize: 10.5,
              letterSpacing: ".04em",
              color: unconfirmed
                ? "var(--color-warning-ink)"
                : "var(--color-neutral-600)",
            }}
          >
            {readNote}
          </span>
          <div style={{ flex: 1 }} />
          <Button
            variant="ghost"
            size="compact"
            style={{
              fontSize: 11,
              padding: "2px 8px",
              border: `1px solid ${
                unconfirmed ? "var(--color-accent-500)" : "var(--color-divider)"
              }`,
              color: unconfirmed
                ? "var(--color-accent-800)"
                : "var(--color-neutral-700)",
              background: unconfirmed ? "var(--color-accent-100)" : undefined,
            }}
            onClick={() => {
              if (unconfirmed) {
                setConfirmed(true);
                return;
              }
              toast(OCR_PHASE);
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Blueprint>
  );
}

export function CertificatesSection({
  report,
  certificates: collected,
}: {
  report: Report;
  /**
   * The copies actually collected for this supplier, read by the page through
   * the data layer. `undefined` means the read was not attempted or failed;
   * an empty array means there genuinely are none, and the section falls back
   * to what the snapshot says was declared.
   */
  certificates?: readonly SupplierCertificate[];
}) {
  const { toast } = useToast();
  const notesId = useId();
  // Section 7's note is this section's body row, autosaved by the shell.
  const { draft, setBody } = useSectionDraft("certificates");

  // README §1.7 — with no collected copies the section lists what the data
  // sheet declared, derived from the frozen snapshot rather than the live
  // supplier row so the report keeps saying what was true at the visit.
  const certificates: readonly SupplierCertificate[] =
    collected && collected.length > 0
      ? collected
      : declaredCertificates(report.supplierSnapshot);

  const withPhoto = certificates.filter(
    (certificate) => certificate.fileName !== null,
  ).length;
  const demoIndex = certificates.findIndex(
    (certificate, index) =>
      index === UNCONFIRMED_DEMO_INDEX && certificate.fileName !== null,
  );

  return (
    <div style={{ maxWidth: 940 }}>
      <div
        className="flex items-center"
        style={{
          gap: 10,
          marginBottom: 12,
          padding: "9px 12px",
          border: "1px solid var(--color-accent-300)",
          background: "var(--color-accent-100)",
        }}
      >
        <Icon
          name="spark"
          size={15}
          style={{ color: "var(--color-accent-800)", flex: "none" }}
        />
        <div style={{ flex: 1, fontSize: 12.5, color: "var(--color-accent-900)" }}>
          <strong style={{ fontWeight: 500 }}>
            Photo the certificate, the app reads it
          </strong>{" "}
          — name, number, issue and expiry dates are extracted from the image;
          confirm or correct each field.
        </div>
        <Button
          size="compact"
          icon="plus"
          style={{ background: "var(--color-bg)" }}
          onClick={() => toast(CERTIFICATES_ARE_THE_SUPPLIERS)}
        >
          Add manually
        </Button>
      </div>

      <UploadZone
        title="Drop certificate photos or scans here"
        description="JPG, PNG or PDF page · one certificate per image · fields are read automatically"
        accept="image/jpeg,image/png,application/pdf"
        multiple
        onFiles={() => toast(OCR_PHASE)}
        status={
          <Tag tone="neutral">
            {withPhoto} of {certificates.length} with a photo
          </Tag>
        }
        className="mb-[16px]"
      />

      {certificates.length === 0 ? (
        <EmptyState
          message={EMPTY_STATE_COPY.noCertificates}
          action={
            <Button
              size="compact"
              icon="plus"
              onClick={() => toast(CERTIFICATES_ARE_THE_SUPPLIERS)}
            >
              Add Certificate
            </Button>
          }
          className="mb-[18px]"
        />
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(404px, 1fr))",
              gap: 12,
            }}
          >
            {certificates.map((certificate, index) => (
              <CertificateCard
                key={certificate.id}
                certificate={certificate}
                pendingOcr={index === demoIndex}
              />
            ))}
          </div>
          <p
            style={{
              fontSize: 11.5,
              color: "var(--color-neutral-600)",
              margin: "10px 0 18px",
            }}
          >
            {demoIndex >= 0
              ? "One card is held in the unconfirmed state so the AI-filled treatment stays visible. These fields come from the supplier record, not from an image — reading certificate photos arrives in Phase 4."
              : "These fields come from the supplier record — reading certificate photos arrives in Phase 4."}
          </p>
        </>
      )}

      <h6 style={{ margin: "0 0 8px" }}>Report-specific notes on certification</h6>
      <label className="sr-only" htmlFor={notesId}>
        Report-specific notes on certification
      </label>
      <Textarea
        prose
        id={notesId}
        value={draft.body}
        onChange={(event) => setBody(event.target.value)}
        minHeight={96}
        placeholder="What was verified on site, what is still missing…"
      />
    </div>
  );
}
