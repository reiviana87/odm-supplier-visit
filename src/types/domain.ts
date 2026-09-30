/**
 * Domain model for the ODM Supplier Visit application.
 *
 * These types mirror the database schema in `supabase/migrations` and the
 * field sets specified in the handoff (README §6.2, §8.1, §9, §10). They are
 * the shared vocabulary between the mock data used in Phase 1 and the
 * Supabase-backed queries that replace it later.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Enumerations
// ─────────────────────────────────────────────────────────────────────────────

/** README §11 — the four report states. Database-safe snake_case. */
export const REPORT_STATUSES = ["draft", "in_review", "final", "archived"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  draft: "Draft",
  in_review: "In Review",
  final: "Final",
  archived: "Archived",
};

/** README §1.6 / §3.2 — supplier qualification state. */
export const SUPPLIER_STATUSES = [
  "prospect",
  "under_qualification",
  "approved",
  "on_hold",
] as const;
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];

export const SUPPLIER_STATUS_LABELS: Record<SupplierStatus, string> = {
  prospect: "Prospect",
  under_qualification: "Under Qualification",
  approved: "Approved",
  on_hold: "On Hold",
};

/** README §1.6 — whether the Excel supplier data sheet was received. */
export const DATA_SHEET_STATES = ["received", "partial", "pending"] as const;
export type DataSheetState = (typeof DATA_SHEET_STATES)[number];

export const DATA_SHEET_LABELS: Record<DataSheetState, string> = {
  received: "Data sheet",
  partial: "Partial",
  pending: "Excel pending",
};

/** README §19 — certificate evidence state. */
export const CERTIFICATE_STATUSES = ["valid", "not_evidenced", "declared", "expired"] as const;
export type CertificateStatus = (typeof CERTIFICATE_STATUSES)[number];

export const CERTIFICATE_STATUS_LABELS: Record<CertificateStatus, string> = {
  valid: "Valid",
  not_evidenced: "Not evidenced",
  declared: "Declared",
  expired: "Expired",
};

/** README §13 — role architecture. Permissions themselves are Phase 3. */
export const USER_ROLES = ["admin", "manager", "editor", "viewer"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** README §10 / §16 — the three image regions with fixed export geometry. */
export const IMAGE_REGIONS = [
  "MAIN_PRODUCT_IMAGES",
  "PARTNER_IMAGES",
  "APPENDIX_IMAGES",
] as const;
export type ImageRegion = (typeof IMAGE_REGIONS)[number];

export const IMAGE_REGION_LABELS: Record<ImageRegion, string> = {
  MAIN_PRODUCT_IMAGES: "Main Products Images",
  PARTNER_IMAGES: "Partners Images",
  APPENDIX_IMAGES: "Appendix Pictures",
};

/** Export geometry per region — README §16 "Special regions". */
export const IMAGE_REGION_GEOMETRY: Record<
  ImageRegion,
  { columns: number; targetHeightCm: number; captionRow: boolean }
> = {
  MAIN_PRODUCT_IMAGES: { columns: 2, targetHeightCm: 7.0, captionRow: false },
  PARTNER_IMAGES: { columns: 2, targetHeightCm: 7.0, captionRow: false },
  APPENDIX_IMAGES: { columns: 2, targetHeightCm: 6.5, captionRow: true },
};

/** README §10 — who wrote a caption. */
export type CaptionSource = "user" | "ai";

/** README §10 — upload lifecycle of a photo card. */
export type PhotoUploadState = "uploading" | "ready" | "failed";

/** README §4 — photo card presentation state. */
export type PhotoCaptionState = "none" | "suggested" | "accepted";

// ─────────────────────────────────────────────────────────────────────────────
// Report sections — README §6.2
// ─────────────────────────────────────────────────────────────────────────────

export const SECTION_IDS = [
  "general",
  "purpose",
  "company",
  "overview",
  "products",
  "product-images",
  "target",
  "visit",
  "certificates",
  "partners",
  "partner-images",
  "conclusion",
  "appendix",
] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export interface SectionDefinition {
  id: SectionId;
  /** Displayed number: "1.", "4.1", or "" for General Information. */
  number: string;
  label: string;
  /** 4.1 and 8.1 are indented 14px in the navigator (README §6.2). */
  isSubSection: boolean;
  /** Which Word placeholder or image region this section feeds (README §16). */
  placeholder: string | null;
}

export const SECTIONS: readonly SectionDefinition[] = [
  { id: "general", number: "", label: "General Information", isSubSection: false, placeholder: null },
  { id: "purpose", number: "1.", label: "Purpose", isSubSection: false, placeholder: "{{PURPOSE}}" },
  { id: "company", number: "2.", label: "Company Information", isSubSection: false, placeholder: "{{COMPANY_INFORMATION}}" },
  { id: "overview", number: "3.", label: "Company Overview", isSubSection: false, placeholder: "{{COMPANY_OVERVIEW}}" },
  { id: "products", number: "4.", label: "Main Products", isSubSection: false, placeholder: "{{MAIN_PRODUCTS}}" },
  { id: "product-images", number: "4.1", label: "Main Products Images", isSubSection: true, placeholder: "MAIN_PRODUCT_IMAGES" },
  { id: "target", number: "5.", label: "Target Products", isSubSection: false, placeholder: "{{TARGET_PRODUCTS}}" },
  { id: "visit", number: "6.", label: "Visit Relevant Information", isSubSection: false, placeholder: "{{VISIT_INFORMATION}}" },
  { id: "certificates", number: "7.", label: "Certificates", isSubSection: false, placeholder: "{{CERTIFICATES}}" },
  { id: "partners", number: "8.", label: "Partners", isSubSection: false, placeholder: "{{PARTNERS}}" },
  { id: "partner-images", number: "8.1", label: "Partners Images", isSubSection: true, placeholder: "PARTNER_IMAGES" },
  { id: "conclusion", number: "9.", label: "Conclusion", isSubSection: false, placeholder: "{{CONCLUSION}}" },
  { id: "appendix", number: "10.", label: "Appendix Pictures", isSubSection: false, placeholder: "APPENDIX_IMAGES" },
] as const;

export function isSectionId(value: string): value is SectionId {
  return (SECTION_IDS as readonly string[]).includes(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// Supplier — README §8.1 (the EBARA supplier data sheet, in column order)
// ─────────────────────────────────────────────────────────────────────────────

export interface Supplier {
  id: string;
  /** Short display name used in tables and headers, e.g. "HEBEI HUATONG". */
  shortName: string;
  /** Legal name as printed on the data sheet. */
  legalName: string;
  /** The name the supplier trades under domestically (中文名). */
  chineseName: string | null;
  /** EBARA's own reference for this supplier. Unique when set. */
  supplierCode: string | null;
  establishedYear: string | null;
  companyCapital: string | null;
  employees: string | null;
  factorySizeM2: string | null;
  /** Free-text list as received, e.g. "ISO9001, ISO14001, CE". */
  certifications: string | null;
  productionCapacity: string | null;
  presidentName: string | null;
  websiteUrl: string | null;
  country: string;
  region: string | null;
  city: string | null;
  address: string | null;
  tel: string | null;
  /** Primary sales contact — mirrored from the first supplier_contacts row. */
  contactName: string | null;
  contactTitle: string | null;
  contactWechat: string | null;
  contactEmail: string | null;
  trackRecordEbara: string | null;

  // ── Commercial and capability profile (Phase 2 §4) ────────────────────────
  /** Free text as declared, e.g. "CNY 7.53 billion (2025)". */
  annualRevenue: string | null;
  /** "Public (listed)", "Private", "Joint venture", "State-owned", … */
  ownershipType: string | null;
  /** Free-text list, e.g. "Europe, North America, Japan". */
  mainMarkets: string | null;
  /** Prose. Distinct from `productCategories`, which is the tag list. */
  mainProducts: string | null;
  /** Prose — casting, machining, winding, assembly, in-house test benches… */
  productionCapabilities: string | null;

  // Derived / application fields
  productCategories: string | null;
  status: SupplierStatus;
  dataSheetState: DataSheetState;
  lastVisitDate: string | null;
  reportCount: number;
  internalNotes: string | null;
  /** Photo ids from past visits, shown on the Overview tab when non-empty. */
  visitPhotoIds: string[];
  contacts: SupplierContact[];

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  createdAt: string;
  updatedAt: string;
  /**
   * Set when the supplier was archived. Phase 2 §33: a supplier that has been
   * visited is never hard-deleted — archiving keeps its reports readable and
   * takes it out of the pickers.
   */
  archivedAt: string | null;
}

export interface SupplierContact {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  wechat: string;
  /** The sales contact shown on the list and the detail header. At most one. */
  isPrimary: boolean;
  sortOrder: number;
}

export interface SupplierCertificate {
  id: string;
  name: string;
  number: string;
  issueDate: string;
  expirationDate: string;
  status: CertificateStatus;
  fileName: string | null;
  notes: string | null;
  sortOrder: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Report
// ─────────────────────────────────────────────────────────────────────────────

/**
 * README §8.3 — the frozen copy of the supplier record taken when the report
 * was created. §2 Company Information and the DOCX export read THIS, never the
 * live supplier row: a report is a record of what was true at the visit date.
 */
export interface SupplierSnapshot {
  supplierId: string;
  takenAt: string;
  shortName: string;
  legalName: string;
  establishedYear: string | null;
  companyCapital: string | null;
  employees: string | null;
  factorySizeM2: string | null;
  certifications: string | null;
  productionCapacity: string | null;
  presidentName: string | null;
  websiteUrl: string | null;
  country: string;
  region: string | null;
  city: string | null;
  address: string | null;
  tel: string | null;
  trackRecordEbara: string | null;
}

export interface ReportSummary {
  id: string;
  documentNumber: string;
  supplierId: string;
  supplierShortName: string;
  visitDate: string;
  /** Display string, e.g. "Tangshan, Hebei". */
  location: string;
  employee: string;
  status: ReportStatus;
  /** 0–100, derived from the section predicates — never stored (README §6.2). */
  completion: number;
  /** Human-readable relative time, e.g. "2h ago". */
  lastUpdatedLabel: string;
  lastUpdatedAt: string;
}

export interface Report extends ReportSummary {
  period: string;
  reportOwner: string;
  members: string[];
  createdAt: string;
  startTime: string | null;
  endTime: string | null;
  project: string | null;
  businessUnit: string | null;
  productCategory: string | null;
  supplierSnapshot: SupplierSnapshot;
  sections: ReportSections;
}

/**
 * One persisted section row, as the editor needs it in order to save.
 *
 * The rendering shape stays `ReportSections` below — flat and easy to read.
 * This is the save-path shape: it carries the `version` the row was loaded at,
 * which the update matches on, so a save detects that another session wrote
 * first instead of silently overwriting it (Phase 2 §18).
 */
export interface SectionRecord {
  sectionId: SectionId;
  body: string;
  /** README §25 — the §4 product table and §6 Q&A block can be excluded. */
  excluded: boolean;
  /** Incremented by the database on every successful patch. */
  version: number;
  updatedAt: string;
}

/** The editable body of a report, one entry per content-bearing section. */
export interface ReportSections {
  purpose: string;
  overview: string;
  mainProducts: string;
  partners: string;
  conclusion: string;
  certificateNote: string;
  targetNotes: string;
  observations: Observation[];
  qaBullets: string[];
  /** README §25 — §6's Q&A block is optional and can be excluded from export. */
  qaIncluded: boolean;
  targetProducts: TargetProduct[];
  productRows: ProductRow[];
}

export interface Observation {
  id: string;
  category: string;
  priority: "Normal" | "High" | "Critical";
  text: string;
  /** Set when the observation came from a transcript finding. */
  sourceFindingId: string | null;
  /**
   * The photograph captured with this observation in the field, if any.
   *
   * A `report_images` id, not bytes of its own (0008): the photograph is the
   * same object the appendix prints, so it is stored once and captioned once.
   */
  imageId: string | null;
}

export interface TargetProduct {
  id: string;
  /** What the product is called, e.g. "RHW-2 submersible pump cable". */
  name: string;
  /** Model or product family, e.g. "100-80-160". */
  model: string;
  /** Where it is used — the application or duty. */
  application: string;
  /** The market the part is intended for, e.g. "North America (UL)". */
  expectedMarket: string;
  /** Standards, ratings and tolerances the part has to meet. */
  technicalRequirements: string;
  /** Free notes carried into §5 of the report. */
  comments: string;
  photoId: string | null;
  sortOrder: number;
}

export interface ProductRow {
  id: string;
  type: string;
  standard: string;
  voltage: string;
  description: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Photos — README §10
// ─────────────────────────────────────────────────────────────────────────────

export interface ReportPhoto {
  id: string;
  /** Resolved URL of the image. */
  src: string;
  caption: string;
  /** The AI's proposal, held separately until the user accepts it (README §11). */
  aiCaption: string;
  captionSource: CaptionSource;
  /** 0–100. Below 85 the card shows "· review required" in warning ink. */
  confidence: number;
  captionState: PhotoCaptionState;
  category: string;
  region: ImageRegion;
  sortOrder: number;
  capturedAt: string | null;
  /**
   * Natural pixel size, measured in the browser at upload (0006). Null when
   * unknown — the DOCX exporter then assumes 4:3 rather than refusing.
   */
  width: number | null;
  height: number | null;
  uploadState: PhotoUploadState;
}

// ─────────────────────────────────────────────────────────────────────────────
// Transcript findings — README §12
// ─────────────────────────────────────────────────────────────────────────────

export type FindingStatus = "open" | "added" | "dismissed";

export interface TranscriptFinding {
  id: string;
  category: string;
  text: string;
  confidence: number;
  targetSection: SectionId;
  status: FindingStatus;
}

// ─────────────────────────────────────────────────────────────────────────────
// Templates — README §16
// ─────────────────────────────────────────────────────────────────────────────

export interface ReportTemplate {
  id: string;
  name: string;
  version: string;
  uploadedBy: string;
  uploadedAt: string;
  isActive: boolean;
  isArchived: boolean;
}

export interface PlaceholderMapping {
  placeholder: string;
  source: string;
  sampleValue: string;
  /** False renders the warning treatment in the status column (README §16). */
  isMapped: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// People
// ─────────────────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  fullName: string;
  email: string;
  jobTitle: string;
  role: UserRole;
  initials: string;
}
