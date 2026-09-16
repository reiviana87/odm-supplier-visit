"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  useFieldArray,
  useForm,
  type FieldPath,
  type SubmitHandler,
  type UseFormSetError,
} from "react-hook-form";

import { Blueprint } from "@/components/ui/blueprint";
import { Button, IconButton } from "@/components/ui/button";
import { Field, FieldGrid, Input, Select, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { UploadZone } from "@/components/ui/upload-zone";
import { createSupplier, updateSupplier } from "@/lib/data/supplier-actions";
import {
  CERTIFICATE_OPTIONS,
  COUNTRY_OPTIONS,
  EMPTY_CERTIFICATE,
  EMPTY_CONTACT,
  OWNERSHIP_OPTIONS,
  emptySupplierFormValues,
  supplierFormSchema,
  supplierToFormValues,
  withCurrentValue,
  type SupplierFormValues,
} from "@/lib/suppliers/supplier-schema";
import type { Supplier, SupplierCertificate } from "@/types/domain";

/**
 * Add / Edit supplier — README §1.8, field list §8.1.
 *
 * Prototype: `design-handoff/ODM Supplier Visit.dc.html` lines 653..763.
 * Single column, `max-width:960px`, `padding:22px 24px 0`, seven numbered
 * blocks and a sticky footer bar.
 *
 * Save writes through `createSupplier` / `updateSupplier`, which never redirect:
 * a refused write leaves the user standing in the form they filled in, with the
 * reason on the field that caused it or above the footer when it belongs to no
 * field. The Excel import, the logo slot and the 06 file slots still render the
 * approved control and say which phase brings the behaviour — nothing here
 * pretends to have stored a file.
 */

/** Prototype lines 668, 696, … — the numbered block headings. */
const BLOCK_HEADING: CSSProperties = {
  color: "var(--color-accent-700)",
  margin: "0 0 10px",
};

/** The grid under a block heading — prototype `margin-bottom:26px`. */
const BLOCK_GRID: CSSProperties = { marginBottom: 26 };

/** `.field > label` replicated for a slot that has no single form control. */
const FIELD_LABEL: CSSProperties = {
  display: "block",
  fontSize: 12,
  marginBottom: 5,
  color: "color-mix(in srgb, var(--color-text) 70%, transparent)",
};

/** Prototype line 702 — the "CONTACT 1" eyebrow inside a contact card. */
const CARD_EYEBROW: CSSProperties = {
  font: "10px var(--font-body)",
  letterSpacing: ".12em",
  textTransform: "uppercase",
  color: "var(--color-neutral-600)",
};

/** Prototype lines 752..756 — the five dashed file slots. */
const FILE_SLOTS = [
  "Company Presentation",
  "Product Catalog",
  "Business License",
  "Quality Documents",
  "Other",
] as const;

const FILES_PHASE = "File storage for supplier documents arrives in Phase 4.";

/**
 * The field paths this form draws a `.field-error` for.
 *
 * A server message is only put on a field the user can see. Anything else —
 * a `supplierCode` conflict, a card the form does not render — would land on a
 * control nobody is looking at, so it goes above the footer instead.
 */
const VISIBLE_FIELD_PATHS = new Set(["companyName", "country", "websiteUrl"]);

function drawsFieldError(path: string): boolean {
  return VISIBLE_FIELD_PATHS.has(path) || /^contacts\.\d+\.email$/.test(path);
}

/**
 * Puts each server message where it belongs and reports whether anything was
 * left over, so the caller knows it still has to say something out loud.
 */
function applyFieldErrors(
  fieldErrors: Record<string, string> | undefined,
  setError: UseFormSetError<SupplierFormValues>,
): { placed: number; unplaced: number } {
  let placed = 0;
  let unplaced = 0;

  for (const [path, message] of Object.entries(fieldErrors ?? {})) {
    if (!drawsFieldError(path)) {
      unplaced += 1;
      continue;
    }

    setError(
      path as FieldPath<SupplierFormValues>,
      { type: "server", message },
      // The first message is also where the cursor goes; the rest stay put.
      { shouldFocus: placed === 0 },
    );
    placed += 1;
  }

  return { placed, unplaced };
}

interface BlockProps {
  heading: string;
  children: ReactNode;
}

function Block({ heading, children }: BlockProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <h6 id={headingId} style={BLOCK_HEADING}>
        {heading}
      </h6>
      {children}
    </section>
  );
}

export interface SupplierFormProps {
  /** Omit for Add Supplier; pass the master record for Edit Supplier. */
  supplier?: Supplier;
  /** Certificate copies already collected for `supplier`. */
  certificates?: readonly SupplierCertificate[];
}

export function SupplierForm({ supplier, certificates = [] }: SupplierFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const editing = supplier !== undefined;

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: supplier
      ? supplierToFormValues(supplier, certificates)
      : emptySupplierFormValues(),
  });

  const contacts = useFieldArray({ control, name: "contacts" });
  const certificateRows = useFieldArray({ control, name: "certificates" });

  // The select only has to be able to *hold* the stored country, so the option
  // list is derived from the record once rather than watched.
  const countryOptions = withCurrentValue(COUNTRY_OPTIONS, supplier?.country ?? "");
  const logoLabelId = useId();

  // The zone is a real <label> over a hidden <input type="file">, so the whole
  // row already opens the picker. The prototype also draws a "Choose file"
  // button outside that label — it opens the same input rather than sitting
  // there dead.
  const importZone = useRef<HTMLDivElement>(null);
  const openImportPicker = () => {
    importZone.current
      ?.querySelector<HTMLInputElement>('input[type="file"]')
      ?.click();
  };

  /** What went wrong that no single field can explain. */
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveErrorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // The footer is sticky, the message is not: bring it into view rather than
    // leaving the user to wonder why Save did nothing.
    if (saveError) saveErrorRef.current?.scrollIntoView({ block: "nearest" });
  }, [saveError]);

  const onSubmit: SubmitHandler<SupplierFormValues> = async (values) => {
    setSaveError(null);

    const result = supplier
      ? await updateSupplier(supplier.id, values)
      : await createSupplier(values);

    if (result.ok) {
      // README §8.2 — "Save → back to the list with a toast."
      toast(
        editing
          ? `${values.companyName} updated.`
          : `${values.companyName} added to the supplier database.`,
      );
      router.push("/suppliers");
      router.refresh();
      return;
    }

    const { placed, unplaced } = applyFieldErrors(result.error.fieldErrors, setError);

    // Demo mode refuses every write, and a refusal with nothing to pin on a
    // field still has to be visible: the user must see why nothing saved.
    if (placed === 0 || unplaced > 0) setSaveError(result.error.message);
  };

  return (
    <form className="anim-rise" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div style={{ padding: "22px 24px 0", maxWidth: 960 }}>
        <h2 style={{ margin: "0 0 3px" }}>
          {editing ? "Edit Supplier" : "Add Supplier"}
        </h2>
        <p className="text-muted" style={{ fontSize: 13, margin: "0 0 14px" }}>
          Supplier records are shared across all reports — enter data once.
        </p>

        {/* Excel import — parsing the sheet is Phase 3; the file is accepted
            and the user is told, never silently dropped. */}
        <div ref={importZone} style={{ marginBottom: 22 }}>
          <UploadZone
            variant="inline"
            title="Import the supplier data sheet (.xlsx)"
            description="The sheet sent to every new supplier — its columns fill the fields below automatically."
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onFiles={(files) =>
              toast(
                `"${files[0].name}" received — the data-sheet parser arrives in Phase 3.`,
              )
            }
            status={
              <Button
                style={{ fontSize: 12, background: "var(--color-bg)" }}
                onClick={openImportPicker}
              >
                Choose file
              </Button>
            }
          />
        </div>

        {/* ── 01 ─────────────────────────────────────────────────────────── */}
        <Block heading="01 · Company Data Sheet">
          <FieldGrid columns={3} gap={12} style={BLOCK_GRID}>
            <Field label="Company Name" required error={errors.companyName?.message}>
              <Input
                placeholder="e.g. Shimge Pump Industry (Zhejiang) Co., Ltd"
                autoComplete="organization"
                {...register("companyName")}
              />
            </Field>
            <Field label="Company President">
              <Input placeholder="Xu Longbo" {...register("presidentName")} />
            </Field>
            <Field label="Established Year">
              <Input placeholder="1984" {...register("establishedYear")} />
            </Field>
            <Field label="Company Capital">
              <Input placeholder="CNY 3,800,000,000" {...register("companyCapital")} />
            </Field>
            <Field label="Number of Employees">
              <Input placeholder="3,500" {...register("employees")} />
            </Field>
            <Field label="Factory Size (m²)">
              <Input placeholder="283,000" {...register("factorySizeM2")} />
            </Field>
            <Field label="Production Capacity (units / year)">
              <Input placeholder="15,000,000" {...register("productionCapacity")} />
            </Field>
            <Field label="Certification (ISO etc.)" style={{ gridColumn: "span 2" }}>
              <Input
                placeholder="ISO9001, ISO14001, CE, CSA, RoHS, UL"
                {...register("certifications")}
              />
            </Field>
            <Field label="Country" required error={errors.country?.message}>
              <Select {...register("country")}>
                <option value="">Select a country</option>
                {countryOptions.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Region / Province / State">
              <Input placeholder="Zhejiang" {...register("region")} />
            </Field>
            <Field label="City">
              <Input placeholder="Taizhou" {...register("city")} />
            </Field>
            <Field label="Address (street / plot)" style={{ gridColumn: "span 2" }}>
              <Input
                placeholder="No.3 Bihai Street, Eastern New District, Wenling, Taizhou"
                {...register("address")}
              />
            </Field>
            <Field label="Tel (start with +)">
              <Input placeholder="+86-576-86339960" {...register("tel")} />
            </Field>
            <Field label="Company Website URL" error={errors.websiteUrl?.message}>
              <Input
                placeholder="www.shimgepump.com"
                inputMode="url"
                {...register("websiteUrl")}
              />
            </Field>
            <Field
              label="Track Record — EBARA Group"
              style={{ gridColumn: "span 2" }}
            >
              <Input
                placeholder="Previous supply to EBARA companies, if any"
                {...register("trackRecordEbara")}
              />
            </Field>

            <div className="field" style={{ gridColumn: "span 3" }}>
              <span id={logoLabelId} style={FIELD_LABEL}>
                Supplier Logo
              </span>
              <Blueprint
                dashed
                style={{ padding: 14, display: "flex", alignItems: "center", gap: 12 }}
              >
                <Icon name="image" size={18} style={{ opacity: 0.4, flex: "none" }} />
                <span style={{ fontSize: 12.5, flex: 1 }}>
                  PNG or SVG, transparent background preferred
                </span>
                <Button
                  style={{ fontSize: 12 }}
                  aria-describedby={logoLabelId}
                  onClick={() => toast(FILES_PHASE)}
                >
                  Choose file
                </Button>
              </Blueprint>
            </div>
          </FieldGrid>
        </Block>

        {/* ── 02 ─────────────────────────────────────────────────────────── */}
        <Block heading="02 · Person in Charge (Sales)">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginBottom: 12,
            }}
          >
            {contacts.fields.map((field, index) => (
              <Blueprint
                key={field.id}
                role="group"
                aria-label={`Contact ${index + 1}`}
                style={{ padding: 12 }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <span style={CARD_EYEBROW}>Contact {index + 1}</span>
                  <div style={{ flex: 1 }} />
                  <IconButton
                    label={`Remove contact ${index + 1}`}
                    name="trash"
                    variant="secondary"
                    size={26}
                    iconSize={13}
                    onClick={() => contacts.remove(index)}
                  />
                </div>
                <FieldGrid columns={5} gap={10}>
                  <Field label="Contact Person">
                    <Input
                      placeholder="Name"
                      {...register(`contacts.${index}.name` as const)}
                    />
                  </Field>
                  <Field label="Position">
                    <Input
                      placeholder="Position"
                      {...register(`contacts.${index}.role` as const)}
                    />
                  </Field>
                  <Field
                    label="Email"
                    error={errors.contacts?.[index]?.email?.message}
                  >
                    <Input
                      type="email"
                      placeholder="name@company.com"
                      {...register(`contacts.${index}.email` as const)}
                    />
                  </Field>
                  <Field label="Phone">
                    <Input
                      placeholder="+86"
                      {...register(`contacts.${index}.phone` as const)}
                    />
                  </Field>
                  <Field label="WeChat">
                    <Input
                      placeholder="ID"
                      {...register(`contacts.${index}.wechat` as const)}
                    />
                  </Field>
                </FieldGrid>
              </Blueprint>
            ))}
          </div>
          <Button
            size="toolbar"
            icon="plus"
            style={{ marginBottom: 26 }}
            onClick={() => contacts.append({ ...EMPTY_CONTACT })}
          >
            Add Contact
          </Button>
        </Block>

        {/* ── 03 ─────────────────────────────────────────────────────────── */}
        <Block heading="03 · Commercial Information">
          <FieldGrid columns={3} gap={12} style={BLOCK_GRID}>
            <Field label="Annual Revenue">
              <Input placeholder="USD 1.1 bn" {...register("annualRevenue")} />
            </Field>
            <Field label="Ownership Type">
              <Select {...register("ownershipType")}>
                <option value="">Not stated</option>
                {OWNERSHIP_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Main Markets">
              <Input
                placeholder="North America, Europe, Japan"
                {...register("mainMarkets")}
              />
            </Field>
          </FieldGrid>
        </Block>

        {/* ── 04 ─────────────────────────────────────────────────────────── */}
        <Block heading="04 · Products">
          <FieldGrid columns={2} gap={12} style={BLOCK_GRID}>
            <Field label="Main Products" style={{ gridColumn: "span 2" }}>
              <Textarea
                minHeight={64}
                placeholder="Rubber flexible cables, thermoset wire, portable power cables…"
                {...register("mainProducts")}
              />
            </Field>
            <Field label="Product Categories">
              <Input placeholder="Comma separated" {...register("productCategories")} />
            </Field>
            <Field label="Production Capabilities">
              <Input
                placeholder="Extrusion, vulcanising, stranding, testing"
                {...register("productionCapabilities")}
              />
            </Field>
          </FieldGrid>
        </Block>

        {/* ── 05 ─────────────────────────────────────────────────────────── */}
        <Block heading="05 · Certificates">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginBottom: 12,
            }}
          >
            {certificateRows.fields.map((field, index) => (
              <Blueprint
                key={field.id}
                role="group"
                aria-label={`Certificate ${index + 1}`}
                style={{ padding: 12 }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.4fr 1fr 1fr 1fr auto",
                    gap: 10,
                    alignItems: "end",
                  }}
                >
                  <Field label="Certificate">
                    <Select {...register(`certificates.${index}.name` as const)}>
                      <option value="">Select a certificate</option>
                      {withCurrentValue(
                        CERTIFICATE_OPTIONS,
                        field.name,
                      ).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Certificate number">
                    <Input {...register(`certificates.${index}.number` as const)} />
                  </Field>
                  <Field label="Issue date">
                    <Input
                      type="date"
                      {...register(`certificates.${index}.issueDate` as const)}
                    />
                  </Field>
                  <Field label="Expiration date">
                    <Input
                      type="date"
                      {...register(`certificates.${index}.expirationDate` as const)}
                    />
                  </Field>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button
                      style={{ fontSize: 12, height: 36 }}
                      aria-label={`Upload file for certificate ${index + 1}`}
                      onClick={() => toast(FILES_PHASE)}
                    >
                      Upload file
                    </Button>
                    <IconButton
                      label={`Remove certificate ${index + 1}`}
                      name="trash"
                      variant="secondary"
                      size={36}
                      iconSize={13}
                      onClick={() => certificateRows.remove(index)}
                    />
                  </div>
                </div>
              </Blueprint>
            ))}
          </div>
          <Button
            size="toolbar"
            icon="plus"
            style={{ marginBottom: 26 }}
            onClick={() => certificateRows.append({ ...EMPTY_CERTIFICATE })}
          >
            Add Certificate
          </Button>
        </Block>

        {/* ── 06 ─────────────────────────────────────────────────────────── */}
        <Block heading="06 · Files">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
              gap: 10,
              marginBottom: 26,
            }}
          >
            {FILE_SLOTS.map((slot) => (
              <Blueprint
                key={slot}
                as="button"
                type="button"
                dashed
                onClick={() => toast(FILES_PHASE)}
                style={{
                  padding: "14px 10px",
                  textAlign: "center",
                  width: "100%",
                  background: "transparent",
                  color: "inherit",
                  font: "inherit",
                  cursor: "pointer",
                }}
              >
                <Icon
                  name="upload"
                  size={16}
                  style={{ opacity: 0.4, margin: "0 auto 6px" }}
                />
                <span style={{ fontSize: 11.5, display: "block" }}>{slot}</span>
              </Blueprint>
            ))}
          </div>
        </Block>

        {/* ── 07 ─────────────────────────────────────────────────────────── */}
        {/* The prototype draws this textarea with no field label — the block
            heading is its label, so it is wired as one rather than left
            nameless (README §24). */}
        <Block heading="07 · Internal Notes">
          <Textarea
            minHeight={110}
            style={{ marginBottom: 18 }}
            aria-label="Internal notes"
            placeholder="Not exported to the report. Commercial context, red flags, negotiation history…"
            {...register("internalNotes")}
          />
        </Block>

        {/* Directly above the sticky footer, so the reason and the button that
            produced it are read together (README §22). */}
        <div ref={saveErrorRef}>
          {saveError ? (
            <ErrorState className="mb-[18px]" message={saveError} />
          ) : null}
        </div>
      </div>

      <div
        style={{
          position: "sticky",
          bottom: 0,
          background: "var(--color-bg)",
          borderTop: "1px solid var(--color-divider)",
          padding: "12px 24px",
          display: "flex",
          gap: 10,
          alignItems: "center",
          maxWidth: 960,
        }}
      >
        <span
          style={{ fontSize: 11.5, color: "var(--color-neutral-600)", flex: 1 }}
        >
          Draft kept locally — nothing is lost if the connection drops.
        </span>
        <Button onClick={() => router.push("/suppliers")}>Cancel</Button>
        <Button type="submit" variant="primary" loading={isSubmitting}>
          Save Supplier
        </Button>
      </div>
    </form>
  );
}
