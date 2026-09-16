/**
 * Validation and default values for the Add / Edit supplier form — README §1.8
 * and §8.1.
 *
 * The field set and its order are the Excel data sheet EBARA sends to every new
 * supplier (§8.1), extended with the commercial, product, certificate, file and
 * internal-note blocks the approved prototype draws
 * (`design-handoff/ODM Supplier Visit.dc.html` lines 653..763).
 *
 * Only `companyName` and `country` are required: the data sheet comes back from
 * the supplier partially filled far more often than not, and a form that
 * refuses a partial sheet is a form nobody can save. Everything else is an
 * optional string that is validated only once it carries a value.
 *
 * No React here — the form component owns the rendering, this module owns the
 * contract.
 */

import { z } from "zod";

import type { Supplier, SupplierCertificate } from "@/types/domain";

// ─────────────────────────────────────────────────────────────────────────────
// Option lists — the prototype's select vocabularies
// ─────────────────────────────────────────────────────────────────────────────

/** Prototype line 679 — the Country select. */
export const COUNTRY_OPTIONS = ["China", "Vietnam", "India", "Italy"] as const;

/** Prototype line 723 — the Ownership Type select. */
export const OWNERSHIP_OPTIONS = [
  "Public (listed)",
  "Private",
  "State-owned",
  "Joint venture",
] as const;

/** Prototype line 738 — the Certificate select. */
export const CERTIFICATE_OPTIONS = [
  "ISO 9001",
  "ISO 14001",
  "ISO 45001",
  "CE",
  "UL",
  "FM",
  "CSA",
] as const;

/**
 * A stored record may legitimately hold a value the prototype's fixed list does
 * not carry — a supplier in a country outside the seeded four, or a certificate
 * written as "ISO 9001:2015". Dropping it silently would corrupt the record on
 * the first save, so the select grows by exactly that one option instead.
 */
export function withCurrentValue(
  options: readonly string[],
  value: string,
): readonly string[] {
  const trimmed = value.trim();
  if (trimmed === "" || options.includes(trimmed)) return options;
  return [trimmed, ...options];
}

// ─────────────────────────────────────────────────────────────────────────────
// Formats
// ─────────────────────────────────────────────────────────────────────────────

const EMAIL = z.email();

/**
 * Website acceptance is deliberately loose. The seeded records hold bare hosts
 * ("htcablewire.com", "www.shimgepump.com") because that is what the suppliers
 * write on the sheet; `z.url()` rejects every one of them, which would make
 * real master data unsavable. So: an optional scheme, at least one dot-separated
 * label, a 2+ letter TLD, an optional port and an optional path/query/fragment.
 */
const WEBSITE_PATTERN =
  /^(?:https?:\/\/)?(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d{2,5})?(?:[/?#]\S*)?$/i;

/** An optional text field: trimmed, never rejected. */
const optionalText = z.string().trim();

/** Validated as an e-mail address only once the field carries something. */
function optionalEmail(message: string) {
  return optionalText.refine(
    (value) => value === "" || EMAIL.safeParse(value).success,
    { message },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

export const supplierContactSchema = z.object({
  name: optionalText,
  role: optionalText,
  email: optionalEmail("Enter a valid e-mail address, e.g. name@company.com."),
  phone: optionalText,
  wechat: optionalText,
});

export const supplierCertificateSchema = z.object({
  name: optionalText,
  number: optionalText,
  issueDate: optionalText,
  expirationDate: optionalText,
});

export const supplierFormSchema = z.object({
  // 01 · Company Data Sheet — §8.1, in the sheet's own column order.
  companyName: optionalText.min(1, "Company name is required."),
  presidentName: optionalText,
  establishedYear: optionalText,
  companyCapital: optionalText,
  employees: optionalText,
  factorySizeM2: optionalText,
  productionCapacity: optionalText,
  certifications: optionalText,
  country: optionalText.min(1, "Country is required."),
  region: optionalText,
  city: optionalText,
  address: optionalText,
  tel: optionalText,
  websiteUrl: optionalText.refine(
    (value) => value === "" || WEBSITE_PATTERN.test(value),
    { message: "Enter a website like www.example.com or https://example.com." },
  ),
  trackRecordEbara: optionalText,

  // 02 · Person in Charge (Sales)
  contacts: z.array(supplierContactSchema),

  // 03 · Commercial Information
  annualRevenue: optionalText,
  ownershipType: optionalText,
  mainMarkets: optionalText,

  // 04 · Products
  mainProducts: optionalText,
  productCategories: optionalText,
  productionCapabilities: optionalText,

  // 05 · Certificates
  certificates: z.array(supplierCertificateSchema),

  // 07 · Internal Notes
  internalNotes: optionalText,
});

export type SupplierFormValues = z.infer<typeof supplierFormSchema>;
export type SupplierContactValues = z.infer<typeof supplierContactSchema>;
export type SupplierCertificateValues = z.infer<typeof supplierCertificateSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Default values
// ─────────────────────────────────────────────────────────────────────────────

export const EMPTY_CONTACT: SupplierContactValues = {
  name: "",
  role: "",
  email: "",
  phone: "",
  wechat: "",
};

export const EMPTY_CERTIFICATE: SupplierCertificateValues = {
  name: "",
  number: "",
  issueDate: "",
  expirationDate: "",
};

/** Add Supplier — one blank contact card and one blank certificate row. */
export function emptySupplierFormValues(): SupplierFormValues {
  return {
    companyName: "",
    presidentName: "",
    establishedYear: "",
    companyCapital: "",
    employees: "",
    factorySizeM2: "",
    productionCapacity: "",
    certifications: "",
    country: "",
    region: "",
    city: "",
    address: "",
    tel: "",
    websiteUrl: "",
    trackRecordEbara: "",
    contacts: [{ ...EMPTY_CONTACT }],
    annualRevenue: "",
    ownershipType: "",
    mainMarkets: "",
    mainProducts: "",
    productCategories: "",
    productionCapabilities: "",
    certificates: [{ ...EMPTY_CERTIFICATE }],
    internalNotes: "",
  };
}

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

/**
 * `<input type="date">` only accepts `yyyy-mm-dd`. The seeded certificates store
 * the human form the certificate itself prints ("18 Mar 2024"), so convert it —
 * and return "" for anything that does not parse rather than feeding the control
 * a value it will silently discard.
 */
export function toDateInputValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const match = /^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/.exec(trimmed);
  if (!match) return "";

  const month = MONTHS.indexOf(match[2].slice(0, 3).toLowerCase());
  if (month < 0) return "";

  return `${match[3]}-${String(month + 1).padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

/**
 * Edit Supplier — the live master record mapped onto the form.
 *
 * The record does not yet carry the commercial block, the product prose or the
 * production capabilities (they are not columns of the §8.1 sheet), so those
 * fields open blank. `certificates` takes the collected copies; a supplier with
 * none opens on a single blank row, exactly as the prototype draws it.
 */
export function supplierToFormValues(
  supplier: Supplier,
  certificates: readonly SupplierCertificate[] = [],
): SupplierFormValues {
  const base = emptySupplierFormValues();

  return {
    ...base,
    companyName: supplier.legalName,
    presidentName: supplier.presidentName ?? "",
    establishedYear: supplier.establishedYear ?? "",
    companyCapital: supplier.companyCapital ?? "",
    employees: supplier.employees ?? "",
    factorySizeM2: supplier.factorySizeM2 ?? "",
    productionCapacity: supplier.productionCapacity ?? "",
    certifications: supplier.certifications ?? "",
    country: supplier.country,
    region: supplier.region ?? "",
    city: supplier.city ?? "",
    address: supplier.address ?? "",
    tel: supplier.tel ?? "",
    websiteUrl: supplier.websiteUrl ?? "",
    trackRecordEbara: supplier.trackRecordEbara ?? "",
    // The commercial block. Omitting these here is not cosmetic: the update
    // writes every column it builds, so a field the form never loaded would be
    // saved back as null and the record would lose it on an unrelated edit.
    annualRevenue: supplier.annualRevenue ?? "",
    ownershipType: supplier.ownershipType ?? "",
    mainMarkets: supplier.mainMarkets ?? "",
    mainProducts: supplier.mainProducts ?? "",
    productionCapabilities: supplier.productionCapabilities ?? "",
    contacts:
      supplier.contacts.length > 0
        ? supplier.contacts.map((contact) => ({
            name: contact.name,
            role: contact.role,
            email: contact.email,
            phone: contact.phone,
            wechat: contact.wechat,
          }))
        : [{ ...EMPTY_CONTACT }],
    productCategories: supplier.productCategories ?? "",
    certificates:
      certificates.length > 0
        ? certificates.map((certificate) => ({
            name: certificate.name,
            number: certificate.number,
            issueDate: toDateInputValue(certificate.issueDate),
            expirationDate: toDateInputValue(certificate.expirationDate),
          }))
        : [{ ...EMPTY_CERTIFICATE }],
    internalNotes: supplier.internalNotes ?? "",
  };
}
