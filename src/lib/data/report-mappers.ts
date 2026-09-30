/**
 * Row ⇄ domain mapping for the report tables.
 *
 * Phase 2 §24: `reports.ts` (reads) and `report-actions.ts` (writes) are the
 * only modules that touch `reports` and its children, and this file is the only
 * place that knows what their columns are called. Everything here is pure — no
 * Supabase client, no React, no clock except the one the caller passes in — so
 * the shapes can be checked without a project.
 *
 * It follows the conventions `supplier-mappers.ts` established, and reuses that
 * module where it already answers the question: `toDisplayDate` prints a visit
 * date, `toNullable` stores a blank field as `null`. Nothing is copied.
 *
 * ## The one persistence decision made here
 *
 * `ReportSections` is flat — seven prose fields, three row collections and a
 * flag — while the database stores thirteen `report_sections` rows plus three
 * child tables. The mapping between them is stated once, in `BODY_FIELD` and
 * `sectionBodyOf()`, and read in both directions from there:
 *
 * | Section row      | Rendering field                                     |
 * |------------------|-----------------------------------------------------|
 * | `purpose`        | `purpose`                                           |
 * | `overview`       | `overview`                                          |
 * | `products`       | `mainProducts`                                      |
 * | `partners`       | `partners`                                          |
 * | `conclusion`     | `conclusion`                                        |
 * | `certificates`   | `certificateNote`                                   |
 * | `target`         | `targetNotes`                                       |
 * | `visit`          | `qaBullets`, one bullet per line, and `qaIncluded`  |
 *
 * **§6's Q&A block is stored as the `visit` row's body, one bullet per line.**
 * A bullet is a sentence, not a record: it has no id, no order of its own and
 * nothing ever points at it, so a table would buy nothing and would make the
 * autosave patch that already exists for every other section a special case.
 * Blank lines are dropped on the way in, so a trailing newline cannot grow the
 * list. `excluded` on that same row is README §25's export toggle, and
 * `qaIncluded` is its inverse: the column says what is left out, the rendering
 * shape says what is kept.
 *
 * The observations of §6 and the target products of §5 are *not* in that body —
 * they are rows in `report_observations` and `report_target_products`, because
 * each one carries fields, an order and (for an observation) the transcript
 * finding it came from.
 */

import { toDisplayDate, toNullable } from "@/lib/data/supplier-mappers";
import { reportCompletion } from "@/lib/reports/completion";
import type { Json, Tables, TablesInsert, TablesUpdate } from "@/types/database";
import {
  SECTION_IDS,
  isSectionId,
  type Observation,
  type ProductRow,
  type Report,
  type ReportPhoto,
  type ReportSections,
  type ReportStatus,
  type ReportSummary,
  type SectionId,
  type SectionRecord,
  type SupplierSnapshot,
  type TargetProduct,
} from "@/types/domain";

// ─────────────────────────────────────────────────────────────────────────────
// Row shapes
// ─────────────────────────────────────────────────────────────────────────────

export type ReportRow = Tables<"reports">;
export type ReportInsert = TablesInsert<"reports">;
export type ReportUpdate = TablesUpdate<"reports">;

export type ReportSectionRow = Tables<"report_sections">;
export type ReportSectionUpdate = TablesUpdate<"report_sections">;

export type ReportMemberRow = Tables<"report_members">;
export type ReportMemberInsert = TablesInsert<"report_members">;

export type ReportObservationRow = Tables<"report_observations">;
export type ReportObservationInsert = TablesInsert<"report_observations">;

export type ReportTargetProductRow = Tables<"report_target_products">;
export type ReportTargetProductInsert = TablesInsert<"report_target_products">;

export type ReportProductRowRow = Tables<"report_product_rows">;

/**
 * A report row as the list and detail selects return it, with the three names
 * the report itself does not store.
 *
 * `reports` has two foreign keys to `profiles`, so the embeds are aliased and
 * hinted by constraint name — `employee:profiles!reports_employee_id_fkey(…)`.
 * Every embed is typed nullable: `employee_id` and `owner_id` are nullable
 * columns, and a caller that selects a report without its joins still type
 * checks against this shape.
 */
export interface ReportJoinedRow extends ReportRow {
  suppliers?: { short_name: string } | null;
  employee?: { full_name: string } | null;
  owner?: { full_name: string } | null;
}

/** The child rows a full `Report` is assembled from. */
export interface ReportChildren {
  sections: readonly ReportSectionRow[];
  members?: readonly ReportMemberRow[];
  observations?: readonly ReportObservationRow[];
  targetProducts?: readonly ReportTargetProductRow[];
  productRows?: readonly ReportProductRowRow[];
  /**
   * The report's images. Three of the thirteen completion predicates count
   * them (README §6.2), so a report assembled without them reads lower than it
   * will once the photo layer passes them in — which is the honest number
   * today, since no image rows exist yet.
   */
  photos?: readonly ReportPhoto[];
}

// ─────────────────────────────────────────────────────────────────────────────
// What a write accepts
//
// These live here rather than in `report-actions.ts` for the reason
// `SupplierWriteValues` does: a "use server" module may only export async
// functions, and a form that wants to type its own state should not have to
// import the action to do it.
// ─────────────────────────────────────────────────────────────────────────────

/** What the New Report modal collects — README §9, step 2. */
export interface CreateReportValues {
  documentNumber: string;
  supplierId: string;
  /** `yyyy-mm-dd`, a local calendar date. */
  visitDate: string;
  /** Derived from the visit date, e.g. "August 2026". */
  period?: string;
  location?: string;
  /** Defaults to the signed-in user — README §9 "Employee: current user". */
  employeeId?: string | null;
  ownerId?: string | null;
  /** `HH:MM`. */
  startTime?: string | null;
  endTime?: string | null;
  project?: string | null;
  businessUnit?: string | null;
  productCategory?: string | null;
  /** Attendee chips, in the order they were entered. */
  members?: string[];
  /** README §12 — a new report is a draft unless the caller says otherwise. */
  status?: ReportStatus;
}

/**
 * The §1 General Information fields an existing report can correct. Every field
 * is optional: an absent key is left alone, an explicit `null` clears it.
 *
 * `supplierId` is deliberately not here. Changing which supplier a report is
 * about would leave the §8.3 snapshot describing a different company than the
 * report names — that is a new report, not an edit.
 */
export interface ReportMetaValues {
  documentNumber?: string;
  visitDate?: string;
  period?: string;
  location?: string;
  employeeId?: string | null;
  ownerId?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  project?: string | null;
  businessUnit?: string | null;
  productCategory?: string | null;
  /** Replaces the whole chip list when present. */
  members?: string[];
}

/** One autosave patch — Phase 2 §18. */
export interface SaveSectionValues {
  reportId: string;
  sectionId: SectionId;
  body: string;
  /** README §25's export toggle. Omitted leaves it as it was. */
  excluded?: boolean;
  /** The version the editor loaded the section at. */
  version: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scalars
// ─────────────────────────────────────────────────────────────────────────────

/** `09:30:00` → `09:30`, the form the editor's time inputs read and write. */
export function toClockTime(value: string | null | undefined): string | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value?.trim() ?? "");
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : null;
}

/**
 * `09:30` → `09:30:00` for a bare `time` column. A blank field and a value that
 * is not a clock time both become `null`: "no end time was recorded" is a fact
 * the database can hold, a half-typed one is not.
 */
export function toTimeValue(value: string | null | undefined): string | null {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value?.trim() ?? "");
  if (!match) return null;
  return `${match[1].padStart(2, "0")}:${match[2]}:${match[3] ?? "00"}`;
}

const PERIOD_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/**
 * `2026-08-12` → `August 2026` — the §1 "Period" field, which README §9 derives
 * from the visit date rather than asking the author for it.
 *
 * Parsed by hand for the reason `splitDate()` in `supplier-mappers.ts` is: a
 * `Date` built from a bare `yyyy-mm-dd` is UTC midnight, which is the previous
 * day west of Greenwich and would name the wrong month for a visit on the 1st.
 * A value that is not a calendar date answers `""`, which is the column's own
 * default — a blank period is a field nobody filled in, not a crash.
 */
export function periodFromVisitDate(visitDate: string): string {
  const match = /^(\d{4})-(\d{2})-\d{2}/.exec(visitDate.trim());
  if (!match) return "";

  const month = PERIOD_MONTHS[Number(match[2]) - 1];
  return month ? `${month} ${match[1]}` : "";
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * The "Last edit" column of README §19 — `2h ago`, `Yesterday`, `Sep 10`.
 *
 * `now` is a parameter and never the process clock: the label is the one piece
 * of a report row that changes without the row changing, so a test has to be
 * able to pin the instant it is read at.
 *
 * The thresholds are read off the approved seed, which labels 17:05 on the 10th
 * "Yesterday" and 08:40 on the same 10th "Sep 10" when read on the 11th at
 * about 13:40. Calendar day alone cannot produce both, and elapsed hours alone
 * cannot either, so the rule is both:
 *
 *   · today            → `2h ago` (`15m ago` under the hour, `Just now` under a minute)
 *   · not today, < 24h → `Yesterday`
 *   · anything older   → `Sep 10`
 *
 * The date form carries no year, exactly as the approved column shows it; a
 * report from a previous year reads as its month and day, which is what the
 * "Visit date" column beside it is there to disambiguate.
 */
export function relativeLabel(iso: string, now: Date): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";

  const elapsed = now.getTime() - then.getTime();

  // A row written "in the future" is clock skew between two machines, not a
  // fact about the report. It reads as the newest thing there is.
  if (elapsed < MINUTE_MS) return "Just now";

  if (sameCalendarDay(then, now)) {
    if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)}m ago`;
    return `${Math.floor(elapsed / HOUR_MS)}h ago`;
  }

  if (elapsed < DAY_MS) return "Yesterday";

  return then.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

/**
 * Phase 2 §33 — an archived report reads as archived.
 *
 * `archived_at` is the soft-delete marker and `status` is the workflow state;
 * they are separate columns on purpose, so archiving does not have to overwrite
 * (and lose) the status the report was in. Deriving the badge here is what lets
 * `archiveReport()` leave `status` alone and a restore put the report back
 * exactly where it was.
 */
function statusOf(row: ReportRow): ReportStatus {
  return row.archived_at ? "archived" : row.status;
}

// ─────────────────────────────────────────────────────────────────────────────
// Supplier snapshot — README §8.3
// ─────────────────────────────────────────────────────────────────────────────

type JsonRecord = Record<string, Json | undefined>;

function asRecord(json: Json | null | undefined): JsonRecord {
  return json !== null && typeof json === "object" && !Array.isArray(json) ? json : {};
}

/**
 * One snapshot field. A number is accepted and printed because the fields are
 * free text on the data sheet ("2005", "120") and an older build — or a hand
 * written row — may have stored one as a number.
 */
function snapshotText(record: JsonRecord, key: string): string | null {
  const value = record[key];
  if (typeof value === "string") return value.trim() === "" ? null : value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/**
 * The frozen supplier record a report carries, read back out of `jsonb`.
 *
 * Deliberately total and deliberately forgiving: a stored snapshot outlives the
 * code that wrote it, so a key that is missing, null, of the wrong type, or the
 * whole column being something other than an object, all resolve to "not
 * recorded" rather than to a crash in §2 Company Information. The four fields
 * the domain model declares non-null read as `""` for the same reason — the UI
 * draws its em dash from an empty value, and a `null` there would be a type
 * error in every consumer.
 *
 * `buildSnapshot()` in `supplier-mappers.ts` is the writing half of this pair
 * and `supplier_snapshot_jsonb()` in migration 0005 is the database's; all
 * three name the same keys.
 */
export function snapshotFromJson(json: Json | null | undefined): SupplierSnapshot {
  const record = asRecord(json);

  return {
    supplierId: snapshotText(record, "supplierId") ?? "",
    takenAt: snapshotText(record, "takenAt") ?? "",
    shortName: snapshotText(record, "shortName") ?? "",
    legalName: snapshotText(record, "legalName") ?? "",
    establishedYear: snapshotText(record, "establishedYear"),
    companyCapital: snapshotText(record, "companyCapital"),
    employees: snapshotText(record, "employees"),
    factorySizeM2: snapshotText(record, "factorySizeM2"),
    certifications: snapshotText(record, "certifications"),
    productionCapacity: snapshotText(record, "productionCapacity"),
    presidentName: snapshotText(record, "presidentName"),
    websiteUrl: snapshotText(record, "websiteUrl"),
    country: snapshotText(record, "country") ?? "",
    region: snapshotText(record, "region"),
    city: snapshotText(record, "city"),
    address: snapshotText(record, "address"),
    tel: snapshotText(record, "tel"),
    trackRecordEbara: snapshotText(record, "trackRecordEbara"),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sections
// ─────────────────────────────────────────────────────────────────────────────

/** The rendering fields that are stored verbatim as one section body. */
type ProseField =
  | "purpose"
  | "overview"
  | "mainProducts"
  | "partners"
  | "conclusion"
  | "certificateNote"
  | "targetNotes";

/** The section row each prose field lives in. Read in both directions. */
const BODY_FIELD: Partial<Record<SectionId, ProseField>> = {
  purpose: "purpose",
  overview: "overview",
  products: "mainProducts",
  partners: "partners",
  conclusion: "conclusion",
  certificates: "certificateNote",
  target: "targetNotes",
};

/** One bullet per line; blank lines are spacing, not bullets. */
export function splitQaBullets(body: string): string[] {
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

/** The inverse — what `saveSection` writes to the `visit` row. */
export function joinQaBullets(bullets: readonly string[]): string {
  return bullets.map((bullet) => bullet.trim()).filter((bullet) => bullet !== "").join("\n");
}

export function rowToSectionRecord(row: ReportSectionRow): SectionRecord | null {
  if (!isSectionId(row.section_id)) return null;

  return {
    sectionId: row.section_id,
    body: row.body,
    excluded: row.excluded,
    version: row.version,
    updatedAt: row.updated_at,
  };
}

/**
 * The save-path shape: one record per stored section, carrying the `version`
 * the editor patches against (Phase 2 §18).
 *
 * Returned in README §6.2 navigator order rather than the order the rows
 * arrived in, so a caller can index into it without sorting first. A row whose
 * `section_id` this build does not know is skipped: the column is CHECK
 * constrained, so that can only mean the database has a section added after
 * this build shipped, and rendering it as an unnamed panel would be worse than
 * leaving it to the build that knows what it is.
 */
export function rowsToSectionRecords(rows: readonly ReportSectionRow[]): SectionRecord[] {
  const byId = new Map<SectionId, SectionRecord>();

  for (const row of rows) {
    const record = rowToSectionRecord(row);
    if (record) byId.set(record.sectionId, record);
  }

  return SECTION_IDS.map((id) => byId.get(id)).filter(
    (record): record is SectionRecord => record !== undefined,
  );
}

/**
 * Where one section's body comes from in the flat rendering shape, and whether
 * it is currently excluded from the export (README §25).
 *
 * `null` for the sections that have no body of their own — General Information,
 * the two image sub-sections and the Appendix, whose content is the rows and
 * the photographs, not prose. The editor's save path reads this so the
 * rendering shape and the stored rows cannot drift apart.
 */
export function sectionBodyOf(
  sections: ReportSections,
  sectionId: SectionId,
): { body: string; excluded: boolean } | null {
  const field = BODY_FIELD[sectionId];
  if (field) return { body: sections[field], excluded: false };

  if (sectionId === "visit") {
    return { body: joinQaBullets(sections.qaBullets), excluded: !sections.qaIncluded };
  }

  return null;
}

function sectionsFromRecords(
  records: readonly SectionRecord[],
  children: ReportChildren,
): ReportSections {
  const byId = new Map<SectionId, SectionRecord>(
    records.map((record) => [record.sectionId, record]),
  );
  const bodyOf = (id: SectionId): string => byId.get(id)?.body ?? "";
  const visit = byId.get("visit");

  return {
    purpose: bodyOf("purpose"),
    overview: bodyOf("overview"),
    mainProducts: bodyOf("products"),
    partners: bodyOf("partners"),
    conclusion: bodyOf("conclusion"),
    certificateNote: bodyOf("certificates"),
    targetNotes: bodyOf("target"),
    observations: (children.observations ?? []).map(rowToObservation),
    qaBullets: splitQaBullets(visit?.body ?? ""),
    // README §25 — the column stores what is left out; a report with no `visit`
    // row yet includes the block, which is the column's own default.
    qaIncluded: !(visit?.excluded ?? false),
    targetProducts: (children.targetProducts ?? []).map(rowToTargetProduct),
    productRows: (children.productRows ?? []).map(rowToProductRow),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Child rows
// ─────────────────────────────────────────────────────────────────────────────

const PRIORITIES: readonly Observation["priority"][] = ["Normal", "High", "Critical"];

/**
 * `report_observations.priority` is CHECK-constrained rather than an enum, so
 * it arrives typed as `string`. An unfamiliar value means the constraint was
 * widened without this build knowing, and the safe reading of an unknown
 * priority is the lowest one — never an escalation nobody asked for.
 */
function toPriority(value: string): Observation["priority"] {
  return PRIORITIES.find((priority) => priority === value) ?? "Normal";
}

export function rowToObservation(row: ReportObservationRow): Observation {
  return {
    id: row.id,
    category: row.category,
    priority: toPriority(row.priority),
    text: row.text,
    sourceFindingId: row.source_finding_id,
    imageId: row.image_id,
  };
}

/**
 * One §6 observation as a row.
 *
 * `sortOrder` is a parameter because the author's order is the position in the
 * list they are looking at, not a field on the card. `id` is required and the
 * caller resolves it: the write path replaces the whole set in one upsert, and
 * PostgREST needs every object in that array to carry the same keys.
 */
export function observationToUpsert(
  reportId: string,
  values: Observation,
  sortOrder: number,
  userId: string | null = null,
): ReportObservationInsert {
  return {
    id: values.id,
    report_id: reportId,
    category: values.category.trim(),
    priority: toPriority(values.priority),
    text: values.text.trim(),
    source_finding_id: values.sourceFindingId,
    image_id: values.imageId,
    sort_order: sortOrder,
    created_by: userId,
  };
}

export function rowToTargetProduct(row: ReportTargetProductRow): TargetProduct {
  return {
    id: row.id,
    name: row.name,
    model: row.model,
    application: row.application,
    expectedMarket: row.expected_market,
    technicalRequirements: row.technical_requirements,
    comments: row.comments,
    photoId: row.photo_id,
    sortOrder: row.sort_order,
  };
}

/**
 * One §5 target product as a row. `sortOrder` defaults to the value's own,
 * so a caller that already numbered its cards does not have to say it twice.
 */
export function targetProductToUpsert(
  reportId: string,
  values: TargetProduct,
  sortOrder: number = values.sortOrder,
  userId: string | null = null,
): ReportTargetProductInsert {
  return {
    id: values.id,
    report_id: reportId,
    name: values.name.trim(),
    model: values.model.trim(),
    application: values.application.trim(),
    expected_market: values.expectedMarket.trim(),
    technical_requirements: values.technicalRequirements.trim(),
    comments: values.comments.trim(),
    photo_id: values.photoId,
    sort_order: sortOrder,
    created_by: userId,
  };
}

export function rowToProductRow(row: ReportProductRowRow): ProductRow {
  return {
    id: row.id,
    type: row.type,
    standard: row.standard,
    voltage: row.voltage,
    description: row.description,
  };
}

/** The §1 attendee chips, in the order they were entered. */
export function memberToInsert(
  reportId: string,
  displayName: string,
  sortOrder: number,
  userId: string | null = null,
): ReportMemberInsert {
  return {
    report_id: reportId,
    display_name: displayName.trim(),
    sort_order: sortOrder,
    created_by: userId,
  };
}

/**
 * The §1 General Information columns a correction writes.
 *
 * Only the keys the caller passed are emitted: `undefined` means "leave it
 * alone" and an explicit `null` means "clear it", which are different edits and
 * must not collapse into the same payload. `updated_at` is stamped by the
 * table's own trigger, and `company_information` is never touched here — a
 * report's snapshot only changes through the §8.3 refresh.
 */
export function reportMetaToUpdate(values: ReportMetaValues, userId: string): ReportUpdate {
  return {
    ...(values.documentNumber === undefined
      ? {}
      : { document_number: values.documentNumber.trim() }),
    ...(values.visitDate === undefined ? {} : { visit_date: values.visitDate }),
    ...(values.period === undefined ? {} : { period: values.period.trim() }),
    ...(values.location === undefined ? {} : { location: values.location.trim() }),
    ...(values.employeeId === undefined ? {} : { employee_id: values.employeeId }),
    ...(values.ownerId === undefined ? {} : { owner_id: values.ownerId }),
    ...(values.startTime === undefined ? {} : { start_time: toTimeValue(values.startTime) }),
    ...(values.endTime === undefined ? {} : { end_time: toTimeValue(values.endTime) }),
    ...(values.project === undefined ? {} : { project: toNullable(values.project) }),
    ...(values.businessUnit === undefined
      ? {}
      : { business_unit: toNullable(values.businessUnit) }),
    ...(values.productCategory === undefined
      ? {}
      : { product_category: toNullable(values.productCategory) }),
    updated_by: userId,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Row → domain
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One row of the reports table (README §19).
 *
 * `completion` is a parameter because README §6.2 derives it from the thirteen
 * section predicates and never stores it: a row on its own cannot answer it,
 * and `0` is the honest value for a report loaded without its sections.
 */
export function rowToReportSummary(
  row: ReportJoinedRow,
  completion: number = 0,
  now: Date = new Date(),
): ReportSummary {
  return {
    id: row.id,
    documentNumber: row.document_number,
    supplierId: row.supplier_id,
    supplierShortName: row.suppliers?.short_name ?? "",
    visitDate: toDisplayDate(row.visit_date) ?? "",
    location: row.location,
    employee: row.employee?.full_name ?? "",
    status: statusOf(row),
    completion,
    lastUpdatedLabel: relativeLabel(row.updated_at, now),
    lastUpdatedAt: row.updated_at,
  };
}

/**
 * The whole report, as the editor renders it.
 *
 * `completion` is computed here rather than passed in, so a `Report` can never
 * carry a percentage that disagrees with the sections beside it in the same
 * object. It is the same `reportCompletion()` the editor header and the export
 * modal call — Phase 2 §20 keeps that computation in one place.
 */
export function rowToReport(
  row: ReportJoinedRow,
  children: ReportChildren,
  now: Date = new Date(),
): Report {
  const records = rowsToSectionRecords(children.sections);
  const snapshot = snapshotFromJson(row.company_information);

  const report: Report = {
    ...rowToReportSummary(row, 0, now),
    period: row.period,
    reportOwner: row.owner?.full_name ?? row.employee?.full_name ?? "",
    members: (children.members ?? [])
      .map((member) => member.display_name)
      .filter((name) => name.trim() !== ""),
    createdAt: row.created_at,
    startTime: toClockTime(row.start_time),
    endTime: toClockTime(row.end_time),
    project: row.project,
    businessUnit: row.business_unit,
    productCategory: row.product_category,
    supplierSnapshot: {
      ...snapshot,
      // The column is the authority on when the copy was taken; the jsonb only
      // repeats it, and a snapshot written before `takenAt` was part of the key
      // set has nothing to repeat.
      takenAt: snapshot.takenAt || row.snapshot_taken_at,
    },
    sections: sectionsFromRecords(records, children),
  };

  return { ...report, completion: reportCompletion(report, children.photos ?? []) };
}
