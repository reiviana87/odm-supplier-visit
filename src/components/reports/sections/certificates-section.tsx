"use client";

import { useCallback, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { useSectionDraft } from "@/components/reports/section-draft";
import { Blueprint } from "@/components/ui/blueprint";
import { CertificateStatusBadge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { EmptyState, EMPTY_STATE_COPY } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import {
  ACCEPTED_CERTIFICATE_MIME,
  MAX_CERTIFICATE_BYTES,
} from "@/lib/data/certificate-limits";
import {
  deleteCertificate,
  uploadCertificateFile,
  upsertCertificate,
} from "@/lib/data/supplier-actions";
import { declaredCertificates } from "@/lib/suppliers/display";
import type { Report, SupplierCertificate } from "@/types/domain";

/**
 * §7 Certificates — README §19, prototype lines 1139..1185.
 *
 * "Certificates in the report editor are photo-first, not a table": a card grid
 * at `minmax(404px, 1fr)`, each card an 86×112 copy slot beside the three
 * fields, with the status and the collected copy on the same row.
 *
 * ## What this screen used to be
 *
 * All of it was a drawing. Every control answered with a toast naming a phase —
 * the drop zone, the copy slot, Add manually, the empty state's own button —
 * and the banner across the top said "Photo the certificate, the app reads it",
 * which was never true and is not true now. One card was deliberately held in a
 * fake "read from photo · 86%" state so the unconfirmed treatment stayed
 * visible in the design. So a visit could collect a certificate and the report
 * had nowhere to put it: "I cannot add the certificates in any way".
 *
 * ## What it is
 *
 * The cards are the supplier's own `supplier_certificates` rows, written
 * through the same two actions the supplier record uses — a certificate belongs
 * to the supplier, not to one visit, and recording it here must not fork it.
 * The names the supplier merely *declares* on its data sheet appear as empty
 * cards, so filling one in is how a declaration becomes a record.
 *
 * The copy is uploaded and kept; nothing reads it. The fields are typed by the
 * person holding the paper, and the line under the grid says so rather than
 * implying a model filled them in.
 */

const EM_DASH = "—";

const FIELD_LABEL = { fontSize: 9.5, letterSpacing: ".09em" } as const;

const FIELD_INPUT = { fontSize: 11.5, padding: "4px 6px" } as const;

const SLOT_LABEL = {
  fontSize: 9.5,
  letterSpacing: ".04em",
  textAlign: "center",
  lineHeight: 1.35,
  padding: "0 6px",
  maxWidth: "100%",
  overflowWrap: "anywhere",
} as const;

const ACCEPT = ACCEPTED_CERTIFICATE_MIME.join(",");

/** The three fields a card edits, as strings, which is what the inputs hold. */
interface CardValues {
  name: string;
  number: string;
  issueDate: string;
  expirationDate: string;
}

function valuesOf(certificate: SupplierCertificate): CardValues {
  return {
    name: certificate.name,
    number: certificate.number,
    issueDate: certificate.issueDate,
    expirationDate: certificate.expirationDate,
  };
}

/**
 * A card with no row behind it yet.
 *
 * Two kinds reach this state: a certification the supplier declared on its data
 * sheet as a bare name, and one somebody adds here by hand. Neither is a row
 * until it is saved, so both carry an empty id — which is also what
 * `upsertCertificate` reads as "insert".
 */
function draftFor(name: string, key: string): SupplierCertificate {
  return {
    id: "",
    name,
    number: "",
    issueDate: "",
    expirationDate: "",
    status: "declared",
    fileName: null,
    storagePath: null,
    notes: null,
    sortOrder: 0,
    /** Only used as a React key while the card has no id of its own. */
    draftKey: key,
  } as SupplierCertificate & { draftKey: string };
}

export function CertificatesSection({
  report,
  certificates,
  copyUrls,
}: {
  report: Report;
  /** The supplier's stored rows. Undefined while the read failed. */
  certificates: readonly SupplierCertificate[] | undefined;
  /** Signed URL per storage path, so a collected copy can be opened. */
  copyUrls: Readonly<Record<string, string>>;
}) {
  const notesId = useId();
  const { draft, setBody } = useSectionDraft("certificates");
  const supplierId = report.supplierSnapshot.supplierId;

  // Cards added by hand in this session, before they have been saved.
  const [added, setAdded] = useState<readonly SupplierCertificate[]>([]);
  const nextKey = useRef(0);

  const rows = certificates ?? [];

  /**
   * A declared name with no row yet is an empty card, not a missing one.
   *
   * Matched case-insensitively on the name: the data sheet says "ISO9001" and
   * somebody types "ISO 9001", and showing both as separate cards would be a
   * worse answer than showing one.
   */
  const declared = declaredCertificates(report.supplierSnapshot)
    .filter(
      (candidate) =>
        !rows.some(
          (row) => row.name.trim().toLowerCase() === candidate.name.trim().toLowerCase(),
        ),
    )
    .map((candidate) => draftFor(candidate.name, `declared-${candidate.name}`));

  const cards = [...rows, ...declared, ...added];
  const withCopy = cards.filter((card) => card.fileName !== null).length;

  return (
    <div>
      <div
        className="flex items-center"
        style={{
          gap: 10,
          marginBottom: 12,
          padding: "9px 12px",
          border: "1px solid var(--color-divider)",
          background: "var(--color-surface)",
        }}
      >
        <Icon name="file" size={15} style={{ flex: "none", opacity: 0.6 }} />
        <div style={{ flex: 1, fontSize: 12.5 }}>
          <strong style={{ fontWeight: 500 }}>
            Photograph the certificate and type what it says
          </strong>{" "}
          — the copy is stored with the supplier; the number and the dates are
          entered by whoever is holding it. {withCopy} of {cards.length} have a
          copy.
        </div>
        <Button
          size="compact"
          icon="plus"
          onClick={() => {
            nextKey.current += 1;
            setAdded((current) => [
              ...current,
              draftFor("", `added-${nextKey.current}`),
            ]);
          }}
        >
          Add certificate
        </Button>
      </div>

      {cards.length === 0 ? (
        <EmptyState message={EMPTY_STATE_COPY.noCertificates} className="mb-[18px]" />
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(404px, 1fr))",
              gap: 12,
            }}
          >
            {cards.map((certificate, index) => (
              <CertificateCard
                key={
                  certificate.id ||
                  (certificate as SupplierCertificate & { draftKey?: string }).draftKey ||
                  `card-${index}`
                }
                certificate={certificate}
                supplierId={supplierId}
                copyUrl={
                  certificate.storagePath ? copyUrls[certificate.storagePath] : undefined
                }
                onDropped={() =>
                  setAdded((current) => current.filter((card) => card !== certificate))
                }
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
            These are the supplier’s own certificates — editing one here changes
            the supplier record, and a name with no number or dates is a
            certification the supplier declared but nobody has verified yet.
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

function CertificateCard({
  certificate,
  supplierId,
  copyUrl,
  onDropped,
}: {
  certificate: SupplierCertificate;
  supplierId: string;
  /** A signed URL for the collected copy, when there is one. */
  copyUrl: string | undefined;
  /** The card was an unsaved addition and has been discarded. */
  onDropped: () => void;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<CardValues>(valuesOf(certificate));
  const [saving, startSaving] = useTransition();
  const [uploading, setUploading] = useState(false);

  const stored = certificate.id !== "";
  const hasCopy = certificate.fileName !== null;

  /**
   * Write the card.
   *
   * On blur rather than behind a button: the card has no Save in the approved
   * design, and a field the author has left is a field they have finished with.
   * A card that is still nameless is not written at all — `upsertCertificate`
   * would refuse it anyway, and refusing it here keeps the toast quiet while
   * somebody is still typing.
   */
  const commit = useCallback(() => {
    if (values.name.trim() === "") return;
    if (
      stored &&
      values.name === certificate.name &&
      values.number === certificate.number &&
      values.issueDate === certificate.issueDate &&
      values.expirationDate === certificate.expirationDate
    ) {
      return;
    }

    startSaving(async () => {
      const result = await upsertCertificate(supplierId, {
        ...values,
        ...(stored ? { id: certificate.id } : {}),
      });
      if (!result.ok) {
        toast(result.error.message, "error");
        return;
      }
      toast(stored ? `${values.name} updated.` : `${values.name} recorded.`);
      router.refresh();
    });
  }, [certificate, router, stored, supplierId, toast, values]);

  async function attach(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_CERTIFICATE_BYTES) {
      toast(
        `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${
          MAX_CERTIFICATE_BYTES / 1024 / 1024
        } MB.`,
        "error",
      );
      return;
    }
    if (!stored) {
      // The upload needs a row to hang the path on, and the row needs a name.
      toast("Give the certificate a name first, then add the copy.", "warning");
      return;
    }

    setUploading(true);
    const result = await uploadCertificateFile(supplierId, certificate.id, file);
    setUploading(false);

    if (!result.ok) {
      toast(result.error.message, "error");
      return;
    }
    toast(`Copy of ${certificate.name} stored.`);
    router.refresh();
  }

  function remove() {
    if (!stored) {
      onDropped();
      return;
    }
    startSaving(async () => {
      const result = await deleteCertificate(certificate.id);
      if (!result.ok) {
        toast(result.error.message, "error");
        return;
      }
      toast(`${certificate.name} removed from the supplier record.`);
      router.refresh();
    });
  }

  return (
    <Blueprint className="flex items-start" style={{ padding: "11px 12px", gap: 12 }}>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(event) => {
          void attach(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <button
        type="button"
        className="flex flex-col items-center justify-center"
        aria-label={hasCopy ? `Replace the copy of ${certificate.name}` : "Add a copy"}
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
        style={{
          width: 86,
          height: 112,
          flex: "none",
          gap: 5,
          cursor: "pointer",
          border: hasCopy
            ? "1px solid var(--color-divider)"
            : "1px dashed var(--color-neutral-400)",
          background: hasCopy ? "var(--color-neutral-100)" : "transparent",
          color: hasCopy ? "var(--color-accent-700)" : "var(--color-neutral-500)",
        }}
      >
        <Icon name={hasCopy ? "file" : "upload"} size={18} />
        <span style={SLOT_LABEL}>
          {uploading ? "Storing…" : (certificate.fileName ?? "Add copy")}
        </span>
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="flex items-center" style={{ gap: 7, marginBottom: 8 }}>
          <Input
            compact
            value={values.name}
            aria-label="Certificate"
            placeholder="ISO 9001"
            onChange={(event) =>
              setValues((current) => ({ ...current, name: event.target.value }))
            }
            onBlur={commit}
            style={{ flex: 1, minWidth: 0, fontSize: 13 }}
          />
          <CertificateStatusBadge status={certificate.status} />
          <IconButton
            name="trash"
            label={stored ? `Remove ${certificate.name}` : "Discard this card"}
            disabled={saving || uploading}
            onClick={remove}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: 7 }}>
          <Labelled label="Certificate no.">
            <Input
              compact
              value={values.number}
              aria-label="Certificate number"
              placeholder={EM_DASH}
              onChange={(event) =>
                setValues((current) => ({ ...current, number: event.target.value }))
              }
              onBlur={commit}
              style={FIELD_INPUT}
            />
          </Labelled>
          <Labelled label="Issue">
            <Input
              compact
              value={values.issueDate}
              aria-label="Issue date"
              placeholder="2024-03"
              onChange={(event) =>
                setValues((current) => ({ ...current, issueDate: event.target.value }))
              }
              onBlur={commit}
              style={FIELD_INPUT}
            />
          </Labelled>
          <Labelled label="Expiry">
            <Input
              compact
              value={values.expirationDate}
              aria-label="Expiry date"
              placeholder="2027-03"
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  expirationDate: event.target.value,
                }))
              }
              onBlur={commit}
              style={FIELD_INPUT}
            />
          </Labelled>
        </div>

        <div
          className="flex items-center"
          style={{ gap: 8, marginTop: 7, fontSize: 11, color: "var(--color-neutral-600)" }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            {saving
              ? "Saving…"
              : !stored
                ? "Not recorded yet — name it and it is saved"
                : hasCopy
                  ? "Copy collected"
                  : "No copy — add the photo or the scan"}
          </span>
          {copyUrl ? (
            <a
              href={copyUrl}
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--color-accent-800)" }}
            >
              Open copy
            </a>
          ) : null}
        </div>
      </div>
    </Blueprint>
  );
}

/** The 9.5px caption the approved card puts over each of the three fields. */
function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", minWidth: 0 }}>
      <span
        style={{
          ...FIELD_LABEL,
          display: "block",
          marginBottom: 3,
          color: "var(--color-neutral-600)",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}
