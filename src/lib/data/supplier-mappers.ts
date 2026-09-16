/**
 * Row ⇄ domain mapping for the supplier tables.
 *
 * Phase 2 §24: `suppliers.ts` (reads) and `supplier-actions.ts` (writes) are the
 * only modules that touch `suppliers`, `supplier_contacts` and
 * `supplier_certificates`, and this file is the only place that knows what their
 * columns are called. Everything here is pure — no Supabase client, no React,
 * no clock except the one the caller passes in — so the shapes can be checked
 * without a project.
 *
 * Two conventions run through the whole file:
 *   · an empty string from a form becomes `null` in the database — the UI draws
 *     the em dash from `null`, so storing "—" would make the dash itself data;
 *   · a `null` from the database becomes `null` in the domain, except where the
 *     domain model already declares the field a plain string (contact details,
 *     certificate numbers and dates), which then read as "".
 */

import type {
  SupplierCertificateValues,
  SupplierContactValues,
  SupplierFormValues,
} from "@/lib/suppliers/supplier-schema";
import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";
import type {
  CertificateStatus,
  DataSheetState,
  Supplier,
  SupplierCertificate,
  SupplierContact,
  SupplierSnapshot,
  SupplierStatus,
} from "@/types/domain";

// ─────────────────────────────────────────────────────────────────────────────
// Row shapes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Names for the generated row shapes, so a signature below reads as the table
 * it maps rather than as an index into `Database`. `src/types/database.ts`
 * already tracks the 0003 columns, so nothing is restated here.
 */
export type SupplierRow = Tables<"suppliers">;
export type SupplierInsert = TablesInsert<"suppliers">;
export type SupplierUpdate = TablesUpdate<"suppliers">;

export type SupplierContactRow = Tables<"supplier_contacts">;
export type SupplierContactInsert = TablesInsert<"supplier_contacts">;
export type SupplierContactUpdate = TablesUpdate<"supplier_contacts">;

export type SupplierCertificateRow = Tables<"supplier_certificates">;
export type SupplierCertificateInsert = TablesInsert<"supplier_certificates">;
export type SupplierCertificateUpdate = TablesUpdate<"supplier_certificates">;

// ─────────────────────────────────────────────────────────────────────────────
// Form values the approved form does not draw yet
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What a write accepts.
 *
 * `SupplierFormValues` is the §8.1 data sheet, which is the approved form. The
 * record gained five more fields in Phase 2 (the short display name, the
 * Chinese name, the EBARA supplier code and the two lifecycle enums) that the
 * form does not draw yet. They are accepted when a caller supplies them and
 * derived or left to the column default when it does not, so the mappers keep
 * working whether or not the form grows those inputs.
 */
export type SupplierWriteValues = SupplierFormValues &
  Partial<{
    shortName: string;
    chineseName: string;
    supplierCode: string;
    status: SupplierStatus;
    dataSheetState: DataSheetState;
  }>;

/** A contact row as a caller writes it: the form card plus its two row flags. */
export type SupplierContactWriteValues = SupplierContactValues &
  Partial<{ isPrimary: boolean; sortOrder: number }>;

/**
 * A certificate as a caller writes it. `id` decides insert vs update, and the
 * two extra fields exist on the row but not on the form: a declared
 * certification becomes `valid` only once a copy is verified during a visit.
 */
export type SupplierCertificateWriteValues = SupplierCertificateValues &
  Partial<{ id: string; status: CertificateStatus; notes: string; sortOrder: number }>;

// ─────────────────────────────────────────────────────────────────────────────
// Scalars
// ─────────────────────────────────────────────────────────────────────────────

/** Trim, and store an empty field as `null` rather than "". */
export function toNullable(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** A column the domain model declares a plain string. */
function text(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

const MONTH_NAMES = [
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

/** `2026-08-12` → `[2026, "Aug", 12]`, or null for anything that is not a date column. */
function splitDate(value: string | null): { year: string; month: string; day: string } | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;

  const month = MONTH_NAMES[Number(match[2]) - 1];
  if (!month) return null;

  return { year: match[1], month, day: match[3] };
}

/**
 * `2026-08-12` → `Aug 12, 2026`.
 *
 * The list, the detail header and the Overview tab print `lastVisitDate`
 * verbatim (the Overview tab even splits it on the comma to get "Aug 12"), so
 * the display form is the contract, not a rendering detail. Parsed by hand
 * rather than through `Date`, which would shift the day across a timezone.
 */
export function toDisplayDate(value: string | null): string | null {
  const parts = splitDate(value);
  return parts ? `${parts.month} ${parts.day}, ${parts.year}` : null;
}

/**
 * `2024-03-18` → `18 Mar 2024` — the form a certificate itself prints, which is
 * what the Certificates tab shows and what `toDateInputValue()` reads back.
 *
 * The day keeps its leading zero: the approved prototype's `CERTS` rows are
 * written `02 Feb 2022` and `05 Apr 2024`, and the seed copies them, so
 * stripping it would print a different date in Supabase mode than in demo mode.
 */
export function toCertificateDate(value: string | null): string {
  const parts = splitDate(value);
  return parts ? `${parts.day} ${parts.month} ${parts.year}` : "";
}

const LEGAL_SUFFIXES =
  /[\s,]*\b(co\.?|company|corp\.?|corporation|inc\.?|incorporated|ltd\.?|limited|llc|plc|group|holdings?|industry|industries)\b\.?/gi;

/**
 * A display name for a record whose form only collected the legal name.
 *
 * "Shimge Pump Industry (Zhejiang) Co., Ltd" → "Shimge Pump". A supplier's real
 * short name ("SHIMGE") is a human decision, so this is a starting point the
 * user can correct on the record, never a value worth overwriting: callers pass
 * `shortName` whenever they have one.
 */
export function deriveShortName(companyName: string): string {
  const withoutQualifiers = companyName.replace(/\([^)]*\)/g, " ");
  const stripped = withoutQualifiers.replace(LEGAL_SUFFIXES, " ").replace(/\s+/g, " ").trim();
  const candidate = stripped.replace(/[,.\s]+$/, "");
  const fallback = companyName.trim();

  if (candidate === "") return fallback.slice(0, 40);
  return candidate.length > 40 ? candidate.slice(0, 40).trimEnd() : candidate;
}

// ─────────────────────────────────────────────────────────────────────────────
// Row → domain
// ─────────────────────────────────────────────────────────────────────────────

export function rowToContact(row: SupplierContactRow): SupplierContact {
  return {
    id: row.id,
    name: row.name,
    role: text(row.role),
    email: text(row.email),
    phone: text(row.phone),
    wechat: text(row.wechat),
    isPrimary: row.is_primary,
    sortOrder: row.sort_order,
  };
}

export function rowToCertificate(row: SupplierCertificateRow): SupplierCertificate {
  return {
    id: row.id,
    name: row.name,
    number: text(row.number),
    issueDate: toCertificateDate(row.issue_date),
    expirationDate: toCertificateDate(row.expiration_date),
    status: row.status,
    fileName: row.file_name,
    notes: row.notes,
    sortOrder: row.sort_order,
  };
}

/** The primary contact first, then the author's own order. */
function sortContacts(contacts: SupplierContact[]): SupplierContact[] {
  return contacts.sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name, "en");
  });
}

export function rowToSupplier(
  row: SupplierRow,
  contacts: readonly SupplierContactRow[],
  reportCount: number,
): Supplier {
  const mapped = sortContacts(contacts.map(rowToContact));
  const primary = mapped.find((contact) => contact.isPrimary) ?? mapped[0];

  return {
    id: row.id,
    shortName: row.short_name,
    legalName: row.legal_name,
    chineseName: row.chinese_name,
    supplierCode: row.supplier_code,
    establishedYear: row.established_year,
    companyCapital: row.company_capital,
    employees: row.employees,
    factorySizeM2: row.factory_size_m2,
    certifications: row.certifications,
    productionCapacity: row.production_capacity,
    presidentName: row.president_name,
    websiteUrl: row.website_url,
    country: row.country,
    region: row.region,
    city: row.city,
    address: row.address,
    tel: row.tel,

    // The data-sheet columns are the source; the contact rows only fill in for
    // a record whose sheet arrived without the sales block.
    contactName: row.contact_name ?? primary?.name ?? null,
    contactTitle: row.contact_title ?? (primary?.role || null),
    contactWechat: row.contact_wechat ?? (primary?.wechat || null),
    contactEmail: row.contact_email ?? (primary?.email || null),
    trackRecordEbara: row.track_record_ebara,

    annualRevenue: row.annual_revenue,
    ownershipType: row.ownership_type,
    mainMarkets: row.main_markets,
    mainProducts: row.main_products,
    productionCapabilities: row.production_capabilities,

    productCategories: row.product_categories,
    status: row.status,
    dataSheetState: row.data_sheet_state,
    lastVisitDate: toDisplayDate(row.last_visit_date),
    reportCount,
    internalNotes: row.internal_notes,
    // Visit photos live on `report_images` and are attached by the report data
    // layer; the Overview tab hides the block while the list is empty.
    visitPhotoIds: [],
    contacts: mapped,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain / form → row
// ─────────────────────────────────────────────────────────────────────────────

/** The card the data sheet calls "Person in charge (Sales)". */
function primaryContactOf(values: SupplierWriteValues): SupplierContactValues | undefined {
  return values.contacts.find((contact) => contact.name.trim() !== "");
}

/**
 * The §8.1 columns that both the insert and the update write.
 *
 * `suppliers.contact_*` mirrors the first sales contact on purpose: those four
 * columns are part of the Excel sheet, so they stay in step with the contact
 * cards instead of drifting away from them.
 */
function supplierColumns(values: SupplierWriteValues): SupplierUpdate {
  const primary = primaryContactOf(values);

  return {
    legal_name: values.companyName.trim(),
    established_year: toNullable(values.establishedYear),
    company_capital: toNullable(values.companyCapital),
    employees: toNullable(values.employees),
    factory_size_m2: toNullable(values.factorySizeM2),
    certifications: toNullable(values.certifications),
    production_capacity: toNullable(values.productionCapacity),
    president_name: toNullable(values.presidentName),
    website_url: toNullable(values.websiteUrl),
    country: values.country.trim(),
    region: toNullable(values.region),
    city: toNullable(values.city),
    address: toNullable(values.address),
    tel: toNullable(values.tel),
    contact_name: toNullable(primary?.name),
    contact_title: toNullable(primary?.role),
    contact_wechat: toNullable(primary?.wechat),
    contact_email: toNullable(primary?.email),
    track_record_ebara: toNullable(values.trackRecordEbara),

    annual_revenue: toNullable(values.annualRevenue),
    ownership_type: toNullable(values.ownershipType),
    main_markets: toNullable(values.mainMarkets),
    main_products: toNullable(values.mainProducts),
    production_capabilities: toNullable(values.productionCapabilities),
    product_categories: toNullable(values.productCategories),
    internal_notes: toNullable(values.internalNotes),
  };
}

export function supplierToInsert(values: SupplierWriteValues, userId: string): SupplierInsert {
  const shortName = toNullable(values.shortName) ?? deriveShortName(values.companyName);

  return {
    ...supplierColumns(values),
    legal_name: values.companyName.trim(),
    country: values.country.trim(),
    short_name: shortName,
    // A new record has nothing to lose, so an absent field is simply empty.
    chinese_name: toNullable(values.chineseName),
    supplier_code: toNullable(values.supplierCode),
    // `status` and `data_sheet_state` fall back to the column defaults
    // ('prospect' / 'pending'): a record typed by hand is a prospect whose sheet
    // has not arrived, and nothing in the form claims otherwise.
    ...(values.status ? { status: values.status } : {}),
    ...(values.dataSheetState ? { data_sheet_state: values.dataSheetState } : {}),
    created_by: userId,
    updated_by: userId,
  };
}

/**
 * The update deliberately omits `status`, `data_sheet_state` and
 * `last_visit_date` unless the caller passes them: they are set by the
 * qualification workflow and by the reports, and correcting a typo in the
 * address must not reset a supplier to "prospect". `updated_at` is stamped by
 * the table's own trigger.
 *
 * The Chinese name and the supplier code are omitted on the same principle but
 * for a different reason: the approved form does not draw them, so a caller
 * editing the data sheet never supplies them, and writing them unconditionally
 * would clear both columns every time somebody corrected an address. The test
 * is `undefined` rather than truthiness, so a caller that DOES draw them can
 * still clear one by passing "".
 */
export function supplierToUpdate(values: SupplierWriteValues, userId: string): SupplierUpdate {
  const shortName = toNullable(values.shortName);

  return {
    ...supplierColumns(values),
    ...(shortName ? { short_name: shortName } : {}),
    ...(values.chineseName !== undefined
      ? { chinese_name: toNullable(values.chineseName) }
      : {}),
    ...(values.supplierCode !== undefined
      ? { supplier_code: toNullable(values.supplierCode) }
      : {}),
    ...(values.status ? { status: values.status } : {}),
    ...(values.dataSheetState ? { data_sheet_state: values.dataSheetState } : {}),
    updated_by: userId,
  };
}

export function contactToInsert(
  supplierId: string,
  values: SupplierContactWriteValues,
  sortOrder: number,
  isPrimary: boolean,
): SupplierContactInsert {
  return {
    supplier_id: supplierId,
    name: values.name.trim(),
    role: values.role.trim(),
    email: values.email.trim(),
    phone: values.phone.trim(),
    wechat: values.wechat.trim(),
    is_primary: values.isPrimary ?? isPrimary,
    sort_order: values.sortOrder ?? sortOrder,
  };
}

export function contactToUpdate(values: SupplierContactWriteValues): SupplierContactUpdate {
  return {
    name: values.name.trim(),
    role: values.role.trim(),
    email: values.email.trim(),
    phone: values.phone.trim(),
    wechat: values.wechat.trim(),
    ...(values.isPrimary === undefined ? {} : { is_primary: values.isPrimary }),
    ...(values.sortOrder === undefined ? {} : { sort_order: values.sortOrder }),
  };
}

export function certificateToInsert(
  supplierId: string,
  values: SupplierCertificateWriteValues,
  sortOrder: number,
): SupplierCertificateInsert {
  return {
    supplier_id: supplierId,
    name: values.name.trim(),
    number: toNullable(values.number),
    issue_date: toNullable(values.issueDate),
    expiration_date: toNullable(values.expirationDate),
    notes: toNullable(values.notes),
    sort_order: values.sortOrder ?? sortOrder,
    // No status: the column defaults to 'declared', which is exactly what a
    // certificate typed from the data sheet is until a copy is verified.
    ...(values.status ? { status: values.status } : {}),
  };
}

export function certificateToUpdate(
  values: SupplierCertificateWriteValues,
): SupplierCertificateUpdate {
  return {
    name: values.name.trim(),
    number: toNullable(values.number),
    issue_date: toNullable(values.issueDate),
    expiration_date: toNullable(values.expirationDate),
    notes: toNullable(values.notes),
    ...(values.status ? { status: values.status } : {}),
    ...(values.sortOrder === undefined ? {} : { sort_order: values.sortOrder }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Report snapshot — README §8.3
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The frozen copy of the supplier a report keeps.
 *
 * THE single place that decides what a report freezes: the report data layer
 * and the `create_report_with_snapshot` RPC both mirror this key set, so it is
 * exactly the `SupplierSnapshot` fields and nothing else. A report is the
 * record of what was true at the visit date, so nothing derived and nothing
 * that keeps moving (status, report count, internal notes) belongs in it.
 *
 * `takenAt` is a parameter so the snapshot stays pure and a test can pin it.
 */
export function buildSnapshot(
  supplier: Supplier,
  takenAt: string = new Date().toISOString(),
): SupplierSnapshot {
  return {
    supplierId: supplier.id,
    takenAt,
    shortName: supplier.shortName,
    legalName: supplier.legalName,
    establishedYear: supplier.establishedYear,
    companyCapital: supplier.companyCapital,
    employees: supplier.employees,
    factorySizeM2: supplier.factorySizeM2,
    certifications: supplier.certifications,
    productionCapacity: supplier.productionCapacity,
    presidentName: supplier.presidentName,
    websiteUrl: supplier.websiteUrl,
    country: supplier.country,
    region: supplier.region,
    city: supplier.city,
    address: supplier.address,
    tel: supplier.tel,
    trackRecordEbara: supplier.trackRecordEbara,
  };
}
