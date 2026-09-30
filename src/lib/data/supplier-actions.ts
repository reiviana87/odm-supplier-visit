"use server";

/**
 * Supplier mutations — server actions (Phase 2 §24, §26, §33).
 *
 * Every action follows the same steps, in this order:
 *   1. who is signed in — no session, no write;
 *   2. what their role allows — a viewer is refused before anything is parsed;
 *   3. the zod schema, server-side: the client copy is for UX, this one is for
 *      integrity, and it answers with field errors the form can show in place;
 *   4. demo mode, which refuses honestly instead of pretending to have saved;
 *   5. the write, then `revalidatePath` on the routes that show the record.
 *
 * No action redirects. They return the id and let the caller route, so a form
 * that fails can stay where it is with the message next to the field.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { canEdit, canManage } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import {
  ACCEPTED_CERTIFICATE_MIME,
  CERTIFICATE_URL_TTL_SECONDS,
  MAX_CERTIFICATE_BYTES,
  SUPPLIER_BUCKET,
} from "@/lib/data/certificate-limits";
import {
  fail,
  ok,
  toDataError,
  uniqueConflict,
  type DataError,
  type DataResult,
} from "@/lib/data/errors";
import {
  certificateToInsert,
  certificateToUpdate,
  contactToInsert,
  contactToUpdate,
  supplierToInsert,
  supplierToUpdate,
  toNullable,
  type SupplierCertificateWriteValues,
  type SupplierContactWriteValues,
  type SupplierWriteValues,
} from "@/lib/data/supplier-mappers";
import { supplierExistsByCode } from "@/lib/data/suppliers";
import { isMockMode } from "@/lib/supabase/env";
import { getServerSupabase } from "@/lib/supabase/server";
import {
  supplierCertificateSchema,
  supplierContactSchema,
  supplierFormSchema,
} from "@/lib/suppliers/supplier-schema";
import type { Database } from "@/types/database";
import type { UserRole } from "@/types/domain";

interface Session {
  client: SupabaseClient<Database>;
  userId: string;
}

/** README §22 — say what happened, and what the user can do about it. */
const DEMO_READ_ONLY = "Demo data is read-only — connect a Supabase project to save changes.";

const CODE_TAKEN = "That EBARA supplier code already belongs to another supplier.";

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

/**
 * A unique violation on `supplier_code` is the one conflict a user can fix, so
 * it is returned against the field rather than as a banner. Everything else
 * keeps the generic sentence and the detail goes to the server log.
 */
function writeError(error: unknown, context: string): DataError {
  const dataError = toDataError(error, context);
  if (dataError.code !== "conflict") return dataError;

  const detail = error as { message?: string | null; details?: string | null } | null;
  if (/supplier_code/i.test(`${detail?.message ?? ""} ${detail?.details ?? ""}`)) {
    return uniqueConflict("supplierCode", CODE_TAKEN);
  }

  return dataError;
}

function failWith<T>(error: DataError): DataResult<T> {
  return { ok: false, error };
}

/** The list, the record and its tabs, and the New Report supplier picker. */
function revalidateSuppliers(supplierId?: string): void {
  revalidatePath("/suppliers");
  revalidatePath("/reports/new");
  if (supplierId) revalidatePath(`/suppliers/${supplierId}`, "layout");
}

// ─────────────────────────────────────────────────────────────────────────────
// Child rows
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Writes the contact cards a supplier form submits.
 *
 * The form carries no row ids, so the cards are matched to the stored rows by
 * position: the first N rows are updated in place, extra cards are inserted and
 * the surplus is deleted. That keeps the ids of rows the user did not touch —
 * which a delete-all-then-reinsert would churn — and it is what the form means,
 * since `supplierToFormValues()` loads the cards in row order. Blank cards are
 * skipped: the form opens with one of each.
 */
async function syncContacts(
  session: Session,
  supplierId: string,
  values: SupplierWriteValues,
): Promise<DataError | null> {
  const wanted = values.contacts.filter((contact) => contact.name.trim() !== "");

  const { data, error } = await session.client
    .from("supplier_contacts")
    .select("id")
    .eq("supplier_id", supplierId)
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true });

  if (error) return toDataError(error, "syncContacts");
  const existing = data ?? [];

  for (const [index, contact] of wanted.entries()) {
    // The data sheet's "Person in charge (Sales)" is the first card.
    const write = { ...contact, isPrimary: index === 0, sortOrder: index };
    const row = existing[index];

    const result = row
      ? await session.client
          .from("supplier_contacts")
          .update(contactToUpdate(write))
          .eq("id", row.id)
      : await session.client
          .from("supplier_contacts")
          .insert(contactToInsert(supplierId, write, index, index === 0));

    if (result.error) return toDataError(result.error, "syncContacts");
  }

  const surplus = existing.slice(wanted.length).map((row) => row.id);
  if (surplus.length === 0) return null;

  const { error: deleteError } = await session.client
    .from("supplier_contacts")
    .delete()
    .in("id", surplus);

  return deleteError ? toDataError(deleteError, "syncContacts") : null;
}

/** The same positional rule for `05 · Certificates`. */
async function syncCertificates(
  session: Session,
  supplierId: string,
  values: SupplierWriteValues,
): Promise<DataError | null> {
  const wanted = values.certificates.filter((certificate) => certificate.name.trim() !== "");

  const { data, error } = await session.client
    .from("supplier_certificates")
    .select("id")
    .eq("supplier_id", supplierId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) return toDataError(error, "syncCertificates");
  const existing = data ?? [];

  for (const [index, certificate] of wanted.entries()) {
    const write = { ...certificate, sortOrder: index };
    const row = existing[index];

    const result = row
      ? await session.client
          .from("supplier_certificates")
          .update(certificateToUpdate(write))
          .eq("id", row.id)
      : await session.client
          .from("supplier_certificates")
          .insert(certificateToInsert(supplierId, write, index));

    if (result.error) return toDataError(result.error, "syncCertificates");
  }

  const surplus = existing.slice(wanted.length).map((row) => row.id);
  if (surplus.length === 0) return null;

  const { error: deleteError } = await session.client
    .from("supplier_certificates")
    .delete()
    .in("id", surplus);

  return deleteError ? toDataError(deleteError, "syncCertificates") : null;
}

/**
 * Keeps `suppliers.contact_*` — four columns of the §8.1 Excel sheet — equal to
 * the primary contact card, and promotes the next card by sort order when the
 * primary one is gone (§6). A supplier with no cards left clears the columns
 * rather than keeping the name of a person who was deleted.
 */
async function refreshPrimaryContact(
  session: Session,
  supplierId: string,
): Promise<DataError | null> {
  const { data, error } = await session.client
    .from("supplier_contacts")
    .select("id, name, role, email, phone, wechat, is_primary, sort_order")
    .eq("supplier_id", supplierId)
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true });

  if (error) return toDataError(error, "refreshPrimaryContact");

  const primary = (data ?? [])[0] ?? null;

  if (primary && !primary.is_primary) {
    const { error: promoteError } = await session.client
      .from("supplier_contacts")
      .update({ is_primary: true })
      .eq("id", primary.id);
    if (promoteError) return toDataError(promoteError, "refreshPrimaryContact");
  }

  const { error: mirrorError } = await session.client
    .from("suppliers")
    .update({
      contact_name: toNullable(primary?.name),
      contact_title: toNullable(primary?.role),
      contact_wechat: toNullable(primary?.wechat),
      contact_email: toNullable(primary?.email),
      updated_by: session.userId,
    })
    .eq("id", supplierId);

  return mirrorError ? toDataError(mirrorError, "refreshPrimaryContact") : null;
}

/** The supplier a child row belongs to, or `not_found` when the row is gone. */
async function ownerOf(
  session: Session,
  table: "supplier_contacts" | "supplier_certificates",
  id: string,
): Promise<DataResult<string>> {
  const { data, error } = await session.client
    .from(table)
    .select("supplier_id")
    .eq("id", id)
    .maybeSingle();

  if (error) return failWith(toDataError(error, `ownerOf:${table}`));
  if (!data) return fail("not_found");

  return ok(data.supplier_id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Supplier
// ─────────────────────────────────────────────────────────────────────────────

export async function createSupplier(
  values: SupplierWriteValues,
): Promise<DataResult<{ id: string }>> {
  const auth = await authorize(canEdit);
  if (!auth.ok) return auth;

  const parsed = supplierFormSchema.safeParse(values);
  if (!parsed.success) return fail("invalid", undefined, fieldErrorsOf(parsed.error.issues));

  const session = await openSession(auth.data);
  if (!session.ok) return session;

  const code = toNullable(values.supplierCode);
  if (code) {
    const taken = await supplierExistsByCode(code);
    if (!taken.ok) return taken;
    if (taken.data) return failWith(uniqueConflict("supplierCode", CODE_TAKEN));
  }

  const { data, error } = await session.data.client
    .from("suppliers")
    .insert(supplierToInsert(values, session.data.userId))
    .select("id")
    .single();

  if (error) return failWith(writeError(error, "createSupplier"));

  const supplierId = data.id;
  const childError =
    (await syncContacts(session.data, supplierId, values)) ??
    (await syncCertificates(session.data, supplierId, values));

  if (childError) {
    // PostgREST has no transaction across requests, so a half-written record is
    // taken back rather than left for the user to find. The delete is allowed
    // by row level security because this session created the row a moment ago.
    await session.data.client.from("suppliers").delete().eq("id", supplierId);
    return failWith(childError);
  }

  revalidateSuppliers(supplierId);
  return ok({ id: supplierId });
}

export async function updateSupplier(
  id: string,
  values: SupplierWriteValues,
): Promise<DataResult<{ id: string }>> {
  const auth = await authorize(canEdit);
  if (!auth.ok) return auth;

  const parsed = supplierFormSchema.safeParse(values);
  if (!parsed.success) return fail("invalid", undefined, fieldErrorsOf(parsed.error.issues));

  const session = await openSession(auth.data);
  if (!session.ok) return session;

  const code = toNullable(values.supplierCode);
  if (code) {
    const taken = await supplierExistsByCode(code, id);
    if (!taken.ok) return taken;
    if (taken.data) return failWith(uniqueConflict("supplierCode", CODE_TAKEN));
  }

  const { data, error } = await session.data.client
    .from("suppliers")
    .update(supplierToUpdate(values, session.data.userId))
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) return failWith(writeError(error, "updateSupplier"));
  if (!data) return fail("not_found");

  const childError =
    (await syncContacts(session.data, id, values)) ??
    (await syncCertificates(session.data, id, values));
  if (childError) return failWith(childError);

  revalidateSuppliers(id);
  return ok({ id });
}

/**
 * Phase 2 §33 — a supplier leaves the lists and the pickers by being archived,
 * which keeps every report written about it readable.
 */
export async function archiveSupplier(id: string): Promise<DataResult<{ id: string }>> {
  const session = await beginWrite(canManage);
  if (!session.ok) return session;

  const { data, error } = await session.data.client
    .from("suppliers")
    .update({ archived_at: new Date().toISOString(), updated_by: session.data.userId })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) return failWith(writeError(error, "archiveSupplier"));
  if (!data) return fail("not_found");

  revalidateSuppliers(id);
  return ok({ id });
}

export async function restoreSupplier(id: string): Promise<DataResult<{ id: string }>> {
  const session = await beginWrite(canManage);
  if (!session.ok) return session;

  const { data, error } = await session.data.client
    .from("suppliers")
    .update({ archived_at: null, updated_by: session.data.userId })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) return failWith(writeError(error, "restoreSupplier"));
  if (!data) return fail("not_found");

  revalidateSuppliers(id);
  return ok({ id });
}

/**
 * Phase 2 §33 — deletion is refused for a supplier that has been visited.
 *
 * A record created by mistake this morning can still be removed; one with a
 * report behind it never is, because that report documents a visit that
 * happened. The refusal names the alternative instead of only saying no.
 */
export async function deleteSupplier(id: string): Promise<DataResult<{ id: string }>> {
  const session = await beginWrite(canManage);
  if (!session.ok) return session;

  const { count, error: countError } = await session.data.client
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("supplier_id", id);

  if (countError) return failWith(toDataError(countError, "deleteSupplier"));

  const reportCount = count ?? 0;
  if (reportCount > 0) {
    return fail(
      "conflict",
      `This supplier has ${reportCount} visit report${reportCount === 1 ? "" : "s"}, so it cannot be deleted. ` +
        "Archive it instead — it leaves the lists and pickers, and its reports stay readable.",
    );
  }

  const { data, error } = await session.data.client
    .from("suppliers")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) return failWith(writeError(error, "deleteSupplier"));
  // An empty result means the row is already gone, or row level security
  // refused the delete to someone who did not create it.
  if (!data || data.length === 0) return fail("not_found");

  revalidateSuppliers(id);
  return ok({ id });
}

// ─────────────────────────────────────────────────────────────────────────────
// Contacts — README §1.7 Contacts tab
// ─────────────────────────────────────────────────────────────────────────────

/** `supplier_contacts.name` is not null, and a card with no name is not a contact. */
function validateContact(values: SupplierContactWriteValues): DataError | null {
  const parsed = supplierContactSchema.safeParse(values);
  if (!parsed.success) {
    return {
      code: "invalid",
      message: "Some fields need attention before this can be saved.",
      fieldErrors: fieldErrorsOf(parsed.error.issues),
    };
  }
  if (values.name.trim() === "") {
    return {
      code: "invalid",
      message: "A contact needs a name.",
      fieldErrors: { name: "Enter the contact's name." },
    };
  }
  return null;
}

export async function createContact(
  supplierId: string,
  values: SupplierContactWriteValues,
): Promise<DataResult<{ id: string }>> {
  const auth = await authorize(canEdit);
  if (!auth.ok) return auth;

  const invalid = validateContact(values);
  if (invalid) return failWith(invalid);

  const session = await openSession(auth.data);
  if (!session.ok) return session;

  const { data: existing, error: readError } = await session.data.client
    .from("supplier_contacts")
    .select("sort_order")
    .eq("supplier_id", supplierId)
    .order("sort_order", { ascending: false })
    .limit(1);

  if (readError) return failWith(toDataError(readError, "createContact"));

  const last = (existing ?? [])[0];
  const sortOrder = last ? last.sort_order + 1 : 0;

  // Same rule as `updateContact`: at most one primary card per supplier, so a
  // card that arrives claiming the role steps the old one down first. Without
  // this the insert trips the partial unique index and the user is told a
  // "value is already in use" that names nothing they can see.
  if (values.isPrimary === true) {
    const { error: demoteError } = await session.data.client
      .from("supplier_contacts")
      .update({ is_primary: false })
      .eq("supplier_id", supplierId);
    if (demoteError) return failWith(toDataError(demoteError, "createContact"));
  }

  const { data, error } = await session.data.client
    .from("supplier_contacts")
    // The first card a supplier gets is its sales contact.
    .insert(contactToInsert(supplierId, values, sortOrder, last === undefined))
    .select("id")
    .single();

  if (error) return failWith(writeError(error, "createContact"));

  const mirrorError = await refreshPrimaryContact(session.data, supplierId);
  if (mirrorError) return failWith(mirrorError);

  revalidateSuppliers(supplierId);
  return ok({ id: data.id });
}

export async function updateContact(
  id: string,
  values: SupplierContactWriteValues,
): Promise<DataResult<{ id: string }>> {
  const auth = await authorize(canEdit);
  if (!auth.ok) return auth;

  const invalid = validateContact(values);
  if (invalid) return failWith(invalid);

  const session = await openSession(auth.data);
  if (!session.ok) return session;

  const owner = await ownerOf(session.data, "supplier_contacts", id);
  if (!owner.ok) return owner;

  // At most one primary card per supplier: naming a new one steps the old one
  // down before the write, not after.
  if (values.isPrimary === true) {
    const { error: demoteError } = await session.data.client
      .from("supplier_contacts")
      .update({ is_primary: false })
      .eq("supplier_id", owner.data)
      .neq("id", id);
    if (demoteError) return failWith(toDataError(demoteError, "updateContact"));
  }

  const { data, error } = await session.data.client
    .from("supplier_contacts")
    .update(contactToUpdate(values))
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) return failWith(writeError(error, "updateContact"));
  if (!data) return fail("not_found");

  const mirrorError = await refreshPrimaryContact(session.data, owner.data);
  if (mirrorError) return failWith(mirrorError);

  revalidateSuppliers(owner.data);
  return ok({ id });
}

/** Contacts can be deleted (§6); deleting the primary promotes the next by sort order. */
export async function deleteContact(id: string): Promise<DataResult<{ id: string }>> {
  const session = await beginWrite(canEdit);
  if (!session.ok) return session;

  const owner = await ownerOf(session.data, "supplier_contacts", id);
  if (!owner.ok) return owner;

  const { data, error } = await session.data.client
    .from("supplier_contacts")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) return failWith(toDataError(error, "deleteContact"));
  if (!data || data.length === 0) return fail("forbidden");

  const mirrorError = await refreshPrimaryContact(session.data, owner.data);
  if (mirrorError) return failWith(mirrorError);

  revalidateSuppliers(owner.data);
  return ok({ id });
}

// ─────────────────────────────────────────────────────────────────────────────
// Certificates — README §1.7 Certificates tab
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One row of the Certificates tab. `values.id` decides: with it the stored copy
 * is corrected, without it a new one is recorded at the end of the list.
 */
export async function upsertCertificate(
  supplierId: string,
  values: SupplierCertificateWriteValues,
): Promise<DataResult<{ id: string }>> {
  const auth = await authorize(canEdit);
  if (!auth.ok) return auth;

  const parsed = supplierCertificateSchema.safeParse(values);
  if (!parsed.success) return fail("invalid", undefined, fieldErrorsOf(parsed.error.issues));
  if (values.name.trim() === "") {
    return fail("invalid", "A certificate needs a name.", {
      name: "Enter the certificate, e.g. ISO 9001.",
    });
  }

  const session = await openSession(auth.data);
  if (!session.ok) return session;

  if (values.id) {
    const { data, error } = await session.data.client
      .from("supplier_certificates")
      .update(certificateToUpdate(values))
      .eq("id", values.id)
      // Scoped to the supplier as well, so a stale id from another record
      // cannot be written through this form.
      .eq("supplier_id", supplierId)
      .select("id")
      .maybeSingle();

    if (error) return failWith(writeError(error, "upsertCertificate"));
    if (!data) return fail("not_found");

    revalidateSuppliers(supplierId);
    return ok({ id: data.id });
  }

  const { data: existing, error: readError } = await session.data.client
    .from("supplier_certificates")
    .select("sort_order")
    .eq("supplier_id", supplierId)
    .order("sort_order", { ascending: false })
    .limit(1);

  if (readError) return failWith(toDataError(readError, "upsertCertificate"));

  const last = (existing ?? [])[0];

  const { data, error } = await session.data.client
    .from("supplier_certificates")
    .insert(certificateToInsert(supplierId, values, last ? last.sort_order + 1 : 0))
    .select("id")
    .single();

  if (error) return failWith(writeError(error, "upsertCertificate"));

  revalidateSuppliers(supplierId);
  return ok({ id: data.id });
}

export async function deleteCertificate(id: string): Promise<DataResult<{ id: string }>> {
  const session = await beginWrite(canEdit);
  if (!session.ok) return session;

  const owner = await ownerOf(session.data, "supplier_certificates", id);
  if (!owner.ok) return owner;

  const { data, error } = await session.data.client
    .from("supplier_certificates")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) return failWith(toDataError(error, "deleteCertificate"));
  if (!data || data.length === 0) return fail("forbidden");

  revalidateSuppliers(owner.data);
  return ok({ id });
}

/**
 * The copy of a certificate collected during a visit.
 *
 * README §19 calls §7 "photo-first": what is worth having is the scan, and the
 * three fields are what somebody typed off it. The bytes go to the same private
 * `supplier-files` bucket the data sheets use, under the supplier that owns
 * them, and the row records the name so the card can say what it is holding.
 *
 * The object path is decided here rather than in the browser, and the row is
 * only updated once the upload has actually landed — a path recorded for an
 * object that does not exist is worse than no path at all, because the card
 * would then claim a copy nobody can open.
 */
export async function uploadCertificateFile(
  supplierId: string,
  certificateId: string,
  file: File,
): Promise<DataResult<{ id: string; fileName: string }>> {
  const session = await beginWrite(canEdit);
  if (!session.ok) return session;

  const owner = await ownerOf(session.data, "supplier_certificates", certificateId);
  if (!owner.ok) return owner;
  if (owner.data !== supplierId) return fail("not_found");

  if (file.size === 0) return fail("invalid", "That file is empty.");
  if (file.size > MAX_CERTIFICATE_BYTES) {
    return fail(
      "invalid",
      `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${
        MAX_CERTIFICATE_BYTES / 1024 / 1024
      } MB.`,
    );
  }
  if (!ACCEPTED_CERTIFICATE_MIME.includes(file.type)) {
    return fail(
      "invalid",
      "A certificate copy has to be a JPEG, a PNG or a PDF page.",
    );
  }

  const extension = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
  const storagePath = `${supplierId}/certificates/${certificateId}.${extension}`;

  const upload = await session.data.client.storage
    .from(SUPPLIER_BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: true });
  if (upload.error) return failWith(toDataError(upload.error, "uploadCertificateFile"));

  const { data, error } = await session.data.client
    .from("supplier_certificates")
    .update({
      file_name: file.name,
      storage_path: storagePath,
      // A copy in hand is what "valid" means here — README §1.7. The dates are
      // still whatever somebody typed; this only records that the paper exists.
      status: "valid",
    })
    .eq("id", certificateId)
    .eq("supplier_id", supplierId)
    .select("id")
    .maybeSingle();

  if (error) return failWith(writeError(error, "uploadCertificateFile"));
  if (!data) {
    // The row went while the bytes were in flight. Take the object back out
    // rather than leaving it behind a row that no longer refers to it.
    await session.data.client.storage.from(SUPPLIER_BUCKET).remove([storagePath]);
    return fail("not_found");
  }

  revalidateSuppliers(supplierId);
  return ok({ id: data.id, fileName: file.name });
}

/** Signed URLs for certificate copies, keyed by storage path. */
export async function signCertificateUrls(
  paths: readonly string[],
): Promise<DataResult<Record<string, string>>> {
  if (paths.length === 0) return ok({});

  const user = await getCurrentUser();
  if (!user) return fail("unauthenticated");

  const client = await getServerSupabase();
  if (!client) return fail("offline");

  const { data, error } = await client.storage
    .from(SUPPLIER_BUCKET)
    .createSignedUrls([...paths], CERTIFICATE_URL_TTL_SECONDS);

  if (error) return failWith(toDataError(error, "signCertificateUrls"));

  const urls: Record<string, string> = {};
  for (const entry of data ?? []) {
    if (entry.signedUrl && entry.path) urls[entry.path] = entry.signedUrl;
  }
  return ok(urls);
}
