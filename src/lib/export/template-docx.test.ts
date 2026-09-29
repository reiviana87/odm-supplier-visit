import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { inflateRawSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { buildTemplateReportDocx, TemplateShellError } from "@/lib/export/template-docx";
import type { ExportImage } from "@/lib/export/docx";
import { HUATONG_REPORT, REPORT_PHOTOS } from "@/lib/mock-data";
import type { ReportPhoto } from "@/types/domain";

/**
 * These tests assert on the FILE, not on the code path.
 *
 * The whole claim of this module is "the corporate letterhead survived", and the
 * only honest way to check that is to generate a real package from the real
 * template and read the bytes back: the header and footer parts have to come out
 * identical, the new body has to carry this report's data and none of the
 * example's, and every image the body points at has to actually be in the file.
 *
 * Nobody here can open Word, so what is verified is structural: part-for-part
 * identity of the letterhead, resolvable image relationships, declared content
 * types, and a CRC per entry — the checks that distinguish a file Word opens from
 * one it offers to repair.
 */

const TEMPLATE_PATH = resolve(process.cwd(), "reference", "EBARA_ODM_Visit_Report_v1.5.docx");

if (!existsSync(TEMPLATE_PATH)) {
  throw new Error(
    `The corporate template fixture is missing: ${TEMPLATE_PATH}\n` +
      "It is the shell every generated report is cloned from, so these tests " +
      "cannot run without it. Restore reference/EBARA_ODM_Visit_Report_v1.5.docx.",
  );
}

const TEMPLATE = readFileSync(TEMPLATE_PATH);

/** A 1x1 PNG — enough to be a real image part with a real content type. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function imagesFor(photos: readonly ReportPhoto[]): Map<string, ExportImage> {
  return new Map(
    photos.map((photo) => [
      photo.id,
      { data: PNG, type: "png" as const, width: 1600, height: 1200 },
    ]),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// An independent ZIP reader
//
// Deliberately not the one in template-docx.ts: a reader that shares code with
// the writer would agree with it about a package Word rejects. CRC-32 is
// implemented here from the polynomial rather than taken from `node:zlib`, whose
// `crc32` only exists from Node 22.2 while this project supports 20.9.
// ─────────────────────────────────────────────────────────────────────────────

interface Entry {
  data: Buffer;
  crcMatches: boolean;
  sizeMatches: boolean;
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc ^= data[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) === 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
    crc >>>= 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function readZip(buffer: Buffer): Map<string, Entry> {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  expect(eocd, "the file has no ZIP end-of-central-directory record").toBeGreaterThan(-1);

  const total = buffer.readUInt16LE(eocd + 10);
  let cursor = buffer.readUInt32LE(eocd + 16);
  const entries = new Map<string, Entry>();

  for (let i = 0; i < total; i += 1) {
    expect(buffer.readUInt32LE(cursor)).toBe(0x02014b50);

    const method = buffer.readUInt16LE(cursor + 10);
    const crc = buffer.readUInt32LE(cursor + 16);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");

    expect(buffer.readUInt32LE(localOffset)).toBe(0x04034b50);
    const start =
      localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
    const payload = buffer.subarray(start, start + compressedSize);
    const data = method === 0 ? Buffer.from(payload) : inflateRawSync(payload);

    entries.set(name, {
      data,
      crcMatches: crc32(data) === crc,
      sizeMatches: data.length === uncompressedSize,
    });

    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function generate(photos: readonly ReportPhoto[]): Map<string, Entry> {
  return readZip(
    buildTemplateReportDocx({
      report: HUATONG_REPORT,
      photos,
      images: imagesFor(photos),
      template: TEMPLATE,
    }),
  );
}

function textOf(entries: Map<string, Entry>, path: string): string {
  const entry = entries.get(path);
  expect(entry, `${path} is missing from the package`).toBeDefined();
  return entry!.data.toString("utf8");
}

// ─────────────────────────────────────────────────────────────────────────────

describe("buildTemplateReportDocx", () => {
  const template = readZip(TEMPLATE);
  const output = generate(REPORT_PHOTOS);

  it("produces a package Word will recognise as a document", () => {
    for (const path of ["[Content_Types].xml", "word/document.xml", "word/styles.xml"]) {
      expect(output.has(path), `${path} is missing`).toBe(true);
    }
    // The content types stream has to be the first entry of an OPC package.
    expect([...output.keys()][0]).toBe("[Content_Types].xml");
  });

  it("writes an intact ZIP: every entry's CRC and size match its payload", () => {
    const broken = [...output].filter(([, entry]) => !entry.crcMatches || !entry.sizeMatches);
    expect(broken.map(([path]) => path)).toEqual([]);
  });

  it("carries the letterhead through byte for byte", () => {
    // The point of the whole module: these parts are the template's own bytes.
    for (const path of ["word/header1.xml", "word/header2.xml", "word/footer1.xml", "word/footer2.xml"]) {
      expect(output.get(path)?.data.equals(template.get(path)!.data), `${path} was modified`).toBe(true);
    }
    // And so is everything else the letterhead depends on.
    for (const path of ["word/styles.xml", "word/numbering.xml", "word/theme/theme1.xml", "word/settings.xml"]) {
      expect(output.get(path)?.data.equals(template.get(path)!.data), `${path} was modified`).toBe(true);
    }
  });

  it("keeps the logo images the header and footer point at", () => {
    // header2 → media/image8.jpeg + image9.jpeg, footer2 → media/image10.emf.
    for (const path of ["word/media/image8.jpeg", "word/media/image9.jpeg", "word/media/image10.emf"]) {
      expect(output.get(path)?.data.equals(template.get(path)!.data), `${path} was lost`).toBe(true);
    }
  });

  it("reuses the template's own page geometry and letterhead references", () => {
    const document = textOf(output, "word/document.xml");
    // A4 at the template's margins, and the two header/footer references that
    // put the EBARA letterhead on every page.
    expect(document).toContain('<w:pgSz w:w="11907" w:h="16840"');
    expect(document).toContain('w:top="557"');
    expect(document).toContain('<w:headerReference w:type="default" r:id="rId19"/>');
    expect(document).toContain('<w:footerReference w:type="default" r:id="rId21"/>');
  });

  it("writes this report's data into the body", () => {
    const document = textOf(output, "word/document.xml");
    expect(document).toContain(HUATONG_REPORT.documentNumber);
    // The frozen snapshot's legal name, XML-escaped — the live supplier row is
    // never read (README §8.3).
    expect(document).toContain("Hebei Huatong Wires &amp; Cables Group Co., Ltd.");
    expect(document).toContain(`Period: ${HUATONG_REPORT.period}`);
  });

  it("leaves none of the example report's data behind", () => {
    const document = textOf(output, "word/document.xml");
    expect(document).not.toContain("Lingxiao");
    expect(document).not.toContain("GSO-2507001x00");
    expect(document).not.toContain("Canton Fair");
    // The example's own photographs and the signature image go with the body
    // that referenced them.
    expect(output.has("word/media/image1.jpeg")).toBe(false);
    expect(output.has("word/media/image3.jpeg")).toBe(false);
  });

  it("writes every mandated heading, in the template's order", () => {
    const document = textOf(output, "word/document.xml");
    const headings = [
      "Purpose",
      "Company Information",
      "Company Overview:",
      "Main Products:",
      "Target Products:",
      "Relevant Information:",
      "Certificates:",
      "Main Partners/Competitors Reference:",
      "Conclusion",
      "Appendix 1 - Pictures",
    ];

    let cursor = -1;
    for (const text of headings) {
      const at = document.indexOf(`>${text}</w:t>`);
      expect(at, `heading "${text}" is missing`).toBeGreaterThan(cursor);
      cursor = at;
    }
  });

  it("styles the headings with the template's own styles and numbering", () => {
    const document = textOf(output, "word/document.xml");
    // Sections 1..6 are Title-styled, 7..9 are List Paragraph, and both point at
    // the numbered list the template itself uses — that is where "1." comes from.
    expect(document).toContain('<w:pStyle w:val="Ttulo"/>');
    expect(document).toContain('<w:pStyle w:val="PargrafodaLista"/>');
    expect(document).toContain('<w:numId w:val="3"/>');
    // Arial 14pt headings, 10pt body, 10.5pt appendix heading.
    expect(document).toContain('<w:sz w:val="28"/>');
    expect(document).toContain('<w:sz w:val="21"/>');
  });

  it("does not reproduce the example's signature image", () => {
    const document = textOf(output, "word/document.xml");
    // The name is written; the scan of one person's signature is not.
    expect(document).toContain(HUATONG_REPORT.reportOwner);
    expect(document).toContain("Global Sourcing Office");
    expect(document).not.toContain('cx="397465"');
  });

  it("resolves every image the body points at to a part in the package", () => {
    const document = textOf(output, "word/document.xml");
    const rels = textOf(output, "word/_rels/document.xml.rels");

    const targets = new Map<string, string>();
    for (const match of rels.matchAll(/<Relationship Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
      targets.set(match[1], match[2]);
    }

    const embedded = [...document.matchAll(/r:embed="([^"]+)"/g)].map((match) => match[1]);
    expect(embedded.length).toBeGreaterThan(0);

    for (const relId of embedded) {
      const target = targets.get(relId);
      expect(target, `${relId} has no relationship`).toBeDefined();
      expect(output.has(`word/${target}`), `word/${target} is missing`).toBe(true);
    }
  });

  it("declares a content type for the images it added", () => {
    // The template declares jpeg and emf but not png, so this is the path that
    // stops Word opening the file to a repair dialog.
    expect(textOf(output, "[Content_Types].xml")).toContain('Extension="png"');
  });

  it("paginates the appendix exactly as planAppendix decides", () => {
    const document = textOf(output, "word/document.xml");
    // 22 appendix photographs → 11 rows of two → 3 + 3 + 3 + 2 rows over 4 pages.
    // One page break starts the appendix, three more separate its pages.
    expect(document.split('<w:br w:type="page"/>').length - 1).toBe(4);
    expect(document.split("<w:tbl>").length - 1).toBeGreaterThanOrEqual(4);
  });

  it("prints appendix photographs inside the measured 7 cm box", () => {
    const document = textOf(output, "word/document.xml");
    // 4:3 at a 7 cm box is 7.00 x 5.25 cm — 2520000 x 1890000 EMU, which is what
    // the corporate template's own appendix photographs measure.
    expect(document).toContain('<wp:extent cx="2520000" cy="1890000"/>');
  });

  it("survives a report with no photographs at all", () => {
    const empty = generate([]);
    const document = textOf(empty, "word/document.xml");

    expect(empty.get("word/document.xml")?.crcMatches).toBe(true);
    // The appendix heading is written anyway: the corporate report has a fixed
    // shape, and a missing section reads as an omission.
    expect(document).toContain("Appendix 1 - Pictures");
    expect(document).not.toContain("r:embed=");
    // No generated media, and none of the example's left over either.
    expect([...empty.keys()].filter((path) => path.startsWith("word/media/"))).toEqual([
      "word/media/image8.jpeg",
      "word/media/image9.jpeg",
      "word/media/image10.emf",
    ]);
  });

  it("writes a heading with an em dash under it for an unwritten section", () => {
    // §9 Conclusion is deliberately empty in the seeded report.
    expect(HUATONG_REPORT.sections.conclusion).toBe("");
    expect(textOf(output, "word/document.xml")).toContain("—");
  });

  it("reuses the template's jpeg content type for the photographs it adds", () => {
    // What production actually sends: `loadImages` reports "jpg" for anything not
    // a .png. The part is named .jpeg so the template's existing Default covers
    // it, and [Content_Types].xml comes out untouched.
    const jpegs = new Map(
      REPORT_PHOTOS.slice(0, 2).map((photo) => [
        photo.id,
        { data: PNG, type: "jpg" as const, width: 1600, height: 1200 },
      ]),
    );
    const entries = readZip(
      buildTemplateReportDocx({
        report: HUATONG_REPORT,
        photos: REPORT_PHOTOS,
        images: jpegs,
        template: TEMPLATE,
      }),
    );

    expect([...entries.keys()].filter((path) => path.startsWith("word/media/report-image-"))).toEqual([
      "word/media/report-image-1.jpeg",
      "word/media/report-image-2.jpeg",
    ]);
    expect(entries.get("[Content_Types].xml")?.data.equals(template.get("[Content_Types].xml")!.data)).toBe(
      true,
    );
  });

  it("skips a photo whose bytes could not be read rather than failing", () => {
    const partial = buildTemplateReportDocx({
      report: HUATONG_REPORT,
      photos: REPORT_PHOTOS,
      images: imagesFor(REPORT_PHOTOS.slice(0, 2)),
      template: TEMPLATE,
    });

    const entries = readZip(partial);
    const media = [...entries.keys()].filter((path) => path.startsWith("word/media/report-image-"));
    expect(media.length).toBe(2);
  });
});

describe("an unusable upload", () => {
  it("is reported as a template problem, not a crash", () => {
    expect(() => buildTemplateReportDocx({
      report: HUATONG_REPORT,
      photos: [],
      images: new Map(),
      template: Buffer.from("this is not a .docx at all"),
    })).toThrow(TemplateShellError);
  });

  it("rejects a ZIP that is not a Word document", () => {
    // A valid, empty ZIP: end-of-central-directory record and nothing else.
    const emptyZip = Buffer.alloc(22);
    emptyZip.writeUInt32LE(0x06054b50, 0);

    expect(() => buildTemplateReportDocx({
      report: HUATONG_REPORT,
      photos: [],
      images: new Map(),
      template: emptyZip,
    })).toThrow(/word\/document\.xml/);
  });
});
