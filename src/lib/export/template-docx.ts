/**
 * DOCX generation on top of the corporate template — README §16, §19..§24.
 *
 * `docx.ts` owns a layout of its own invention. This module does not: it takes
 * the uploaded `EBARA_ODM_Visit_Report_v1.5.docx`, keeps every part of that
 * package except `word/document.xml`, and writes a new body into the shell that
 * is left. The EBARA letterhead, the bordered footer table, `styles.xml` with
 * the "Ttulo" and "PargrafodaLista" styles the headings use, the numbering that
 * puts "1." in front of Purpose, the theme, the fonts and the page geometry all
 * survive because they are not touched — they are the template's own bytes,
 * copied through.
 *
 * The template carries no `{{PLACEHOLDER}}` anywhere, so there is no string to
 * replace; it is a filled example report. That is why this is a shell clone and
 * not a mail merge, and why the body below is generated rather than patched.
 *
 * Two consequences worth knowing before reading on:
 *
 *  - The example's own photographs and signature are relationships of the OLD
 *    `word/document.xml`. Dropping that part orphans them, and this module then
 *    removes the orphaned image parts as well: another supplier's factory
 *    photographs have no business riding along inside every report EBARA sends,
 *    and it takes the package from 1.6 MB to roughly half that.
 *  - `word/footer2.xml` is copied byte for byte, and its PREPARED BY and DATE
 *    cells are literal text in the template rather than fields. Every report
 *    exported from this template therefore shows the preparer and date that were
 *    typed into it. Fixing that means editing the footer, which would stop being
 *    "the letterhead survived"; it is called out in the export result instead.
 *
 * Server-only: `node:zlib`, Buffers, and image bytes read from Supabase Storage.
 */

import { deflateRawSync, inflateRawSync } from "node:zlib";

import { printableCaption, visitHours, type ExportImage } from "@/lib/export/docx";
import { photoBoxPt, planAppendix } from "@/lib/reports/appendix-layout";
import {
  IMAGE_REGION_GEOMETRY,
  type ImageRegion,
  type Report,
  type ReportPhoto,
  type SupplierCertificate,
} from "@/types/domain";

/**
 * Raised when the uploaded file cannot be used as a shell — not a bug, a fact
 * about the upload. `export-actions.ts` catches it and falls back to the
 * built-in generator rather than failing the user's export.
 */
export class TemplateShellError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateShellError";
  }
}

export interface TemplateReportInput {
  report: Report;
  photos: readonly ReportPhoto[];
  /** Photo id → bytes. A photo with no entry is skipped rather than breaking. */
  images: Map<string, ExportImage>;
  /** The corporate `.docx` exactly as it was uploaded. */
  template: Uint8Array;
  /** The supplier's certificates, printed as §7's table. */
  certificates?: readonly SupplierCertificate[];
}

// ─────────────────────────────────────────────────────────────────────────────
// ZIP
//
// A `.docx` is an ordinary ZIP, and both halves of the job here are small
// enough to do with `node:zlib` alone: read the central directory, inflate the
// parts, write the parts back out. That keeps a 4 GB-disk project free of a
// dependency whose only use would be these ninety lines.
//
// Only the two compression methods Word actually emits are supported — stored
// and deflate. Anything else, and anything ZIP64 or encrypted, is reported as an
// unusable template so the caller can fall back, because guessing at an archive
// this application did not create would be worse than saying so.
// ─────────────────────────────────────────────────────────────────────────────

const LOCAL_HEADER_SIG = 0x04034b50;
const CENTRAL_HEADER_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;

/** Payloads that are already compressed; deflating them again only costs time. */
const STORED_EXTENSIONS = new Set(["jpeg", "jpg", "png", "gif", "bmp", "webp"]);

/**
 * 1980-01-01, the earliest a ZIP can express, for every entry.
 *
 * Exporting the same report twice then produces the same bytes, which is what
 * lets the tests compare a generated package against the template part by part.
 */
const DOS_DATE = 33;
const DOS_TIME = 0;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) === 1 ? (0xedb88320 ^ (c >>> 1)) >>> 0 : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    c = (CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)) >>> 0;
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** Every part of the package, keyed by its path, uncompressed. */
function readZipParts(bytes: Uint8Array): Map<string, Buffer> {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (buffer.length < 22) throw new TemplateShellError("The file is too small to be a .docx.");

  // The end-of-central-directory record is last, after a comment of up to 64 KB.
  let eocd = -1;
  const earliest = Math.max(0, buffer.length - 22 - 0xffff);
  for (let i = buffer.length - 22; i >= earliest; i -= 1) {
    if (buffer.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new TemplateShellError("The file is not a ZIP archive, so not a .docx.");

  const entryCount = buffer.readUInt16LE(eocd + 10);
  const directoryOffset = buffer.readUInt32LE(eocd + 16);
  if (entryCount === 0xffff || directoryOffset === 0xffffffff) {
    throw new TemplateShellError("ZIP64 templates are not supported.");
  }

  const parts = new Map<string, Buffer>();
  let cursor = directoryOffset;

  for (let i = 0; i < entryCount; i += 1) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== CENTRAL_HEADER_SIG) {
      throw new TemplateShellError("The template's ZIP directory is damaged.");
    }

    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");

    if ((flags & 0x0001) !== 0) {
      throw new TemplateShellError("The template is password-protected.");
    }

    // The local header repeats the name and may carry different extra bytes, so
    // the payload's start is computed from it rather than from the directory.
    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== LOCAL_HEADER_SIG) {
      throw new TemplateShellError(`The template entry "${name}" is damaged.`);
    }
    const dataStart =
      localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
    const raw = buffer.subarray(dataStart, dataStart + compressedSize);

    if (method === 0) {
      parts.set(name, Buffer.from(raw));
    } else if (method === 8) {
      try {
        parts.set(name, inflateRawSync(raw));
      } catch {
        throw new TemplateShellError(`The template entry "${name}" could not be decompressed.`);
      }
    } else {
      throw new TemplateShellError(`The template uses an unsupported compression method (${method}).`);
    }

    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return parts;
}

function writeZipParts(parts: ReadonlyMap<string, Buffer>): Buffer {
  const locals: Buffer[] = [];
  const directory: Buffer[] = [];
  let offset = 0;
  let count = 0;

  for (const [path, data] of parts) {
    const name = Buffer.from(path, "utf8");
    // Bit 11 tells the reader the name is UTF-8; only needed when it is not ASCII.
    const flags = name.length === path.length ? 0 : 0x0800;
    const extension = path.split(".").pop()?.toLowerCase() ?? "";
    const stored = STORED_EXTENSIONS.has(extension);
    const payload = stored ? data : deflateRawSync(data, { level: 9 });
    const method = stored ? 0 : 8;
    const crc = crc32(data);

    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(LOCAL_HEADER_SIG, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(CENTRAL_HEADER_SIG, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);

    locals.push(local, payload);
    directory.push(central);
    offset += local.length + payload.length;
    count += 1;
  }

  const directoryBuffer = Buffer.concat(directory);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(EOCD_SIG, 0);
  eocd.writeUInt16LE(count, 8);
  eocd.writeUInt16LE(count, 10);
  eocd.writeUInt32LE(directoryBuffer.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, directoryBuffer, eocd]);
}

// ─────────────────────────────────────────────────────────────────────────────
// XML
// ─────────────────────────────────────────────────────────────────────────────

const NAMESPACES = [
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"',
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"',
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
  'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"',
].join(" ");

const RELATIONSHIPS_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const IMAGE_REL_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";

/**
 * XML-escape, and drop the control characters XML 1.0 has no way to carry.
 *
 * Report prose comes from a database, and a stray 0x0B pasted out of Excel would
 * otherwise produce a file Word refuses to open with no clue as to why.
 */
function xml(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// The run properties measured in the template, reproduced verbatim. Nothing here
// is a preference; each one was read out of the corresponding run in the
// original `word/document.xml`.

/** The title line and the Employee/Period line: Calibri bold at the Normal 12pt. */
const RPR_TITLE = '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:bCs/>';

/** Sections 1..6: Arial 14pt. The bold comes from the "Ttulo" style, as in the original. */
const RPR_HEADING =
  '<w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/>' +
  '<w:color w:val="212121"/><w:spacing w:val="-2"/><w:sz w:val="28"/><w:szCs w:val="28"/>';

/** Sections 7..9, which carry their bold on the run instead of the style. */
const RPR_HEADING_BOLD =
  '<w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/>' +
  '<w:color w:val="212121"/><w:spacing w:val="-2"/><w:sz w:val="28"/><w:szCs w:val="28"/>';

/** Body prose: Arial 10pt. */
const RPR_BODY =
  '<w:rFonts w:ascii="Arial" w:eastAsia="Arial MT" w:hAnsi="Arial" w:cs="Arial"/>' +
  '<w:color w:val="212121"/><w:sz w:val="20"/><w:szCs w:val="20"/>';

/** Table text, a half-point down from the prose so the columns stay readable. */
const RPR_TABLE =
  '<w:rFonts w:ascii="Arial" w:eastAsia="Arial MT" w:hAnsi="Arial" w:cs="Arial"/>' +
  '<w:color w:val="212121"/><w:sz w:val="19"/><w:szCs w:val="19"/>';

const RPR_TABLE_HEADER =
  '<w:rFonts w:ascii="Arial" w:eastAsia="Arial MT" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/>' +
  '<w:color w:val="212121"/><w:sz w:val="19"/><w:szCs w:val="19"/>';

/** The name under the signature: Arial bold at the Normal 12pt. */
const RPR_SIGNATURE_NAME =
  '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:color w:val="212121"/>';

/** The two department lines under it: Arial 11pt. */
const RPR_SIGNATURE_OFFICE =
  '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:bCs/><w:color w:val="212121"/>' +
  '<w:spacing w:val="-4"/><w:sz w:val="22"/><w:szCs w:val="22"/>';

/** "Appendix 1 - Pictures": Arial 10.5pt bold. */
const RPR_APPENDIX_HEADING =
  '<w:rFonts w:ascii="Arial" w:eastAsia="Arial MT" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/>' +
  '<w:color w:val="212121"/><w:sz w:val="21"/><w:szCs w:val="21"/>';

/** Photo captions: Arial 10pt bold, centred. */
const RPR_CAPTION =
  '<w:rFonts w:ascii="Arial" w:eastAsia="Arial MT" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/>' +
  '<w:color w:val="212121"/><w:sz w:val="20"/><w:szCs w:val="20"/>';

function run(text: string, rPr: string): string {
  return `<w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;
}

function tabRun(rPr: string): string {
  return `<w:r><w:rPr>${rPr}</w:rPr><w:tab/></w:r>`;
}

function paragraph(pPr: string, children: string): string {
  return `<w:p>${pPr}${children}</w:p>`;
}

function pageBreak(): string {
  return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
}

/** An empty paragraph, which is how the template spaces its sections apart. */
function spacer(): string {
  return `<w:p><w:pPr><w:rPr>${RPR_BODY}</w:rPr></w:pPr></w:p>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reading the shell
// ─────────────────────────────────────────────────────────────────────────────

interface Shell {
  /** The template's own body-level `w:sectPr`, copied verbatim. */
  sectPr: string;
  /** Page width less its margins, in twips — the text column. */
  contentWidthTwips: number;
  /**
   * The `w:numId` the template's own section headings use, so the generated
   * headings are numbered "1." .. "9." by Word exactly as the original's are.
   * Null when the template has no such list, in which case the headings are
   * emitted unnumbered rather than pointing at a list that does not exist.
   */
  headingNumId: string | null;
}

/** A4 less 2 cm margins — only used when the template has no readable sectPr. */
const FALLBACK_CONTENT_WIDTH_TWIPS = 9639;

function attr(tag: string, name: string): number | null {
  const match = new RegExp(`${name}="(-?\\d+)"`).exec(tag);
  return match ? Number(match[1]) : null;
}

function readShell(documentXml: string, numberingXml: string | null): Shell {
  // The body-level sectPr is the last one in the part; any earlier match belongs
  // to a paragraph that ends a section.
  const sections = documentXml.match(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/g);
  const sectPr = sections?.at(-1) ?? null;
  if (!sectPr) {
    throw new TemplateShellError(
      "The template has no section properties, so its page size and letterhead references cannot be reused.",
    );
  }

  const pgSz = /<w:pgSz\b[^>]*\/>/.exec(sectPr)?.[0] ?? "";
  const pgMar = /<w:pgMar\b[^>]*\/>/.exec(sectPr)?.[0] ?? "";
  const width = attr(pgSz, "w:w");
  const left = attr(pgMar, "w:left");
  const right = attr(pgMar, "w:right");

  const measured = width !== null && left !== null && right !== null ? width - left - right : 0;
  // A text column narrower than 5 cm is a misread, not a page.
  const contentWidthTwips = measured > 2835 ? measured : FALLBACK_CONTENT_WIDTH_TWIPS;

  return {
    sectPr,
    contentWidthTwips,
    headingNumId: readHeadingNumId(documentXml, numberingXml),
  };
}

/**
 * Find the numbered list the template's "Ttulo" headings belong to.
 *
 * Reading it out of the template rather than hard-coding "3" means a revised
 * template that renumbered its lists still produces numbered headings, and a
 * template without them produces headings with no numbers instead of a document
 * Word has to repair.
 */
function readHeadingNumId(documentXml: string, numberingXml: string | null): string | null {
  if (!numberingXml) return null;

  for (const match of documentXml.matchAll(/<w:pPr>[\s\S]*?<\/w:pPr>/g)) {
    const pPr = match[0];
    if (!pPr.includes('<w:pStyle w:val="Ttulo"/>')) continue;
    const numId = /<w:numId w:val="(\d+)"\/>/.exec(pPr)?.[1];
    if (!numId) continue;
    // A numPr that points at a list `numbering.xml` does not define is ignored by
    // Word, which would silently drop the numbers — so it has to be there.
    if (numberingXml.includes(`w:numId="${numId}"`)) return numId;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Images
// ─────────────────────────────────────────────────────────────────────────────

const EXTENSIONS: Record<ExportImage["type"], { extension: string; contentType: string }> = {
  png: { extension: "png", contentType: "image/png" },
  // Named .jpeg, not .jpg, because that is the extension the template already
  // declares in [Content_Types].xml — one fewer edit to a part we would rather
  // leave alone.
  jpg: { extension: "jpeg", contentType: "image/jpeg" },
  gif: { extension: "gif", contentType: "image/gif" },
  bmp: { extension: "bmp", contentType: "image/bmp" },
};

interface PlacedImage {
  relId: string;
  widthEmu: number;
  heightEmu: number;
  docPrId: number;
}

interface MediaRegistry {
  /** Adds the bytes as a new part and returns what the drawing needs. */
  place(image: ExportImage, widthPt: number, heightPt: number): PlacedImage;
  parts: Map<string, Buffer>;
  relationships: string[];
  contentTypeExtensions: Map<string, string>;
}

/** Points → English Metric Units, the unit `wp:extent` is measured in. */
function ptToEmu(points: number): number {
  return Math.round(points * 12700);
}

/**
 * `taken` is the set of paths the template already occupies. A template that was
 * itself exported from this application and then re-uploaded would otherwise have
 * its own `word/media/report-image-1.png` silently overwritten by this report's.
 */
function createMediaRegistry(firstRelNumber: number, taken: ReadonlySet<string>): MediaRegistry {
  const parts = new Map<string, Buffer>();
  const relationships: string[] = [];
  const contentTypeExtensions = new Map<string, string>();
  let index = 0;

  return {
    parts,
    relationships,
    contentTypeExtensions,
    place(image, widthPt, heightPt) {
      index += 1;
      const { extension, contentType } = EXTENSIONS[image.type];

      let fileName = `report-image-${index}.${extension}`;
      for (let attempt = 2; taken.has(`word/media/${fileName}`); attempt += 1) {
        fileName = `report-image-${index}-${attempt}.${extension}`;
      }

      const relId = `rId${firstRelNumber + index - 1}`;

      parts.set(`word/media/${fileName}`, Buffer.from(image.data));
      relationships.push(
        `<Relationship Id="${relId}" Type="${IMAGE_REL_TYPE}" Target="media/${fileName}"/>`,
      );
      contentTypeExtensions.set(extension, contentType);

      return {
        relId,
        widthEmu: ptToEmu(widthPt),
        heightEmu: ptToEmu(heightPt),
        // Word wants every drawing's id unique and non-zero within the document.
        docPrId: index,
      };
    },
  };
}

function drawing(placed: PlacedImage, rPr: string): string {
  const name = `Picture ${placed.docPrId}`;
  return (
    `<w:r><w:rPr>${rPr}</w:rPr><w:drawing>` +
    '<wp:inline distT="0" distB="0" distL="0" distR="0">' +
    `<wp:extent cx="${placed.widthEmu}" cy="${placed.heightEmu}"/>` +
    '<wp:effectExtent l="0" t="0" r="0" b="0"/>' +
    `<wp:docPr id="${placed.docPrId}" name="${name}"/>` +
    '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
    '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    `<pic:pic><pic:nvPicPr><pic:cNvPr id="${placed.docPrId}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${placed.relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${placed.widthEmu}" cy="${placed.heightEmu}"/></a:xfrm>` +
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
    "</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// The body
// ─────────────────────────────────────────────────────────────────────────────

/** The template indents body text to 541 twips, where the numbered headings start. */
const BODY_PPR =
  '<w:pPr><w:tabs><w:tab w:val="left" w:pos="851"/></w:tabs>' +
  '<w:spacing w:before="4" w:line="252" w:lineRule="exact"/>' +
  `<w:ind w:left="541" w:right="519"/><w:rPr>${RPR_BODY}</w:rPr></w:pPr>`;

function headingPPr(shell: Shell, bold: boolean): string {
  const numPr = shell.headingNumId
    ? `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${shell.headingNumId}"/></w:numPr>`
    : "";

  // Sections 1..6 are Title-styled and take their bold from the style; 7..9 are
  // List Paragraph and carry it on the run. Both are the template's own choice.
  if (!bold) {
    return (
      '<w:pPr><w:pStyle w:val="Ttulo"/>' +
      numPr +
      `<w:spacing w:before="240"/><w:jc w:val="left"/><w:rPr>${RPR_HEADING}</w:rPr></w:pPr>`
    );
  }

  return (
    '<w:pPr><w:pStyle w:val="PargrafodaLista"/><w:widowControl w:val="0"/>' +
    numPr +
    '<w:tabs><w:tab w:val="left" w:pos="851"/></w:tabs>' +
    '<w:autoSpaceDE w:val="0"/><w:autoSpaceDN w:val="0"/>' +
    '<w:spacing w:before="4" w:line="252" w:lineRule="exact"/>' +
    '<w:ind w:left="425" w:right="519" w:hanging="425"/>' +
    `<w:rPr>${RPR_HEADING_BOLD}</w:rPr></w:pPr>`
  );
}

function heading(text: string, shell: Shell, bold: boolean): string {
  return paragraph(headingPPr(shell, bold), run(text, bold ? RPR_HEADING_BOLD : RPR_HEADING));
}

/**
 * Body prose, blank-line separated into paragraphs.
 *
 * An empty section still prints an em dash. The corporate report has a fixed
 * shape, and a heading with nothing under it reads as an unanswered question
 * rather than as a section that does not apply.
 */
function body(text: string): string {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return paragraph(BODY_PPR, run("—", RPR_BODY));

  return trimmed
    .split(/\n{2,}/)
    .map((block) => paragraph(BODY_PPR, run(block.replace(/\s*\n\s*/g, " ").trim(), RPR_BODY)))
    .join("");
}

/** One bulleted line. */
function bullet(text: string): string {
  const pPr =
    '<w:pPr><w:tabs><w:tab w:val="left" w:pos="851"/></w:tabs>' +
    '<w:spacing w:before="4" w:line="252" w:lineRule="exact"/>' +
    `<w:ind w:left="826" w:right="519" w:hanging="285"/><w:rPr>${RPR_BODY}</w:rPr></w:pPr>`;
  // A literal bullet rather than a w:numPr: the template's numbering part defines
  // six lists and none of them is documented as the bullet list, so pointing at
  // one by index would be a guess that shows up as the wrong glyph.
  return paragraph(pPr, run(`•  ${text}`, RPR_BODY));
}

// ── Tables ───────────────────────────────────────────────────────────────────

const CELL_BORDER = (position: string) =>
  `<w:${position} w:val="single" w:sz="4" w:space="0" w:color="A6A6A6"/>`;

const TABLE_BORDERS =
  "<w:tblBorders>" +
  ["top", "left", "bottom", "right", "insideH", "insideV"].map(CELL_BORDER).join("") +
  "</w:tblBorders>";

function tableCell(text: string, widthTwips: number, header: boolean): string {
  const shading = header ? '<w:shd w:val="clear" w:color="auto" w:fill="EFEFEF"/>' : "";
  const rPr = header ? RPR_TABLE_HEADER : RPR_TABLE;
  const pPr = `<w:pPr><w:spacing w:line="240" w:lineRule="auto"/><w:rPr>${rPr}</w:rPr></w:pPr>`;

  return (
    `<w:tc><w:tcPr><w:tcW w:w="${widthTwips}" w:type="dxa"/>${shading}` +
    '<w:vAlign w:val="center"/></w:tcPr>' +
    paragraph(pPr, run(text.trim() || "—", rPr)) +
    "</w:tc>"
  );
}

/**
 * A bordered grid for the §4 product rows, the §5 target products and the §2
 * company snapshot. The template has no table for these — its only table is the
 * borderless appendix grid — so this is the one place the layout is this
 * module's own, kept deliberately plain.
 */
function dataTable(
  widths: readonly number[],
  rows: ReadonlyArray<readonly string[]>,
  options: { headerRow: boolean },
): string {
  const total = widths.reduce((sum, width) => sum + width, 0);
  const grid = widths.map((width) => `<w:gridCol w:w="${width}"/>`).join("");

  // `w:cantSplit` before `w:tblHeader`, and `w:tblBorders` before `w:tblLayout`:
  // Word validates pPr/tblPr/trPr child order against the schema sequence and
  // repairs — or refuses — a file that gets it wrong.
  const markup = rows
    .map((cells, index) => {
      const header = options.headerRow && index === 0;
      const trPr = header ? "<w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>" : "<w:trPr><w:cantSplit/></w:trPr>";
      const cellsMarkup = cells
        .map((cell, column) => tableCell(cell, widths[column] ?? 0, header))
        .join("");
      return `<w:tr>${trPr}${cellsMarkup}</w:tr>`;
    })
    .join("");

  return (
    `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/>${TABLE_BORDERS}<w:tblLayout w:type="fixed"/>` +
    '<w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="80" w:type="dxa"/>' +
    '<w:bottom w:w="40" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar>' +
    '<w:tblLook w:val="0000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="0" w:noVBand="0"/>' +
    `</w:tblPr><w:tblGrid>${grid}</w:tblGrid>${markup}</w:tbl>`
  );
}

/** Column widths from percentages of the text column, so nothing overflows. */
function columnWidths(shell: Shell, percentages: readonly number[]): number[] {
  const widths = percentages.map((share) => Math.floor((shell.contentWidthTwips * share) / 100));
  // Rounding loss goes to the last column, so the row is exactly the text width.
  const drift = shell.contentWidthTwips - widths.reduce((sum, width) => sum + width, 0);
  widths[widths.length - 1] += drift;
  return widths;
}

// ── Photo grids ──────────────────────────────────────────────────────────────

/** `w:tblCellMar` in the template's appendix grid, a side. */
const CELL_PADDING_TWIPS = 60;

function photoCell(content: string, widthTwips: number): string {
  return `<w:tc><w:tcPr><w:tcW w:w="${widthTwips}" w:type="dxa"/></w:tcPr>${content}</w:tc>`;
}

function captionOf(photo: ReportPhoto): string {
  // One rule for both exporters — see `printableCaption` in docx.ts.
  return printableCaption(photo);
}

/**
 * The template's appendix grid: a borderless, fixed-layout, two-column table
 * whose rows alternate photographs and captions.
 *
 * `rows` is a plan page's worth, so the caller controls where the page breaks
 * fall — Word is never asked to split a photograph from its caption.
 */
function photoGrid(
  rows: ReadonlyArray<readonly ReportPhoto[]>,
  images: Map<string, ExportImage>,
  media: MediaRegistry,
  shell: Shell,
  options: { captions: boolean },
): string {
  const columnCount = 2;
  const cellWidth = Math.floor(shell.contentWidthTwips / columnCount);
  // The template's appendix cells are padded 60 twips each side; a photograph has
  // the rest, which is what the box has to fit inside.
  const columnWidthMm = ((cellWidth - CELL_PADDING_TWIPS * 2) / 1440) * 25.4;
  const grid = Array.from({ length: columnCount }, () => `<w:gridCol w:w="${cellWidth}"/>`).join("");
  const centred = (rPr: string) => `<w:pPr><w:jc w:val="center"/><w:rPr>${rPr}</w:rPr></w:pPr>`;

  const markup = rows
    .map((photos) => {
      const photoCells = photos
        .map((photo) => {
          const image = images.get(photo.id);
          if (!image) return photoCell(paragraph(centred(RPR_CAPTION), ""), cellWidth);
          const box = photoBoxPt(image.width, image.height, columnWidthMm);
          const placed = media.place(image, box.width, box.height);
          return photoCell(
            paragraph(centred(RPR_CAPTION), drawing(placed, RPR_CAPTION)),
            cellWidth,
          );
        })
        .join("");

      // A trailing odd photograph keeps its own column rather than stretching.
      const filler =
        photos.length < columnCount
          ? photoCell(paragraph(centred(RPR_CAPTION), ""), cellWidth).repeat(columnCount - photos.length)
          : "";

      const photoRow = `<w:tr><w:trPr><w:cantSplit/></w:trPr>${photoCells}${filler}</w:tr>`;
      if (!options.captions) return photoRow;

      const captionCells = photos
        .map((photo) => photoCell(paragraph(centred(RPR_CAPTION), run(captionOf(photo), RPR_CAPTION)), cellWidth))
        .join("");
      const captionFiller =
        photos.length < columnCount
          ? photoCell(paragraph(centred(RPR_CAPTION), ""), cellWidth).repeat(columnCount - photos.length)
          : "";

      return `${photoRow}<w:tr><w:trPr><w:cantSplit/></w:trPr>${captionCells}${captionFiller}</w:tr>`;
    })
    .join("");

  return (
    `<w:tbl><w:tblPr><w:tblW w:w="${cellWidth * columnCount}" w:type="dxa"/><w:tblLayout w:type="fixed"/>` +
    `<w:tblCellMar><w:left w:w="${CELL_PADDING_TWIPS}" w:type="dxa"/>` +
    `<w:right w:w="${CELL_PADDING_TWIPS}" w:type="dxa"/></w:tblCellMar>` +
    '<w:tblLook w:val="0000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="0" w:noVBand="0"/>' +
    `</w:tblPr><w:tblGrid>${grid}</w:tblGrid>${markup}</w:tbl>`
  );
}

function photosIn(photos: readonly ReportPhoto[], region: ImageRegion): ReportPhoto[] {
  return [...photos].filter((photo) => photo.region === region).sort((a, b) => a.sortOrder - b.sortOrder);
}

/** The in-flow photographs of §4.1 and §8.1, two-up, in one uninterrupted table. */
function inlinePhotos(
  photos: readonly ReportPhoto[],
  region: ImageRegion,
  images: Map<string, ExportImage>,
  media: MediaRegistry,
  shell: Shell,
): string {
  const withBytes = photosIn(photos, region).filter((photo) => images.has(photo.id));
  if (withBytes.length === 0) return "";

  const rows: ReportPhoto[][] = [];
  for (let index = 0; index < withBytes.length; index += 2) {
    rows.push(withBytes.slice(index, index + 2));
  }

  // README §16 records whether a region prints a caption row; only the appendix
  // does. (Its `targetHeightCm` is not read here: the measured 7 cm box lives in
  // appendix-layout.ts, and the 6.5 in that record predates the real template.)
  // Captions on every region, not only the appendix. §16's geometry record
  // says the other two print none, and that was true of the prototype — but a
  // caption the author typed under a §4.1 photograph then appeared nowhere in
  // the document, while the built-in layout printed it. Two exporters
  // disagreeing about the user's own words is the worse of the two answers.
  return spacer() + photoGrid(rows, images, media, shell, { captions: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// The document
// ─────────────────────────────────────────────────────────────────────────────

function documentBody(input: TemplateReportInput, shell: Shell, media: MediaRegistry): string {
  const { report, photos, images, certificates = [] } = input;
  const snapshot = report.supplierSnapshot;
  const sections = report.sections;

  const titleTabs = `<w:tabs><w:tab w:val="right" w:pos="${shell.contentWidthTwips}"/></w:tabs>`;

  // 1. Title and document number, right-aligned on a tab stop. The original
  //    pushed the number across with a run of spaces; a tab is the same look and
  //    survives a longer document number.
  const title = paragraph(
    `<w:pPr>${titleTabs}<w:rPr>${RPR_TITLE}</w:rPr></w:pPr>`,
    run("GSO SUPPLIER VISIT REPORT – ODM Activities", RPR_TITLE) +
      tabRun(RPR_TITLE) +
      run(`Doc. EC/EBAS – ${report.documentNumber}`, RPR_TITLE),
  );

  // 2. Employee and period. The original also carried the employee's name in
  //    katakana; the application holds one name per person, so only that is
  //    written rather than inventing a reading.
  const employeeLine = paragraph(
    `<w:pPr>${titleTabs}<w:spacing w:line="300" w:lineRule="exact"/><w:contextualSpacing/><w:rPr>${RPR_TITLE}</w:rPr></w:pPr>`,
    run(`Employee: ${report.employee || report.reportOwner}`, RPR_TITLE) +
      tabRun(RPR_TITLE) +
      run(`Period: ${report.period}`, RPR_TITLE),
  );

  // 3. The supplier's legal name, from the report's frozen snapshot — README
  //    §8.3. Never the live supplier row: the report records what was true on the
  //    visit date, and the legal name is exactly the kind of field that changes.
  const supplierName = paragraph(
    '<w:pPr><w:pStyle w:val="Ttulo"/><w:spacing w:before="240"/><w:ind w:left="101"/>' +
      '<w:rPr><w:spacing w:val="-2"/></w:rPr></w:pPr>',
    run(snapshot.legalName || snapshot.shortName, '<w:spacing w:val="-2"/>'),
  );

  const snapshotRows: ReadonlyArray<readonly string[]> = [
    ["President", snapshot.presidentName ?? ""],
    ["Established", snapshot.establishedYear ?? ""],
    ["Capital", snapshot.companyCapital ?? ""],
    ["Employees", snapshot.employees ?? ""],
    ["Factory size (m²)", snapshot.factorySizeM2 ?? ""],
    ["Production capacity", snapshot.productionCapacity ?? ""],
    ["Certifications", snapshot.certifications ?? ""],
    [
      "Address",
      [snapshot.address, snapshot.city, snapshot.region, snapshot.country].filter(Boolean).join(", "),
    ],
    ["Telephone", snapshot.tel ?? ""],
    ["Website", snapshot.websiteUrl ?? ""],
    ["EBARA track record", snapshot.trackRecordEbara ?? ""],
  ];

  const productRows = sections.productRows.length
    ? dataTable(
        columnWidths(shell, [22, 22, 16, 40]),
        [
          ["Type", "Standard", "Voltage", "Description"],
          ...sections.productRows.map((row) => [row.type, row.standard, row.voltage, row.description]),
        ],
        { headerRow: true },
      )
    : "";

  const targetRows = sections.targetProducts.length
    ? dataTable(
        columnWidths(shell, [20, 14, 20, 14, 16, 16]),
        [
          ["Product", "Model", "Application", "Market", "Requirements", "Comments"],
          ...sections.targetProducts.map((product) => [
            product.name,
            product.model,
            product.application,
            product.expectedMarket,
            product.technicalRequirements,
            // The audit found this one missing from both exporters.
            product.comments,
          ]),
        ],
        { headerRow: true },
      )
    : "";

  /**
   * What the visit itself was — date, place, who went, and how it is filed.
   *
   * The audit found all of it stored and none of it printed by this exporter:
   * the corporate shell carried the employee and the period and stopped there,
   * so the location somebody typed, the attendees they listed and the
   * project / business unit / category the report is filed under reached no
   * document at all. The built-in layout printed most of them; the one the
   * company actually sends did not.
   */
  const hours = visitHours(report);
  const visitFacts: string[] = [
    `Visit date: ${report.visitDate}`,
    hours ? `Hours: ${hours}` : "",
    report.location ? `Location: ${report.location}` : "",
    report.members.length ? `Members: ${report.members.join(", ")}` : "",
    report.project ? `Project: ${report.project}` : "",
    report.businessUnit ? `Business unit: ${report.businessUnit}` : "",
    report.productCategory ? `Product category: ${report.productCategory}` : "",
  ].filter((line) => line !== "");

  const visitLine = body(visitFacts.join("  ·  "));

  // §7's own table. It used to print the note and nothing else, so every
  // certificate recorded during a visit was missing from the document.
  const listedCertificates = certificates.filter((c) => c.name.trim() !== "");
  const certificateRows = listedCertificates.length
    ? dataTable(
        columnWidths(shell, [34, 24, 14, 14, 14]),
        [
          ["Certificate", "Number", "Issued", "Expires", "Copy"],
          ...listedCertificates.map((c) => [
            c.name,
            c.number,
            c.issueDate,
            c.expirationDate,
            c.fileName ? "Collected" : "Not collected",
          ]),
        ],
        { headerRow: true },
      )
    : "";

  const observations = sections.observations.length
    ? sections.observations
        .map((observation) =>
          bullet(
            `${observation.category}${
              observation.priority !== "Normal" ? ` (${observation.priority})` : ""
            } — ${observation.text}`,
          ),
        )
        .join("")
    : body("");

  const qa =
    sections.qaIncluded && sections.qaBullets.length
      ? sections.qaBullets.map(bullet).join("")
      : "";

  // 13. The signature block. The template's signature IMAGE is deliberately not
  //     reproduced: it is one named person's signature, it belongs to the example
  //     that was uploaded, and pasting it under somebody else's report would be
  //     putting their name to a document they did not sign.
  const signature =
    spacer() +
    paragraph(
      '<w:pPr><w:spacing w:before="48"/><w:jc w:val="center"/>' +
        `<w:rPr>${RPR_SIGNATURE_NAME}</w:rPr></w:pPr>`,
      run(report.reportOwner || report.employee, RPR_SIGNATURE_NAME),
    ) +
    paragraph(
      `<w:pPr><w:jc w:val="center"/><w:rPr>${RPR_SIGNATURE_OFFICE}</w:rPr></w:pPr>`,
      run("Global Sourcing Office", RPR_SIGNATURE_OFFICE) +
        `<w:r><w:rPr>${RPR_SIGNATURE_OFFICE}</w:rPr><w:br/>` +
        `<w:t xml:space="preserve">Global Business Strategy Development</w:t></w:r>`,
    );

  return [
    title,
    employeeLine,
    visitLine,
    supplierName,

    heading("Purpose", shell, false),
    body(sections.purpose),

    heading("Company Information", shell, false),
    dataTable(columnWidths(shell, [32, 68]), snapshotRows, { headerRow: false }),

    heading("Company Overview:", shell, false),
    body(sections.overview),

    heading("Main Products:", shell, false),
    body(sections.mainProducts),
    productRows,
    inlinePhotos(photos, "MAIN_PRODUCT_IMAGES", images, media, shell),

    heading("Target Products:", shell, false),
    body(sections.targetNotes),
    targetRows,

    heading("Relevant Information:", shell, false),
    observations,
    qa,

    heading("Certificates:", shell, true),
    certificateRows,
    body(sections.certificateNote),

    heading("Main Partners/Competitors Reference:", shell, true),
    body(sections.partners),
    inlinePhotos(photos, "PARTNER_IMAGES", images, media, shell),

    heading("Conclusion", shell, true),
    body(sections.conclusion),

    signature,
    appendixSection(photos, images, media, shell),
  ].join("");
}

/**
 * "Appendix 1 - Pictures" and the photograph grid, on pages of its own.
 *
 * The heading is written even when there are no photographs — the corporate
 * document has a fixed shape, and a missing appendix reads as an omission.
 */
function appendixSection(
  photos: readonly ReportPhoto[],
  images: Map<string, ExportImage>,
  media: MediaRegistry,
  shell: Shell,
): string {
  const appendixHeading = paragraph(
    `<w:pPr><w:jc w:val="center"/><w:rPr>${RPR_APPENDIX_HEADING}</w:rPr></w:pPr>`,
    run("Appendix 1 - Pictures", RPR_APPENDIX_HEADING),
  );

  const withBytes = photosIn(photos, "APPENDIX_IMAGES").filter((photo) => images.has(photo.id));
  if (withBytes.length === 0) {
    return pageBreak() + appendixHeading + spacer() + body("");
  }

  const plan = planAppendix(withBytes);
  const pages = plan.pages.map((page, index) => {
    const grid = photoGrid(page.rows, images, media, shell, {
      captions: IMAGE_REGION_GEOMETRY.APPENDIX_IMAGES.captionRow,
    });
    return index === 0 ? grid : pageBreak() + grid;
  });

  return pageBreak() + appendixHeading + spacer() + pages.join("");
}

// ─────────────────────────────────────────────────────────────────────────────
// The package
// ─────────────────────────────────────────────────────────────────────────────

/** The highest `rIdN` already in use, so new relationships cannot collide. */
function highestRelNumber(relsXml: string): number {
  let highest = 0;
  for (const match of relsXml.matchAll(/Id="rId(\d+)"/g)) {
    highest = Math.max(highest, Number(match[1]));
  }
  return highest;
}

interface Relationship {
  markup: string;
  isImage: boolean;
  target: string;
}

function parseRelationships(relsXml: string): Relationship[] {
  return [...relsXml.matchAll(/<Relationship\b[^>]*\/>/g)].map((match) => {
    const markup = match[0];
    return {
      markup,
      isImage: markup.includes(`Type="${IMAGE_REL_TYPE}"`),
      target: /Target="([^"]*)"/.exec(markup)?.[1] ?? "",
    };
  });
}

/**
 * Rewrite `word/_rels/document.xml.rels` for the new body.
 *
 * Image relationships of the OLD document are dropped unless a header or footer
 * needs the same file — the EBARA logo in `header2.xml` and the rule in
 * `footer2.xml` are reached through their own `.rels` parts and are untouched.
 */
function rewriteDocumentRels(
  relsXml: string,
  parts: ReadonlyMap<string, Buffer>,
  added: readonly string[],
): string {
  const keptElsewhere = new Set<string>();
  for (const [path, data] of parts) {
    if (!path.startsWith("word/_rels/") || path === "word/_rels/document.xml.rels") continue;
    for (const relationship of parseRelationships(data.toString("utf8"))) {
      if (relationship.isImage) keptElsewhere.add(relationship.target);
    }
  }

  const kept = parseRelationships(relsXml)
    .filter((relationship) => !relationship.isImage || keptElsewhere.has(relationship.target))
    .map((relationship) => relationship.markup);

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<Relationships xmlns="${RELATIONSHIPS_NS}">${[...kept, ...added].join("")}</Relationships>`
  );
}

/** Every `word/media/...` part some surviving relationship still points at. */
function referencedMedia(parts: ReadonlyMap<string, Buffer>): Set<string> {
  const referenced = new Set<string>();
  for (const [path, data] of parts) {
    if (!path.startsWith("word/_rels/")) continue;
    for (const relationship of parseRelationships(data.toString("utf8"))) {
      if (relationship.target && !relationship.target.startsWith("../")) {
        referenced.add(`word/${relationship.target}`);
      }
    }
  }
  return referenced;
}

/** Add a `Default` for any image extension the template does not declare. */
function ensureContentTypes(contentTypesXml: string, extensions: ReadonlyMap<string, string>): string {
  const missing = [...extensions]
    .filter(([extension]) => !new RegExp(`Extension="${extension}"`, "i").test(contentTypesXml))
    .map(([extension, contentType]) => `<Default Extension="${extension}" ContentType="${contentType}"/>`);

  if (missing.length === 0) return contentTypesXml;
  return contentTypesXml.replace("</Types>", `${missing.join("")}</Types>`);
}

/**
 * Generate the report into the uploaded template's shell.
 *
 * Throws `TemplateShellError` when the upload cannot serve as a shell; every
 * other failure is a bug in this module and is allowed to propagate.
 */
export function buildTemplateReportDocx(input: TemplateReportInput): Buffer {
  const parts = readZipParts(input.template);

  const documentPart = parts.get("word/document.xml");
  if (!documentPart) {
    throw new TemplateShellError(
      "The template has no word/document.xml, so it is not a Word document.",
    );
  }

  const relsPath = "word/_rels/document.xml.rels";
  const relsPart = parts.get(relsPath);
  if (!relsPart) {
    throw new TemplateShellError("The template has no relationships for its document part.");
  }

  const documentXml = documentPart.toString("utf8");
  const relsXml = relsPart.toString("utf8");
  const shell = readShell(documentXml, parts.get("word/numbering.xml")?.toString("utf8") ?? null);

  const media = createMediaRegistry(highestRelNumber(relsXml) + 1, new Set(parts.keys()));
  const bodyXml = documentBody(input, shell, media);

  const output = new Map(parts);
  output.set(
    "word/document.xml",
    Buffer.from(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        `<w:document ${NAMESPACES}><w:body>${bodyXml}${shell.sectPr}</w:body></w:document>`,
      "utf8",
    ),
  );
  for (const [path, data] of media.parts) output.set(path, data);
  output.set(relsPath, Buffer.from(rewriteDocumentRels(relsXml, output, media.relationships), "utf8"));

  const contentTypes = output.get("[Content_Types].xml");
  if (!contentTypes) throw new TemplateShellError("The template has no [Content_Types].xml.");
  output.set(
    "[Content_Types].xml",
    Buffer.from(ensureContentTypes(contentTypes.toString("utf8"), media.contentTypeExtensions), "utf8"),
  );

  // Orphaned media — the example report's own photographs and signature — goes
  // out with the body that referenced it.
  const referenced = referencedMedia(output);
  for (const path of [...output.keys()]) {
    if (path.startsWith("word/media/") && !referenced.has(path)) output.delete(path);
  }

  return writeZipParts(output);
}
