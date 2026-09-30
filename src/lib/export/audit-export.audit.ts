/**
 * INPUT → DATABASE → EXPORT → WORD, checked marker by marker.
 *
 * `scripts/audit-seed.mjs` writes one report whose every field carries a
 * distinct token. This reads that report back through the same mappers the app
 * uses, builds the .docx through the same exporters, unzips it, and asks of
 * every token: is it in the document?
 *
 * The question it answers is the only one worth asking about an export — "can
 * something a user recorded be missing from the file?" — and it answers it with
 * a list rather than an impression. A token that is absent by design is still
 * reported, because a deliberate omission the user does not know about is the
 * same surprise as a bug.
 *
 * Deliberately NOT part of `npm test`: it needs the network and a seeded report.
 * `vitest.config.mts` includes `src/**\/*.test.ts` only.
 *
 *   node --env-file=.env.local scripts/audit-seed.mjs
 *   npx vitest run --include "src/**\/*.audit.ts"
 */

import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import { buildReportDocx, type ExportImage } from "@/lib/export/docx";
import { buildTemplateReportDocx } from "@/lib/export/template-docx";
import { rowToReport } from "@/lib/data/report-mappers";
import type { Report, ReportPhoto, SupplierCertificate } from "@/types/domain";

// ─────────────────────────────────────────────────────────────────────────────
// Environment — vitest does not read .env.local
// ─────────────────────────────────────────────────────────────────────────────

function env(): Record<string, string> {
  return Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim()]),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reading a .docx back
// ─────────────────────────────────────────────────────────────────────────────

const EOCD = 0x06054b50;
const CEN = 0x02014b50;
const LOC = 0x04034b50;

interface ZipEntry {
  method: number;
  compressed: number;
  offset: number;
}

function zipEntries(buffer: Buffer): Map<string, ZipEntry> {
  const min = Math.max(0, buffer.length - (22 + 0xffff));
  let eocd = -1;
  for (let i = buffer.length - 22; i >= min; i -= 1) {
    if (buffer.readUInt32LE(i) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip");

  const count = buffer.readUInt16LE(eocd + 10);
  let p = buffer.readUInt32LE(eocd + 16);
  const out = new Map<string, ZipEntry>();

  for (let i = 0; i < count; i += 1) {
    if (buffer.readUInt32LE(p) !== CEN) throw new Error("bad central directory");
    const method = buffer.readUInt16LE(p + 10);
    const compressed = buffer.readUInt32LE(p + 20);
    const nameLength = buffer.readUInt16LE(p + 28);
    const extraLength = buffer.readUInt16LE(p + 30);
    const commentLength = buffer.readUInt16LE(p + 32);
    const offset = buffer.readUInt32LE(p + 42);
    out.set(buffer.toString("utf8", p + 46, p + 46 + nameLength), { method, compressed, offset });
    p += 46 + nameLength + extraLength + commentLength;
  }
  return out;
}

function zipRead(buffer: Buffer, entry: ZipEntry): Buffer {
  if (buffer.readUInt32LE(entry.offset) !== LOC) throw new Error("bad local header");
  const nameLength = buffer.readUInt16LE(entry.offset + 26);
  const extraLength = buffer.readUInt16LE(entry.offset + 28);
  const start = entry.offset + 30 + nameLength + extraLength;
  const raw = buffer.subarray(start, start + entry.compressed);
  return entry.method === 0 ? raw : inflateRawSync(raw);
}

/**
 * Every run of text in the document, joined.
 *
 * Word splits a sentence across `<w:t>` runs whenever formatting changes, so a
 * marker can straddle two of them. Joining without a separator is what makes a
 * search for the whole marker meaningful.
 */
function documentText(docx: Buffer): string {
  const entries = zipEntries(docx);
  let text = "";
  for (const [name, entry] of entries) {
    if (!/^word\/(document|header\d*|footer\d*)\.xml$/.test(name)) continue;
    const xml = zipRead(docx, entry).toString("utf8");
    for (const match of xml.matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g)) {
      text += match[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    }
  }
  return text;
}

function imageCount(docx: Buffer): number {
  return [...zipEntries(docx).keys()].filter((name) => /^word\/media\//.test(name)).length;
}

// ─────────────────────────────────────────────────────────────────────────────
// The seeded report, read back the way the app reads it
// ─────────────────────────────────────────────────────────────────────────────

const DOCUMENT_NUMBER = "GSO-2612901x00";

let report: Report;
let photos: ReportPhoto[];
let images: Map<string, ExportImage>;
let certificates: SupplierCertificate[];
let builtIn: Buffer;
let templated: Buffer | null = null;

beforeAll(async () => {
  const config = env();
  const db = createClient(config.NEXT_PUBLIC_SUPABASE_URL, config.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false },
  });

  const { data: row } = await db
    .from("reports")
    .select("*, suppliers(short_name), employee:profiles!reports_employee_id_fkey(full_name)")
    .eq("document_number", DOCUMENT_NUMBER)
    .single();
  if (!row) throw new Error(`seed first: node --env-file=.env.local scripts/audit-seed.mjs`);

  const id = row.id as string;
  const child = async (table: string) =>
    (await db.from(table).select("*").eq("report_id", id).order("sort_order")).data ?? [];

  const sections = (await db.from("report_sections").select("*").eq("report_id", id)).data ?? [];
  const imageRows = await child("report_images");

  photos = imageRows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    src: "",
    caption: r.caption as string,
    aiCaption: r.ai_caption as string,
    captionSource: r.caption_source as ReportPhoto["captionSource"],
    confidence: Number(r.confidence ?? 0),
    captionState: r.caption_state as ReportPhoto["captionState"],
    uploadState: r.upload_state as ReportPhoto["uploadState"],
    category: r.category as string,
    region: r.region as ReportPhoto["region"],
    sortOrder: r.sort_order as number,
    capturedAt: r.captured_at as string | null,
    width: r.width as number | null,
    height: r.height as number | null,
  }));

  /* eslint-disable @typescript-eslint/no-explicit-any -- the rows come from an
     untyped client and go straight into the mapper the app itself uses. Typing
     them here would mean re-declaring seven row shapes that already exist in
     `@/types/database`, only to assert the same thing. */
  report = rowToReport(row as any, {
    sections: sections as any,
    members: (await child("report_members")) as any,
    observations: (await child("report_observations")) as any,
    targetProducts: (await child("report_target_products")) as any,
    productRows: (await child("report_product_rows")) as any,
    photos,
  });
  /* eslint-enable @typescript-eslint/no-explicit-any */

  images = new Map();
  for (const [index, photo] of photos.entries()) {
    const path = imageRows[index].storage_path as string;
    const file = await db.storage.from("report-images").download(path);
    if (file.error || !file.data) continue;
    images.set(photo.id, {
      data: Buffer.from(await file.data.arrayBuffer()),
      type: path.endsWith(".png") ? "png" : "jpg",
      width: photo.width ?? 0,
      height: photo.height ?? 0,
    });
  }

  // §7's table comes from the supplier, exactly as `export-actions.ts` fetches it.
  const { data: certRows } = await db
    .from("supplier_certificates")
    .select("*")
    .eq("supplier_id", row.supplier_id as string)
    .order("sort_order");
  certificates = (certRows ?? []).map((c: Record<string, unknown>) => ({
    id: c.id as string,
    name: c.name as string,
    number: (c.number as string) ?? "",
    issueDate: ((c.issue_date as string) ?? "").slice(0, 7),
    expirationDate: ((c.expiration_date as string) ?? "").slice(0, 7),
    status: c.status as SupplierCertificate["status"],
    fileName: (c.file_name as string) ?? null,
    storagePath: (c.storage_path as string) ?? null,
    notes: (c.notes as string) ?? null,
    sortOrder: c.sort_order as number,
  }));

  builtIn = await buildReportDocx({ report, photos, images, certificates });

  const { data: template } = await db
    .from("report_templates")
    .select("storage_path")
    .eq("is_active", true)
    .maybeSingle();
  if (template?.storage_path) {
    const file = await db.storage.from("report-templates").download(template.storage_path);
    if (file.data) {
      templated = buildTemplateReportDocx({
        report,
        photos,
        images,
        certificates,
        template: Buffer.from(await file.data.arrayBuffer()),
      });
    }
  }
}, 120_000);

/** Every marker the seed writes, by the field it belongs to. */
const EXPECTED: ReadonlyArray<readonly [string, string]> = [
  ["§1 Purpose", "ZZPURPOSE"],
  ["§3 Company Overview", "ZZOVERVIEW"],
  ["§4 Main Products (text)", "ZZMAINPRODUCTS"],
  ["§4 Main Products (table type)", "ZZPRTYPE1"],
  ["§4 Main Products (table standard)", "ZZPRSTD1"],
  ["§4 Main Products (table voltage)", "ZZPRVOLT1"],
  ["§4 Main Products (table description)", "ZZPRDESC1"],
  ["§5 Target Products (notes)", "ZZTARGETNOTES"],
  ["§5 Target Products (name)", "ZZTPNAME1"],
  ["§5 Target Products (model)", "ZZTPMODEL1"],
  ["§5 Target Products (application)", "ZZTPAPP1"],
  ["§5 Target Products (market)", "ZZTPMARKET1"],
  ["§5 Target Products (requirements)", "ZZTPREQ1"],
  ["§5 Target Products (comments)", "ZZTPCOMMENT1"],
  ["§6 Observation 1", "ZZOBS1"],
  ["§6 Observation 2", "ZZOBS2"],
  ["§6 Observation 3", "ZZOBS3"],
  ["§6 Key point 1", "ZZQA1"],
  ["§6 Key point 2", "ZZQA2"],
  ["§6 Key point 3", "ZZQA3"],
  ["§7 Certificate note", "ZZCERTNOTE"],
  ["§7 Certificate name", "ZZCERTNAME1"],
  ["§7 Certificate number", "ZZCERTNO1"],
  ["§8 Partners", "ZZPARTNERS"],
  ["§9 Conclusion", "ZZCONCLUSION"],
  ["§10 Appendix caption 1", "ZZCAP1"],
  ["§10 Appendix caption 2", "ZZCAP2"],
  ["§4.1 Main product photo caption", "ZZCAP3"],
  ["§8.1 Partner photo caption", "ZZCAP4"],
  ["Header: location", "ZZLOCATION"],
  ["Header: project", "ZZPROJECT"],
  ["Header: business unit", "ZZBUSINESSUNIT"],
  ["Header: product category", "ZZPRODUCTCATEGORY"],
  ["Header: member 1", "ZZMEMBER1"],
  ["Header: member 2", "ZZMEMBER2"],
];

/**
 * Deliberately not in the document, with the rule that decides it.
 *
 * Asserted absent rather than left unmentioned: a field nobody expects in the
 * file is fine, a field somebody expects and does not get is a bug, and the
 * only difference between the two is whether it is written down.
 */
const BY_DESIGN_ABSENT: ReadonlyArray<readonly [string, string, string]> = [
  [
    "Transcript text",
    "ZZTRANSCRIPT",
    "A transcript is a SOURCE, not report content. It is stored in report_files " +
      "with kind='transcript' (transcript-actions.ts) and can run to 400,000 " +
      "characters (MAX_TRANSCRIPT_CHARS); what reaches the report is whatever the " +
      "author accepted from it into §6 as an observation. Pasting the raw " +
      "conversation into the document is not what §6 is for.",
  ],
];

describe("what the user recorded, against what the document contains", () => {
  it("states what is deliberately left out, and checks it really is", () => {
    const text = documentText(builtIn);
    console.log("");
    console.log("── deliberately not exported ─────────────────");
    for (const [label, marker, rule] of BY_DESIGN_ABSENT) {
      console.log(`${text.includes(marker) ? "PRESENT" : "ABSENT "}  ${label} — ${rule}`);
      expect(text).not.toContain(marker);
    }
  });

  it("built the document from the seeded report", () => {
    expect(report.documentNumber).toBe(DOCUMENT_NUMBER);
    expect(photos.length).toBe(4);
    expect(builtIn.length).toBeGreaterThan(5_000);
  });

  it("reports every field, present or absent", () => {
    const text = documentText(builtIn);
    const missing = EXPECTED.filter(([, marker]) => !text.includes(marker));

    // Printed rather than only asserted: the list IS the audit result.
    console.log("\n── built-in layout ─────────────────────────────");
    for (const [label, marker] of EXPECTED) {
      console.log(`${text.includes(marker) ? "PRESENT" : "MISSING"}  ${label}  (${marker})`);
    }
    console.log(`images embedded: ${imageCount(builtIn)} of ${photos.length}`);
    console.log(`missing: ${missing.length} of ${EXPECTED.length}`);

    expect(missing.map(([label]) => label)).toEqual([]);
  });

  it("reports the same for the corporate template", () => {
    if (!templated) {
      console.log("\n── corporate template ── no active template, skipped");
      return;
    }
    const text = documentText(templated);
    const missing = EXPECTED.filter(([, marker]) => !text.includes(marker));

    console.log("\n── corporate template ──────────────────────────");
    for (const [label, marker] of EXPECTED) {
      console.log(`${text.includes(marker) ? "PRESENT" : "MISSING"}  ${label}  (${marker})`);
    }
    console.log(`images embedded: ${imageCount(templated)} of ${photos.length}`);
    console.log(`missing: ${missing.length} of ${EXPECTED.length}`);

    expect(missing.map(([label]) => label)).toEqual([]);
  });

  it("puts every photograph in the file", () => {
    expect(imageCount(builtIn)).toBeGreaterThanOrEqual(photos.length);
  });

  it("leaves no placeholder, id or undefined in the text", () => {
    const text = documentText(builtIn);
    for (const smell of ["undefined", "[object Object]", "NaN", "Lorem ipsum", "TBD", "{{"]) {
      expect(text).not.toContain(smell);
    }
    // A uuid in the body means an id escaped where a name belonged.
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
  });
});
