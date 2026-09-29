"use server";

/**
 * The corporate Word template — README §16.
 *
 * The `.docx` the user uploads is the SHELL the exporter clones: its header
 * logos, its footer table, its styles and its page setup are the document, not
 * a theme applied to one. So the bytes matter, and this module's job is to keep
 * them intact and to keep exactly one version marked active.
 *
 * The bytes go to the private `report-templates` bucket (0007); the row in
 * `report_templates` (0001) holds the path, the version and the geometry read
 * out of the file at upload. Nothing stores a public URL, because the bucket has
 * none — a template carries the company letterhead and a signature image.
 *
 * Uploading happens here rather than straight from the browser so the object
 * path is server-decided, and so the file is verified to actually be a Word
 * package before it becomes something every future export depends on.
 */

import { randomUUID } from "node:crypto";
import { inflateRawSync } from "node:zlib";

import { revalidatePath } from "next/cache";

import type { SupabaseClient } from "@supabase/supabase-js";

import { canManage } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import {
  DEFAULT_MESSAGES,
  fail,
  ok,
  toDataError,
  type DataError,
  type DataResult,
} from "@/lib/data/errors";
import {
  MAX_TEMPLATE_BYTES,
  TEMPLATE_BUCKET,
  TEMPLATE_MIME,
} from "@/lib/data/template-limits";
import { isMockMode } from "@/lib/supabase/env";
import { getServerSupabase } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";
import type { UserRole } from "@/types/domain";

const DEMO_READ_ONLY =
  "Demo data is read-only — connect a Supabase project to manage templates.";

/**
 * The guard every write shares: signed in, allowed, not demo, connected.
 *
 * Manager and above, not editor: 0004 says the same about the rows, because
 * changing the active template changes the layout of every report exported
 * afterwards.
 *
 * The client is annotated rather than inferred. Without the explicit
 * `SupabaseClient<Database>` the union widens and every `.from()` below types as
 * `never`, which is a confusing way to be told the generic was lost.
 */
type TemplateSession =
  | { ok: false; error: DataError }
  | { ok: true; client: SupabaseClient<Database>; userId: string; role: UserRole };

async function session(): Promise<TemplateSession> {
  const refuse = (code: DataError["code"], message?: string): TemplateSession => ({
    ok: false,
    error: { code, message: message ?? DEFAULT_MESSAGES[code] },
  });

  const user = await requireUser();
  if (!user) return refuse("unauthenticated");
  if (!canManage(user.role)) {
    return refuse(
      "forbidden",
      "Only a manager or an administrator can change the report template.",
    );
  }
  if (isMockMode()) return refuse("forbidden", DEMO_READ_ONLY);

  const client = await getServerSupabase();
  if (!client) return refuse("offline");

  return { ok: true, client, userId: user.id, role: user.role };
}

function revalidateTemplates() {
  revalidatePath("/templates");
}

// ─────────────────────────────────────────────────────────────────────────────
// Reading the OOXML package
//
// A .docx is a ZIP. Only two things are needed from it — proof that
// word/document.xml exists, and the page setup inside it — so the central
// directory is walked and that one entry inflated, rather than unpacking 43
// entries of which 10 are photographs.
//
// Deliberately hand-rolled: adding a ZIP dependency to read two numbers out of
// a file the app already holds in memory is not worth the supply chain.
// ─────────────────────────────────────────────────────────────────────────────

/** Local file header, central directory entry, end of central directory. */
const SIGNATURE_LOCAL = 0x04034b50;
const SIGNATURE_CENTRAL = 0x02014b50;
const SIGNATURE_EOCD = 0x06054b50;

/** Twips per centimetre. Word stores every length in twentieths of a point. */
const TWIPS_PER_CM = 567;

interface ZipEntry {
  /** 0 = stored, 8 = deflate. Nothing else appears in a Word package. */
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
}

/**
 * The end-of-central-directory record, found by scanning backwards.
 *
 * It sits at the very end of the file unless there is a ZIP comment, which is
 * why the scan is needed rather than a fixed offset; the comment is at most
 * 0xffff bytes, so the search window is bounded.
 */
function findEndOfCentralDirectory(buffer: Buffer): number {
  const limit = Math.max(0, buffer.length - (22 + 0xffff));
  for (let offset = buffer.length - 22; offset >= limit; offset -= 1) {
    if (buffer.readUInt32LE(offset) === SIGNATURE_EOCD) return offset;
  }
  return -1;
}

/**
 * The package's entries by name, or null when the bytes are not a ZIP this can
 * read. Zip64 is treated as unreadable: a Word document does not reach 4 GB or
 * 65 535 entries, so a file claiming to is not one worth cloning.
 */
function readZipEntries(buffer: Buffer): Map<string, ZipEntry> | null {
  const eocd = findEndOfCentralDirectory(buffer);
  if (eocd < 0) return null;

  const count = buffer.readUInt16LE(eocd + 10);
  const start = buffer.readUInt32LE(eocd + 16);
  if (count === 0xffff || start === 0xffffffff) return null;

  const entries = new Map<string, ZipEntry>();
  let cursor = start;
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > buffer.length) return null;
    if (buffer.readUInt32LE(cursor) !== SIGNATURE_CENTRAL) return null;

    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString("utf8", cursor + 46, cursor + 46 + nameLength);

    entries.set(name, { method, compressedSize, localHeaderOffset });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** One entry's bytes, or null when it is stored in a way this cannot read. */
function readZipEntry(buffer: Buffer, entry: ZipEntry): Buffer | null {
  const header = entry.localHeaderOffset;
  if (header + 30 > buffer.length) return null;
  if (buffer.readUInt32LE(header) !== SIGNATURE_LOCAL) return null;

  // The local header repeats the name and carries its own extra field, which is
  // usually a different length from the central directory's.
  const nameLength = buffer.readUInt16LE(header + 26);
  const extraLength = buffer.readUInt16LE(header + 28);
  const from = header + 30 + nameLength + extraLength;
  const raw = buffer.subarray(from, from + entry.compressedSize);

  if (entry.method === 0) return Buffer.from(raw);
  if (entry.method === 8) return inflateRawSync(raw);
  return null;
}

/** True when the bytes begin with the ZIP local-header magic, 50 4B 03 04. */
function hasZipMagic(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Geometry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What the Templates screen shows about a version, measured from the file.
 *
 * A type alias rather than an interface so it is assignable to `Json` on the way
 * into the jsonb column: TypeScript grants an implicit index signature to object
 * type aliases and not to interfaces.
 *
 * Every field is optional. A template the app cannot measure is still a template
 * the exporter can clone, so an unreadable package stores an empty object rather
 * than failing the upload.
 */
export type TemplateGeometry = {
  pageWidthCm?: number;
  pageHeightCm?: number;
  orientation?: "portrait" | "landscape";
  marginTopCm?: number;
  marginRightCm?: number;
  marginBottomCm?: number;
  marginLeftCm?: number;
  /** Page minus its margins — the box the body actually prints into. */
  textWidthCm?: number;
  textHeightCm?: number;
  appendixColumns?: number;
  bodyFont?: string;
  bodyFontSizePt?: number;
};

/** Twips → centimetres, to two decimals (a 557-twip top margin is 0.98 cm). */
function toCm(twips: number): number {
  return Math.round((twips / TWIPS_PER_CM) * 100) / 100;
}

/** One integer attribute out of an already-matched tag, or null. */
function attribute(tag: string, name: string): number | null {
  const match = new RegExp(`${name}="(-?\\d+)"`).exec(tag);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

/**
 * The value most runs use, which is what "the body font" means in a corporate
 * template. Not the docDefaults value: the EBARA template's docDefaults say
 * Times New Roman while every visible run overrides to Arial, so the default is
 * the one thing in the file that is never on the page.
 */
function modalValue(xml: string, pattern: RegExp): string | null {
  const counts = new Map<string, number>();
  for (const match of xml.matchAll(pattern)) {
    counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
  }

  let best: string | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

function parseGeometry(documentXml: string): TemplateGeometry {
  const geometry: TemplateGeometry = {};
  let pageWidthTwips: number | null = null;
  let pageHeightTwips: number | null = null;

  const pgSz = /<w:pgSz\b[^>]*>/.exec(documentXml)?.[0];
  if (pgSz) {
    pageWidthTwips = attribute(pgSz, "w:w");
    pageHeightTwips = attribute(pgSz, "w:h");
    if (pageWidthTwips !== null) geometry.pageWidthCm = toCm(pageWidthTwips);
    if (pageHeightTwips !== null) geometry.pageHeightCm = toCm(pageHeightTwips);
    geometry.orientation = /w:orient="landscape"/.test(pgSz) ? "landscape" : "portrait";
  }

  const pgMar = /<w:pgMar\b[^>]*>/.exec(documentXml)?.[0];
  if (pgMar) {
    const top = attribute(pgMar, "w:top");
    const right = attribute(pgMar, "w:right");
    const bottom = attribute(pgMar, "w:bottom");
    const left = attribute(pgMar, "w:left");
    if (top !== null) geometry.marginTopCm = toCm(top);
    if (right !== null) geometry.marginRightCm = toCm(right);
    if (bottom !== null) geometry.marginBottomCm = toCm(bottom);
    if (left !== null) geometry.marginLeftCm = toCm(left);

    // Computed from the raw twips rather than from the rounded centimetres, so
    // the text box is exact rather than the sum of three roundings.
    if (pageWidthTwips !== null && left !== null && right !== null) {
      geometry.textWidthCm = toCm(pageWidthTwips - left - right);
    }
    if (pageHeightTwips !== null && top !== null && bottom !== null) {
      geometry.textHeightCm = toCm(pageHeightTwips - top - bottom);
    }
  }

  // The appendix grid is the last table in the document (the alternating
  // photo/caption rows), so its `w:gridCol` count is the column count the
  // screen displays.
  const grids = [...documentXml.matchAll(/<w:tblGrid>([\s\S]*?)<\/w:tblGrid>/g)];
  const lastGrid = grids.at(-1)?.[1];
  if (lastGrid) {
    const columns = lastGrid.match(/<w:gridCol\b/g)?.length ?? 0;
    if (columns > 0) geometry.appendixColumns = columns;
  }

  const font = modalValue(documentXml, /<w:rFonts\b[^>]*\bw:ascii="([^"]+)"/g);
  if (font) geometry.bodyFont = font;

  // `w:sz` is in half-points, so 20 is the 10 pt body text.
  const halfPoints = modalValue(documentXml, /<w:sz\b[^>]*\bw:val="(\d+)"/g);
  if (halfPoints) {
    const points = Number(halfPoints) / 2;
    if (Number.isFinite(points) && points > 0) geometry.bodyFontSizePt = points;
  }

  return geometry;
}

/** Read a stored `page_geometry` back out of jsonb without widening to `any`. */
function geometryFromJson(value: Json | null): TemplateGeometry {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const source: Record<string, Json | undefined> = value;

  const numberAt = (key: string): number | undefined => {
    const raw = source[key];
    return typeof raw === "number" && Number.isFinite(raw) ? raw : undefined;
  };

  const geometry: TemplateGeometry = {
    pageWidthCm: numberAt("pageWidthCm"),
    pageHeightCm: numberAt("pageHeightCm"),
    marginTopCm: numberAt("marginTopCm"),
    marginRightCm: numberAt("marginRightCm"),
    marginBottomCm: numberAt("marginBottomCm"),
    marginLeftCm: numberAt("marginLeftCm"),
    textWidthCm: numberAt("textWidthCm"),
    textHeightCm: numberAt("textHeightCm"),
    appendixColumns: numberAt("appendixColumns"),
    bodyFontSizePt: numberAt("bodyFontSizePt"),
  };

  if (source.orientation === "portrait" || source.orientation === "landscape") {
    geometry.orientation = source.orientation;
  }
  if (typeof source.bodyFont === "string" && source.bodyFont.length > 0) {
    geometry.bodyFont = source.bodyFont;
  }

  return geometry;
}

// ─────────────────────────────────────────────────────────────────────────────
// Versions
// ─────────────────────────────────────────────────────────────────────────────

/** `v1.5` → major 1, minor 5. Anything else → null. */
function parseVersion(version: string): { major: number; minor: number } | null {
  const match = /^v?(\d+)\.(\d+)$/.exec(version.trim());
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]) };
}

/**
 * The next version number, when the user did not type one.
 *
 * The rule: take the highest `vMAJOR.MINOR` already stored, compared
 * numerically rather than as text — which is the whole reason not to sort the
 * strings, since "v1.9" sorts above "v1.10" — and add one to the minor, so
 * v1.5 becomes v1.6. A version the user typed is never rewritten, and a major
 * bump stays something they type deliberately. With nothing stored, the first
 * upload is v1.0.
 */
function nextVersion(existing: readonly string[]): string {
  let best: { major: number; minor: number } | null = null;
  for (const version of existing) {
    const parsed = parseVersion(version);
    if (!parsed) continue;
    const higher =
      !best || parsed.major > best.major || (parsed.major === best.major && parsed.minor > best.minor);
    if (higher) best = parsed;
  }
  return best ? `v${best.major}.${best.minor + 1}` : "v1.0";
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload
// ─────────────────────────────────────────────────────────────────────────────

export interface UploadTemplateInput {
  /** Display name, e.g. "EBARA ODM Visit Report Template". */
  name: string;
  /** Omitted means "the next one" — see `nextVersion()`. */
  version?: string;
  changeNote?: string;
  /**
   * The `.docx`. Typed as `File` rather than `Blob` because the row stores the
   * original file name and the browser-reported type; a File survives the
   * server-action boundary, a Buffer does not.
   */
  file: File;
}

export interface UploadedTemplate {
  id: string;
  version: string;
  storagePath: string;
  geometry: TemplateGeometry;
}

/**
 * Store a new version of the corporate template.
 *
 * It does NOT become active. Activating changes the shell of every report
 * exported afterwards, so it stays a separate, deliberate act
 * (`setActiveTemplate`).
 */
export async function uploadTemplate(
  input: UploadTemplateInput,
): Promise<DataResult<UploadedTemplate>> {
  const s = await session();
  if (!s.ok) return { ok: false, error: s.error };

  const name = input.name.trim();
  if (!name) {
    return fail("invalid", "Give the template a name so the version history reads clearly.", {
      name: "Required.",
    });
  }

  const fileName = input.file.name.trim();

  // MIME first, because it costs nothing. An empty type is not a refusal on its
  // own — a browser that cannot look the extension up sends nothing — and the
  // byte checks below are the ones that actually decide.
  const reportedType = input.file.type.trim();
  if (reportedType && reportedType !== TEMPLATE_MIME) {
    return fail(
      "invalid",
      "That is not a Word .docx file. The exporter clones the template package itself, so a .doc, .dotx or PDF cannot be used.",
    );
  }
  if (!reportedType && !/\.docx$/i.test(fileName)) {
    return fail("invalid", "That is not a Word .docx file.");
  }

  if (input.file.size === 0) {
    return fail("invalid", "That file is empty.");
  }
  if (input.file.size > MAX_TEMPLATE_BYTES) {
    return fail(
      "invalid",
      `That template is ${(input.file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${
        MAX_TEMPLATE_BYTES / 1024 / 1024
      } MB.`,
    );
  }

  const bytes = Buffer.from(await input.file.arrayBuffer());

  // A renamed .doc passes every MIME check and then breaks the export at
  // generation time, which is a far worse place to find out: by then the user
  // has written a whole report and pressed Export.
  if (!hasZipMagic(bytes)) {
    return fail(
      "invalid",
      "That file is named .docx but is not one — the contents are an older Word format, or something else entirely. Open it in Word and use Save As → Word Document (.docx).",
    );
  }

  const entries = readZipEntries(bytes);
  if (!entries) {
    return fail(
      "invalid",
      "That .docx could not be read. It may be corrupt or password-protected — open it in Word, save a fresh copy and upload that.",
    );
  }
  const documentEntry = entries.get("word/document.xml");
  if (!documentEntry) {
    return fail(
      "invalid",
      "That file is a valid archive but not a Word document: there is no word/document.xml inside it for the exporter to clone.",
    );
  }

  // Measured now, once, so the Templates screen never unzips the package on a
  // page load. Best effort on purpose — see `TemplateGeometry`.
  let geometry: TemplateGeometry = {};
  try {
    const documentXml = readZipEntry(bytes, documentEntry);
    if (documentXml) geometry = parseGeometry(documentXml.toString("utf8"));
  } catch (error) {
    console.error("[data:uploadTemplate] the page geometry could not be measured", error);
  }

  const { data: versionRows, error: versionError } = await s.client
    .from("report_templates")
    .select("version");
  if (versionError) {
    const mapped = toDataError(versionError, "uploadTemplate");
    return fail(mapped.code, mapped.message);
  }

  const taken = (versionRows ?? []).map((row) => row.version);
  const version = input.version?.trim() || nextVersion(taken);
  if (taken.some((existing) => existing.toLowerCase() === version.toLowerCase())) {
    return fail(
      "conflict",
      `Version ${version} already exists. Choose another number so the history stays unambiguous.`,
      { version: "Already used." },
    );
  }

  const templateId = randomUUID();
  // The template id leads the path, so one version's object can never collide
  // with another's even when both files are called EBARA_ODM_Visit_Report.docx.
  // The object key is sanitised because it is a path; the original name stays in
  // `file_name` and is what a download is called.
  const objectName = fileName.replace(/[^A-Za-z0-9._-]+/g, "_") || "template.docx";
  const storagePath = `${templateId}/${objectName}`;

  const upload = await s.client.storage.from(TEMPLATE_BUCKET).upload(storagePath, input.file, {
    contentType: TEMPLATE_MIME,
    upsert: false,
  });
  if (upload.error) {
    const mapped = toDataError(upload.error, "uploadTemplate");
    return fail(mapped.code, mapped.message);
  }

  const { data, error } = await s.client
    .from("report_templates")
    .insert({
      id: templateId,
      name: name.slice(0, 200),
      version,
      file_name: fileName.slice(0, 200) || objectName,
      storage_path: storagePath,
      change_note: input.changeNote?.trim() || null,
      page_geometry: geometry,
      // Never automatically — see the doc comment.
      is_active: false,
      is_archived: false,
      created_by: s.userId,
    })
    .select("id, version")
    .single();

  if (error) {
    // The row is what makes the object reachable, so an orphaned object is
    // worse than a failed upload: remove it rather than leave it paid for and
    // invisible.
    await s.client.storage.from(TEMPLATE_BUCKET).remove([storagePath]);
    const mapped = toDataError(error, "uploadTemplate");
    return fail(mapped.code, mapped.message);
  }

  revalidateTemplates();
  return ok({ id: data.id, version: data.version, storagePath, geometry });
}

// ─────────────────────────────────────────────────────────────────────────────
// Activation, archiving, deletion
// ─────────────────────────────────────────────────────────────────────────────

export async function setActiveTemplate(id: string): Promise<DataResult<{ id: string }>> {
  const s = await session();
  if (!s.ok) return { ok: false, error: s.error };

  const { data: target, error: readError } = await s.client
    .from("report_templates")
    .select("id, version, is_archived, storage_path")
    .eq("id", id)
    .single();
  if (readError) {
    const mapped = toDataError(readError, "setActiveTemplate");
    return fail(mapped.code, mapped.message);
  }

  if (target.is_archived) {
    return fail(
      "invalid",
      `${target.version} is archived. Restore it first — activating it from the archive would make it the live template while it stays out of the current list.`,
    );
  }
  if (!target.storage_path) {
    return fail(
      "invalid",
      `${target.version} has no file behind it, so exports would have nothing to clone. Upload the .docx again.`,
    );
  }

  // 0001's partial unique index allows exactly one `is_active` row, so the
  // clear MUST come first: setting the new one while the old one is still
  // active is rejected outright by the index. In this order the only failure
  // window leaves ZERO active templates — exports then fall back to the
  // built-in layout, which is visible and recoverable — rather than two active
  // rows, which the database would never have accepted anyway.
  const { error: clearError } = await s.client
    .from("report_templates")
    .update({ is_active: false })
    .eq("is_active", true)
    .neq("id", id);
  if (clearError) {
    const mapped = toDataError(clearError, "setActiveTemplate");
    return fail(mapped.code, mapped.message);
  }

  const { error: setError } = await s.client
    .from("report_templates")
    .update({ is_active: true })
    .eq("id", id);
  if (setError) {
    // Logged for diagnosis; the user gets the sentence below, which is more
    // specific than the mapped default because the state it leaves matters.
    toDataError(setError, "setActiveTemplate");
    revalidateTemplates();
    return fail(
      "unknown",
      `The previous template was stood down but ${target.version} could not be activated. No template is active right now, so exports use the built-in layout — try again.`,
    );
  }

  revalidateTemplates();
  return ok({ id });
}

export async function archiveTemplate(id: string): Promise<DataResult<{ id: string }>> {
  const s = await session();
  if (!s.ok) return { ok: false, error: s.error };

  const { data: target, error: readError } = await s.client
    .from("report_templates")
    .select("id, version, is_active")
    .eq("id", id)
    .single();
  if (readError) {
    const mapped = toDataError(readError, "archiveTemplate");
    return fail(mapped.code, mapped.message);
  }

  // An archived row that is still active would keep shaping every export while
  // sitting out of sight in the archive. The replacement goes live first.
  if (target.is_active) {
    return fail(
      "invalid",
      `${target.version} is the active template. Make another version active first, then archive this one.`,
    );
  }

  const { error } = await s.client
    .from("report_templates")
    .update({ is_archived: true })
    .eq("id", id);
  if (error) {
    const mapped = toDataError(error, "archiveTemplate");
    return fail(mapped.code, mapped.message);
  }

  revalidateTemplates();
  return ok({ id });
}

export async function restoreTemplate(id: string): Promise<DataResult<{ id: string }>> {
  const s = await session();
  if (!s.ok) return { ok: false, error: s.error };

  const { error } = await s.client
    .from("report_templates")
    .update({ is_archived: false })
    .eq("id", id);
  if (error) {
    const mapped = toDataError(error, "restoreTemplate");
    return fail(mapped.code, mapped.message);
  }

  revalidateTemplates();
  return ok({ id });
}

export async function deleteTemplate(id: string): Promise<DataResult<{ id: string }>> {
  const s = await session();
  if (!s.ok) return { ok: false, error: s.error };

  const { data: target, error: readError } = await s.client
    .from("report_templates")
    .select("id, version, is_active, storage_path")
    .eq("id", id)
    .single();
  if (readError) {
    const mapped = toDataError(readError, "deleteTemplate");
    return fail(mapped.code, mapped.message);
  }

  if (target.is_active) {
    return fail(
      "invalid",
      `${target.version} is the active template — deleting it would leave every export without its shell, and reports would silently come out in the built-in layout. Archive it instead, or make another version active first.`,
    );
  }

  const { error } = await s.client.from("report_templates").delete().eq("id", id);
  if (error) {
    const mapped = toDataError(error, "deleteTemplate");
    return fail(mapped.code, mapped.message);
  }

  // Row first, object second: an object with no row is invisible but harmless,
  // whereas a row pointing at nothing offers a download that cannot work.
  if (target.storage_path) {
    await s.client.storage.from(TEMPLATE_BUCKET).remove([target.storage_path]);
  }

  revalidateTemplates();
  return ok({ id });
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

export interface TemplateRecord {
  id: string;
  name: string;
  version: string;
  fileName: string;
  storagePath: string | null;
  isActive: boolean;
  isArchived: boolean;
  changeNote: string;
  /** The uploader's name, or "Unknown" when that profile has since been removed. */
  uploadedBy: string;
  /** ISO timestamp — the screen decides how to format it. */
  uploadedAt: string;
  geometry: TemplateGeometry;
}

/**
 * Every stored version, newest first. The active one is `isActive`.
 *
 * The uploader's name is resolved with a second query rather than an embedded
 * select: `created_by` is nullable and points at a row that may have been
 * removed, and one small lookup keyed by id reads better than a join whose
 * result type has to be narrowed at every use.
 */
export async function listTemplates(): Promise<DataResult<TemplateRecord[]>> {
  const user = await requireUser();
  if (!user) return fail("unauthenticated");

  const client = await getServerSupabase();
  if (!client) return fail("offline");

  const { data, error } = await client
    .from("report_templates")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    const mapped = toDataError(error, "listTemplates");
    return fail(mapped.code, mapped.message);
  }

  const rows = data ?? [];
  const uploaderIds = [
    ...new Set(rows.map((row) => row.created_by).filter((id): id is string => Boolean(id))),
  ];

  const names = new Map<string, string>();
  if (uploaderIds.length > 0) {
    const { data: profiles } = await client
      .from("profiles")
      .select("id, full_name")
      .in("id", uploaderIds);
    for (const profile of profiles ?? []) {
      if (profile.full_name) names.set(profile.id, profile.full_name);
    }
  }

  return ok(
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      version: row.version,
      fileName: row.file_name,
      storagePath: row.storage_path,
      isActive: row.is_active,
      isArchived: row.is_archived,
      changeNote: row.change_note ?? "",
      uploadedBy: (row.created_by ? names.get(row.created_by) : null) ?? "Unknown",
      uploadedAt: row.created_at,
      geometry: geometryFromJson(row.page_geometry),
    })),
  );
}

export interface ActiveTemplateFile {
  bytes: Buffer;
  fileName: string;
  version: string;
}

/**
 * The active template's bytes — the contract the DOCX generator depends on.
 *
 * `ok(null)` means there is no active template. That is a normal state, not an
 * error: a fresh project has none, and the exporter then builds the report in
 * its own layout rather than refusing to export at all. A failure, by contrast,
 * means there IS an active template and it could not be read — which the
 * exporter must not paper over, because the user would get a document that had
 * silently lost the corporate shell.
 */
export async function getActiveTemplateBytes(): Promise<DataResult<ActiveTemplateFile | null>> {
  const user = await requireUser();
  if (!user) return fail("unauthenticated");

  // Demo mode has no storage at all, so "no template" is the honest answer and
  // the exporter's own layout is the right fallback.
  if (isMockMode()) return ok(null);

  const client = await getServerSupabase();
  if (!client) return fail("offline");

  const { data, error } = await client
    .from("report_templates")
    .select("id, version, file_name, storage_path")
    .eq("is_active", true)
    .maybeSingle();
  if (error) {
    const mapped = toDataError(error, "getActiveTemplateBytes");
    return fail(mapped.code, mapped.message);
  }
  if (!data?.storage_path) return ok(null);

  const download = await client.storage.from(TEMPLATE_BUCKET).download(data.storage_path);
  if (download.error || !download.data) {
    const mapped = toDataError(download.error, "getActiveTemplateBytes");
    return fail(
      mapped.code,
      `The active template (${data.version}) could not be read from storage, so nothing was exported. Re-upload the .docx and make it active again.`,
    );
  }

  return ok({
    bytes: Buffer.from(await download.data.arrayBuffer()),
    fileName: data.file_name,
    version: data.version,
  });
}
