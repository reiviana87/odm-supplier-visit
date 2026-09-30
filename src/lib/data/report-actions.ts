"use server";

/**
 * Report mutations — server actions (Phase 2 §24, §26, §33).
 *
 * Every action follows the steps `supplier-actions.ts` established, in the same
 * order:
 *   1. who is signed in — no session, no write;
 *   2. what their role allows — a viewer is refused before anything is parsed;
 *   3. the zod schema, server-side: the client copy is for UX, this one is for
 *      integrity, and it answers with field errors the form can show in place;
 *   4. demo mode, which refuses honestly instead of pretending to have saved;
 *   5. the write, then `revalidatePath` on the routes that show the record.
 *
 * `authorize`, `openSession`, `beginWrite` and `fieldErrorsOf` below are the
 * same four guards, restated rather than imported. That is a rule and not a
 * preference: a `"use server"` module may only export async functions, so those
 * helpers cannot leave `supplier-actions.ts`, and the alternative — a third
 * module holding the session plumbing — is not this task's to create. They are
 * kept identical on purpose; anything one of them learns has to be taught to
 * both. Everything that CAN be shared is: `toNullable` and the row mappers come
 * from the mapper modules, and nothing here knows a column name of its own.
 *
 * No action redirects. They return the id and let the caller route, so a form
 * that fails can stay where it is with the message next to the field.
 */

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { canEdit, canManage } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import {
  DEFAULT_MESSAGES,
  fail,
  ok,
  toDataError,
  uniqueConflict,
  type DataError,
  type DataResult,
} from "@/lib/data/errors";
import {
  memberToInsert,
  observationToUpsert,
  periodFromVisitDate,
  reportMetaToUpdate,
  rowToObservation,
  rowToSectionRecord,
  rowToTargetProduct,
  targetProductToUpsert,
  toTimeValue,
  type CreateReportValues,
  type ReportMetaValues,
  type ReportSectionUpdate,
  type SaveSectionValues,
} from "@/lib/data/report-mappers";
import { getReport as loadReport } from "@/lib/data/reports";
import { toNullable } from "@/lib/data/supplier-mappers";
import { documentNumberSchema } from "@/lib/reports/document-number";
import { isMockMode } from "@/lib/supabase/env";
import { getServerSupabase } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import {
  REPORT_STATUSES,
  isSectionId,
  type Observation,
  type ReportStatus,
  type SectionId,
  type SectionRecord,
  type TargetProduct,
  type UserRole,
} from "@/types/domain";

interface Session {
  client: SupabaseClient<Database>;
  userId: string;
}

/** README §22 — say what happened, and what the user can do about it. */
const DEMO_READ_ONLY = "Demo data is read-only — connect a Supabase project to save changes.";

const NUMBER_TAKEN = "That document number already belongs to another report.";

const SUPPLIER_GONE =
  "That supplier could not be found. It may have been removed since the picker loaded.";

const SUPPLIER_ARCHIVED =
  "That supplier is archived and cannot take new reports. Restore it, or choose another supplier.";

const END_BEFORE_START = "The end time has to be after the start time.";

/**
 * Phase 2 §18, the branch the 0003 §4 header warns about: zero rows updated
 * with the version unchanged means the row was filtered out by row level
 * security, not that somebody else saved first. Saying "reload" here would send
 * a read-only user round a loop that cannot end, so it says the true thing.
 */
const SECTION_READ_ONLY =
  "Your changes were not saved — this report is read-only for your account. " +
  "Copy anything you still need before leaving the page, and ask an administrator for edit access.";

// ─────────────────────────────────────────────────────────────────────────────
// The steps every action shares
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Steps 1 and 2.
 *
 * `requireUser()` is deliberately not used: it redirects to /login, and a server
 * action that redirects throws away the form the user is standing in. An action
 * answers with `unauthenticated` and the caller decides where to send them.
 */
async function authorize(allow: (role: UserRole) => boolean): Promise<DataResult<string>> {
  const profile = await getCurrentUser();
  if (!profile) return fail("unauthenticated");
  if (!allow(profile.role)) return fail("forbidden");
  return ok(profile.id);
}

/** Step 4 — after validation, so a demo user still sees their own field errors. */
async function openSession(userId: string): Promise<DataResult<Session>> {
  if (isMockMode()) return fail("forbidden", DEMO_READ_ONLY);

  const supabase = await getServerSupabase();
  if (!supabase) return fail("offline");

  return ok({ client: supabase, userId });
}

/** Steps 1, 2 and 4 together, for an action with no payload to validate. */
async function beginWrite(allow: (role: UserRole) => boolean): Promise<DataResult<Session>> {
  const auth = await authorize(allow);
  if (!auth.ok) return auth;
  return openSession(auth.data);
}

interface ZodLikeIssue {
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

/** The first message per field, keyed the way the form names its inputs. */
function fieldErrorsOf(issues: readonly ZodLikeIssue[]): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  for (const issue of issues) {
    const key = issue.path.map((part) => String(part)).join(".");
    if (key !== "" && !(key in fieldErrors)) fieldErrors[key] = issue.message;
  }

  return fieldErrors;
}

function failWith<T>(error: DataError): DataResult<T> {
  return { ok: false, error };
}

/** As much of a PostgREST error as this module reads. */
interface PostgrestErrorShape {
  code?: string | null;
  message?: string | null;
  details?: string | null;
}

/**
 * A unique violation on `document_number` is the one conflict a user can fix,
 * so it comes back against the field rather than as a banner. Migration 0005
 * lets it through on purpose: README §9 validates the number on blur, but two
 * people can still submit the same one in the same second, and the constraint
 * is the only thing that can actually decide.
 */
function writeError(error: unknown, context: string): DataError {
  const detail = error as PostgrestErrorShape | null;

  // 0005 raises P0002 for "no such supplier" and "no such report". The shared
  // mapper has no entry for it — the migration's header says the caller adds
  // one — so it is translated before anything else looks at the code.
  if (detail?.code === "P0002") {
    console.error(`[data:${context}]`, error);
    return { code: "not_found", message: DEFAULT_MESSAGES.not_found };
  }

  const dataError = toDataError(error, context);
  if (dataError.code !== "conflict") return dataError;

  if (/document_number/i.test(`${detail?.message ?? ""} ${detail?.details ?? ""}`)) {
    return uniqueConflict("documentNumber", NUMBER_TAKEN);
  }

  return dataError;
}

/**
 * The dashboard and the reports list, which both read "recently updated".
 *
 * The editor's own route is revalidated separately, by `revalidateReport()`:
 * autosave calls `saveSection` every second or so while someone types, and
 * re-rendering the page they are typing into on every patch would fight the
 * editor for the text it already holds.
 */
function revalidateReportLists(): void {
  revalidatePath("/");
  revalidatePath("/reports");
}

/** The lists, plus the report's own editor route and all its section pages. */
function revalidateReport(reportId: string): void {
  revalidateReportLists();
  revalidatePath(`/reports/${reportId}`, "layout");
}

// ─────────────────────────────────────────────────────────────────────────────
// Field schemas — README §9
// ─────────────────────────────────────────────────────────────────────────────

const reportIdSchema = z.string().trim().min(1, "A report is required.");

const reportStatusSchema = z.enum(REPORT_STATUSES);

/**
 * A real calendar date in `yyyy-mm-dd`, checked by round-tripping through UTC
 * so `2026-02-30` is refused here rather than by the `date` column, which would
 * answer with a syntax error nobody can act on. The parse is pinned to UTC: a
 * bare date read in local time shifts a day west of Greenwich.
 */
const visitDateSchema = z
  .string()
  .trim()
  .refine((value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Choose the visit date, for example 2026-08-12.");

/** `09:30`, or blank — the form clears a time by submitting an empty field. */
const clockTimeSchema = z
  .string()
  .refine(
    (value) => value.trim() === "" || /^\d{1,2}:\d{2}(?::\d{2})?$/.test(value.trim()),
    "Use a 24-hour time such as 09:30.",
  );

/**
 * README §9 — "End Time … must be after Start Time". Only a pair can be
 * compared: a visit with one time recorded is one whose other end nobody wrote
 * down, which the form allows. `toTimeValue` normalises both to `HH:MM:SS`,
 * where a string comparison is a chronological one.
 */
function endsAfterStart(values: {
  startTime?: string | null;
  endTime?: string | null;
}): boolean {
  const start = toTimeValue(values.startTime);
  const end = toTimeValue(values.endTime);
  if (!start || !end) return true;
  return end > start;
}

const createReportSchema = z
  .object({
    documentNumber: documentNumberSchema,
    // Not `z.uuid()`: the id arrives from the supplier picker, and the only
    // thing that can really decide whether it names a usable supplier is the
    // database — which `create_report_with_snapshot` asks before it writes
    // anything. A format check here would refuse the seeded ids as well.
    supplierId: z.string().trim().min(1, "Choose the supplier this report is about."),
    visitDate: visitDateSchema,
    period: z.string().optional(),
    location: z.string().optional(),
    employeeId: z.string().nullable().optional(),
    ownerId: z.string().nullable().optional(),
    startTime: clockTimeSchema.nullable().optional(),
    endTime: clockTimeSchema.nullable().optional(),
    project: z.string().nullable().optional(),
    businessUnit: z.string().nullable().optional(),
    productCategory: z.string().nullable().optional(),
    members: z.array(z.string()).optional(),
    status: reportStatusSchema.optional(),
  })
  .refine(endsAfterStart, { message: END_BEFORE_START, path: ["endTime"] });

const reportMetaSchema = z
  .object({
    documentNumber: documentNumberSchema.optional(),
    visitDate: visitDateSchema.optional(),
    period: z.string().optional(),
    location: z.string().optional(),
    employeeId: z.string().nullable().optional(),
    ownerId: z.string().nullable().optional(),
    startTime: clockTimeSchema.nullable().optional(),
    endTime: clockTimeSchema.nullable().optional(),
    project: z.string().nullable().optional(),
    businessUnit: z.string().nullable().optional(),
    productCategory: z.string().nullable().optional(),
    members: z.array(z.string()).optional(),
  })
  // A patch that carries only one of the two times cannot be checked against
  // the other: the stored value is not in the payload, and reading it first
  // would still leave a window in which it changed.
  .refine(endsAfterStart, { message: END_BEFORE_START, path: ["endTime"] });

const saveSectionSchema = z.object({
  reportId: reportIdSchema,
  sectionId: z.string().refine(isSectionId, "That is not a section of a visit report."),
  body: z.string(),
  excluded: z.boolean().optional(),
  version: z
    .number()
    .int()
    .min(1, "The section version has to be the one the editor loaded."),
});

const observationsSchema = z.object({
  reportId: reportIdSchema,
  rows: z.array(
    z.object({
      id: z.string(),
      category: z.string(),
      // Not an enum: `observationToUpsert` puts every priority through the one
      // list that exists, in `report-mappers.ts`, and reads an unfamiliar value
      // as the lowest priority. A second list here could disagree with it.
      priority: z.string(),
      text: z.string(),
      sourceFindingId: z.string().nullable(),
      // A uuid or nothing. An id that is not a uuid could only come from a
      // client that made it up, and the foreign key would refuse it anyway —
      // refusing it here makes the message a sentence rather than a 23503.
      imageId: z.uuid().nullable(),
    }),
  ),
});

const targetProductsSchema = z.object({
  reportId: reportIdSchema,
  rows: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      model: z.string(),
      application: z.string(),
      expectedMarket: z.string(),
      technicalRequirements: z.string(),
      comments: z.string(),
      photoId: z.string().nullable(),
      sortOrder: z.number().int(),
    }),
  ),
});

// ─────────────────────────────────────────────────────────────────────────────
// Create — README §9
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates the draft, freezes the §8.3 supplier snapshot, records the attendee
 * chips and seeds the thirteen empty sections.
 *
 * All of that goes through `create_report_with_snapshot` (migration 0005) and
 * not through five inserts from here: PostgREST has no transaction across
 * requests, so a failure on the third would leave a report with no sections —
 * a draft the editor cannot open and the user cannot repair. The function body
 * is one transaction, and it runs SECURITY INVOKER, so the 0004 policies apply
 * exactly as they would to a direct insert.
 *
 * Unlike `createSupplier`, the document number is NOT probed for uniqueness
 * first. 0005 argues the case: the blur check in README §9 is the usable
 * warning, and between a probe and an insert two people can still submit the
 * same number, so the constraint decides and 23505 is mapped onto the field.
 */
export async function createReport(
  values: CreateReportValues,
): Promise<DataResult<{ id: string; documentNumber: string }>> {
  const auth = await authorize(canEdit);
  if (!auth.ok) return auth;

  const parsed = createReportSchema.safeParse(values);
  if (!parsed.success) return fail("invalid", undefined, fieldErrorsOf(parsed.error.issues));

  const session = await openSession(auth.data);
  if (!session.ok) return session;

  const documentNumber = values.documentNumber.trim();
  const visitDate = values.visitDate.trim();
  // README §9 — "Employee: current user". An explicit null is the same request
  // as an absent field: the report still has to say who made the visit.
  const employeeId = values.employeeId ?? session.data.userId;

  const { data, error } = await session.data.client.rpc("create_report_with_snapshot", {
    p_document_number: documentNumber,
    p_supplier_id: values.supplierId.trim(),
    // README §12 — a new report is a draft unless the caller says otherwise.
    p_status: values.status ?? "draft",
    p_visit_date: visitDate,
    p_period: values.period?.trim() || periodFromVisitDate(visitDate),
    p_employee_id: employeeId,
    p_owner_id: values.ownerId ?? employeeId,
    p_location: values.location?.trim() ?? "",
    p_start_time: toTimeValue(values.startTime),
    p_end_time: toTimeValue(values.endTime),
    p_project: toNullable(values.project),
    p_business_unit: toNullable(values.businessUnit),
    p_product_category: toNullable(values.productCategory),
    // Blank chips are dropped by the function itself, in the same statement
    // that numbers them, so the order the user typed survives untouched.
    p_members: values.members ?? [],
  });

  if (error) {
    // 0005 raises a check violation for exactly one thing: the chosen supplier
    // is archived. The generic "some fields need attention" would leave the
    // user hunting for which one.
    if ((error as PostgrestErrorShape).code === "23514") {
      console.error("[data:createReport]", error);
      return fail("invalid", SUPPLIER_ARCHIVED, { supplierId: SUPPLIER_ARCHIVED });
    }

    const dataError = writeError(error, "createReport");
    if (dataError.code === "not_found") {
      return fail("not_found", SUPPLIER_GONE, { supplierId: SUPPLIER_GONE });
    }
    return failWith(dataError);
  }

  if (!data) return fail("unknown");

  revalidateReport(data);
  return ok({ id: data, documentNumber });
}

// ─────────────────────────────────────────────────────────────────────────────
// Sections — the autosave transport (Phase 2 §18)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Patches one section, matching on the version the editor loaded it at.
 *
 * ## Why zero rows updated is not enough to answer with
 *
 * The 0004 UPDATE policy on `report_sections` is row-independent
 * (`auth_role() in ('editor','manager','admin')`), so a caller the policy
 * refuses sees exactly what a caller who lost the race sees: zero rows, and no
 * error. The row is therefore re-read before anything is reported:
 *
 *   · the row is gone          → `not_found`;
 *   · it carries a different version → somebody saved first, `stale`;
 *   · it carries the SAME version    → nobody saved, the write was refused,
 *     `forbidden` — telling this user to "reload before saving" would send them
 *     round a loop that cannot end.
 *
 * The new version comes back with the answer so the client keeps saving against
 * the row without reloading the page. `RETURNING` runs after the BEFORE UPDATE
 * trigger of 0003, so the value returned is the one the row now holds.
 */
export async function saveSection(
  values: SaveSectionValues,
): Promise<DataResult<{ version: number; updatedAt: string }>> {
  const auth = await authorize(canEdit);
  if (!auth.ok) return auth;

  const parsed = saveSectionSchema.safeParse(values);
  if (!parsed.success) return fail("invalid", undefined, fieldErrorsOf(parsed.error.issues));

  const session = await openSession(auth.data);
  if (!session.ok) return session;

  const patch: ReportSectionUpdate = {
    body: values.body,
    updated_by: session.data.userId,
    // README §25 — an omitted flag leaves the export toggle as the author set
    // it, which is not the same as setting it to false.
    ...(values.excluded === undefined ? {} : { excluded: values.excluded }),
  };

  const { data, error } = await session.data.client
    .from("report_sections")
    .update(patch)
    .eq("report_id", values.reportId)
    .eq("section_id", values.sectionId)
    .eq("version", values.version)
    .select("version, updated_at");

  if (error) return failWith(writeError(error, "saveSection"));

  const saved = (data ?? [])[0];
  if (saved) {
    revalidateReportLists();
    return ok({ version: saved.version, updatedAt: saved.updated_at });
  }

  const { data: current, error: readError } = await session.data.client
    .from("report_sections")
    .select("version")
    .eq("report_id", values.reportId)
    .eq("section_id", values.sectionId)
    .maybeSingle();

  if (readError) return failWith(toDataError(readError, "saveSection:resolve"));
  if (!current) return fail("not_found");

  // Unchanged means nobody wrote: the update was filtered out by row level
  // security. Any other version means somebody did.
  if (current.version === values.version) return fail("forbidden", SECTION_READ_ONLY);
  return fail("stale");
}

/**
 * One stored section, read back on its own.
 *
 * This is what the conflict dialog calls after a `stale` save: it needs the
 * body that won the race and the version to build the next patch on, and
 * re-reading the whole report to get one section would replace the draft the
 * user is still holding in the editor.
 */
export async function getSectionRecord(
  reportId: string,
  sectionId: SectionId,
): Promise<DataResult<SectionRecord>> {
  if (isMockMode()) {
    // Straight through the seeded fallback that `reports.ts` already owns —
    // a second copy of it here could disagree with the report the editor
    // rendered from.
    const loaded = await loadReport(reportId);
    if (!loaded.ok) return loaded;

    const record = loaded.data.sections.find((section) => section.sectionId === sectionId);
    return record ? ok(record) : fail("not_found");
  }

  const supabase = await getServerSupabase();
  if (!supabase) return fail("offline");

  const { data, error } = await supabase
    .from("report_sections")
    .select("*")
    .eq("report_id", reportId)
    .eq("section_id", sectionId)
    .maybeSingle();

  if (error) return failWith(toDataError(error, "getSectionRecord"));
  if (!data) return fail("not_found");

  const record = rowToSectionRecord(data);
  return record ? ok(record) : fail("not_found");
}

// ─────────────────────────────────────────────────────────────────────────────
// The report header — README §1 General Information
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The attendee chips.
 *
 * Rewritten as a set rather than matched row by row: a chip carries nothing but
 * a name, and its order IS the data — §1 prints the attendees in the order they
 * were entered — so there is nothing a positional match would preserve.
 */
async function replaceMembers(
  session: Session,
  reportId: string,
  members: readonly string[],
): Promise<DataError | null> {
  const { error: deleteError } = await session.client
    .from("report_members")
    .delete()
    .eq("report_id", reportId);

  if (deleteError) return toDataError(deleteError, "replaceMembers");

  const rows = members
    .map((name) => name.trim())
    .filter((name) => name !== "")
    .map((name, index) => memberToInsert(reportId, name, index, session.userId));

  if (rows.length === 0) return null;

  const { error } = await session.client.from("report_members").insert(rows);
  return error ? toDataError(error, "replaceMembers") : null;
}

/**
 * Corrects the §1 General Information fields. An absent key is left alone and
 * an explicit `null` clears the column — `reportMetaToUpdate` keeps those two
 * apart, because they are different edits.
 *
 * `supplierId` is not patchable: changing which supplier a report is about
 * would leave the §8.3 snapshot describing a different company than the report
 * names. That is a new report, not an edit.
 */
export async function updateReportMeta(
  id: string,
  patch: ReportMetaValues,
): Promise<DataResult<{ id: string }>> {
  const auth = await authorize(canEdit);
  if (!auth.ok) return auth;

  const parsed = reportMetaSchema.safeParse(patch);
  if (!parsed.success) return fail("invalid", undefined, fieldErrorsOf(parsed.error.issues));

  const session = await openSession(auth.data);
  if (!session.ok) return session;

  const { data, error } = await session.data.client
    .from("reports")
    .update(reportMetaToUpdate(patch, session.data.userId))
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) return failWith(writeError(error, "updateReportMeta"));
  if (!data) return fail("not_found");

  if (patch.members !== undefined) {
    const membersError = await replaceMembers(session.data, id, patch.members);
    if (membersError) return failWith(membersError);
  }

  revalidateReport(id);
  return ok({ id });
}

/**
 * Moves the report between Draft, In Review and Final — a plain write, with no
 * approval workflow behind it (Phase 2 §12).
 *
 * `canEdit`, not `canManage`: 0004 grants `reports` UPDATE to editor and above,
 * and with no approval step in the product a status is an ordinary field on the
 * report. Requiring a manager here would refuse a write the database allows,
 * and would stop an author sending their own draft to review.
 *
 * `archived` is refused on purpose. Archiving is `archiveReport()`, which
 * stamps the soft-delete column the lists filter on; writing the status alone
 * would produce a report that says "Archived" and still appears in every list.
 */
export async function setReportStatus(
  id: string,
  status: ReportStatus,
): Promise<DataResult<{ id: string }>> {
  // The argument crosses the network before it gets here, so the type alone is
  // not a guarantee about what actually arrived.
  if (!reportStatusSchema.safeParse(status).success) {
    return fail("invalid", "That is not a report status.");
  }

  if (status === "archived") {
    return fail(
      "invalid",
      "Use the archive action to archive a report, so it also leaves the lists.",
    );
  }

  const session = await beginWrite(canEdit);
  if (!session.ok) return session;

  const { data, error } = await session.data.client
    .from("reports")
    .update({ status, updated_by: session.data.userId })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) return failWith(writeError(error, "setReportStatus"));
  if (!data) return fail("not_found");

  revalidateReport(id);
  return ok({ id });
}

/**
 * Phase 2 §33 — a visit report is the record of what was seen and said on a
 * given date, so it is archived and never hard-deleted. It leaves the dashboard
 * and the default list and stays readable.
 *
 * Only `archived_at` is stamped; `status` is left exactly as it was. The two are
 * separate columns and 0003 deliberately puts no CHECK between them, leaving the
 * invariant to this layer — which keeps it where every consumer reads it: the
 * mapper's `statusOf()` reports an archived report as `archived` in the domain
 * model whatever the column says. Overwriting the column as well would satisfy
 * the same invariant while destroying the one thing a restore needs, which is
 * the state the report was in before it was archived.
 */
export async function archiveReport(id: string): Promise<DataResult<{ id: string }>> {
  const session = await beginWrite(canManage);
  if (!session.ok) return session;

  const { data, error } = await session.data.client
    .from("reports")
    .update({ archived_at: new Date().toISOString(), updated_by: session.data.userId })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) return failWith(writeError(error, "archiveReport"));
  if (!data) return fail("not_found");

  revalidateReport(id);
  return ok({ id });
}

/**
 * README §8.3 — re-copies the live supplier record into the report's frozen
 * snapshot and restamps it, answering with the new `snapshot_taken_at` so the
 * caller can render "Source: Supplier Database · snapshot taken {date}" without
 * re-reading the report.
 *
 * AN EXPLICIT, CONFIRMED USER ACTION ONLY. It is the one thing allowed to change
 * what a finished report says about the supplier, and §8.3 makes it a choice:
 * the user is shown the diff and confirms it before this is called. It must
 * never be called from an effect, a loop, a job, or as a side effect of saving a
 * supplier — an edit to the master record months later must not rewrite a report
 * behind its author's back. The same rule is written into the function itself in
 * migration 0005, which is deliberately not attached to any trigger.
 */
export async function refreshSupplierSnapshot(
  reportId: string,
): Promise<DataResult<{ takenAt: string }>> {
  const session = await beginWrite(canEdit);
  if (!session.ok) return session;

  const { data, error } = await session.data.client.rpc("refresh_report_snapshot", {
    p_report_id: reportId,
  });

  if (error) return failWith(writeError(error, "refreshSupplierSnapshot"));
  if (!data) return fail("unknown");

  revalidateReport(reportId);
  return ok({ takenAt: data });
}

// ─────────────────────────────────────────────────────────────────────────────
// §5 Target Products and §6 Observations — replace-the-set writes
//
// Both sections are edited as a list: cards are added, reordered and removed,
// and what is submitted is the whole list as the author now wants it. So both
// writes are the same two steps — delete the rows that are no longer in the
// list, then upsert the ones that are — and the array index becomes
// `sort_order`, because the author's order is the order of the cards in front
// of them.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The id this row will be stored under.
 *
 * An id is reused only when it is already one of THIS report's rows. Anything
 * else — a card the editor just created, an id left over from a deleted row, an
 * id belonging to another report — gets a fresh one, so a stale or borrowed id
 * can never be written into a report it does not belong to.
 */
function resolveRowId(id: string, existing: ReadonlyMap<string, string | null>): string {
  const trimmed = id.trim();
  return existing.has(trimmed) ? trimmed : randomUUID();
}

/**
 * Who wrote this card down.
 *
 * `created_by` is the row's author, so a row that already exists keeps the one
 * it has and only a new card is credited to this session. Reading it here is
 * also what lets the whole list go out as ONE upsert: PostgREST needs every
 * object in the array to carry the same keys, so the alternative to knowing the
 * stored value is either overwriting it or splitting the write in two.
 */
function authorOf(
  existing: ReadonlyMap<string, string | null>,
  id: string,
  userId: string,
): string | null {
  return existing.has(id) ? (existing.get(id) ?? null) : userId;
}

/** The rows currently stored for one report, as id → `created_by`. */
async function storedRows(
  session: Session,
  table: "report_observations" | "report_target_products",
  reportId: string,
  context: string,
): Promise<DataResult<Map<string, string | null>>> {
  const { data, error } = await session.client
    .from(table)
    .select("id, created_by")
    .eq("report_id", reportId);

  if (error) return failWith(toDataError(error, context));
  return ok(new Map((data ?? []).map((row) => [row.id, row.created_by])));
}

/** A card the author opened and never typed into is not an observation. */
function isBlankObservation(row: Observation): boolean {
  return row.category.trim() === "" && row.text.trim() === "";
}

/** The same rule for §5: a card with nothing at all written on it. */
function isBlankTargetProduct(row: TargetProduct): boolean {
  return (
    [
      row.name,
      row.model,
      row.application,
      row.expectedMarket,
      row.technicalRequirements,
      row.comments,
    ].every((field) => field.trim() === "") && row.photoId === null
  );
}

/** README §6 — the observation list, as the author now has it. */
export async function saveObservations(
  reportId: string,
  rows: readonly Observation[],
): Promise<DataResult<Observation[]>> {
  const auth = await authorize(canEdit);
  if (!auth.ok) return auth;

  const parsed = observationsSchema.safeParse({ reportId, rows });
  if (!parsed.success) return fail("invalid", undefined, fieldErrorsOf(parsed.error.issues));

  const session = await openSession(auth.data);
  if (!session.ok) return session;

  const existing = await storedRows(
    session.data,
    "report_observations",
    reportId,
    "saveObservations",
  );
  if (!existing.ok) return existing;

  const wanted = rows
    .filter((row) => !isBlankObservation(row))
    .map((row, index) => {
      const id = resolveRowId(row.id, existing.data);
      return observationToUpsert(
        reportId,
        { ...row, id },
        index,
        authorOf(existing.data, id, session.data.userId),
      );
    });

  const keep = new Set(wanted.map((row) => row.id).filter((id): id is string => Boolean(id)));
  const surplus = [...existing.data.keys()].filter((id) => !keep.has(id));

  if (surplus.length > 0) {
    const { error } = await session.data.client
      .from("report_observations")
      .delete()
      .in("id", surplus);
    if (error) return failWith(toDataError(error, "saveObservations"));
  }

  if (wanted.length > 0) {
    const { error } = await session.data.client
      .from("report_observations")
      .upsert(wanted, { onConflict: "id" });
    if (error) return failWith(toDataError(error, "saveObservations"));
  }

  // Read back rather than echo the payload: the caller needs the ids the
  // database assigned to the new cards, and anything else the row picked up on
  // the way in.
  const { data, error } = await session.data.client
    .from("report_observations")
    .select("*")
    .eq("report_id", reportId)
    .order("sort_order", { ascending: true });

  if (error) return failWith(toDataError(error, "saveObservations:reload"));

  revalidateReport(reportId);
  return ok((data ?? []).map(rowToObservation));
}

/** README §5 — the target product cards, as the author now has them. */
export async function saveTargetProducts(
  reportId: string,
  rows: readonly TargetProduct[],
): Promise<DataResult<TargetProduct[]>> {
  const auth = await authorize(canEdit);
  if (!auth.ok) return auth;

  const parsed = targetProductsSchema.safeParse({ reportId, rows });
  if (!parsed.success) return fail("invalid", undefined, fieldErrorsOf(parsed.error.issues));

  const session = await openSession(auth.data);
  if (!session.ok) return session;

  const existing = await storedRows(
    session.data,
    "report_target_products",
    reportId,
    "saveTargetProducts",
  );
  if (!existing.ok) return existing;

  const wanted = rows
    .filter((row) => !isBlankTargetProduct(row))
    .map((row, index) => {
      const id = resolveRowId(row.id, existing.data);
      return targetProductToUpsert(
        reportId,
        { ...row, id },
        index,
        authorOf(existing.data, id, session.data.userId),
      );
    });

  const keep = new Set(wanted.map((row) => row.id).filter((id): id is string => Boolean(id)));
  const surplus = [...existing.data.keys()].filter((id) => !keep.has(id));

  if (surplus.length > 0) {
    const { error } = await session.data.client
      .from("report_target_products")
      .delete()
      .in("id", surplus);
    if (error) return failWith(toDataError(error, "saveTargetProducts"));
  }

  if (wanted.length > 0) {
    const { error } = await session.data.client
      .from("report_target_products")
      .upsert(wanted, { onConflict: "id" });
    if (error) return failWith(toDataError(error, "saveTargetProducts"));
  }

  const { data, error } = await session.data.client
    .from("report_target_products")
    .select("*")
    .eq("report_id", reportId)
    .order("sort_order", { ascending: true });

  if (error) return failWith(toDataError(error, "saveTargetProducts:reload"));

  revalidateReport(reportId);
  return ok((data ?? []).map(rowToTargetProduct));
}
