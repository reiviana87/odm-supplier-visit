/**
 * DOCX generation — README §19..§24.
 *
 * Builds the corporate visit report as a real Word file. This is the default
 * generator: it owns the layout rather than filling somebody else's template,
 * because no corporate `.dotx` has been supplied yet. When one arrives, the
 * template path replaces this at the call site in `export-actions.ts` and this
 * stays as the fallback — so the export never stops working while a template is
 * being fitted.
 *
 * The appendix obeys `@/lib/reports/appendix-layout`: two columns, 6.5 cm
 * photographs, captions underneath, and as many pages as that honestly needs.
 *
 * Server-only. `docx` pulls in Node stream and buffer handling, and the images
 * arrive as bytes read from Supabase Storage, so nothing here may be imported
 * into a client component.
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  convertMillimetersToTwip,
} from "docx";

import {
  APPENDIX_MARGIN_MM,
  MARGIN_MM,
  photoBoxPt,
  planAppendix,
} from "@/lib/reports/appendix-layout";
import type { Report, ReportPhoto, SupplierCertificate } from "@/types/domain";

// ─────────────────────────────────────────────────────────────────────────────
// House style
// ─────────────────────────────────────────────────────────────────────────────

/** EBARA navy, the ink the approved screens use for headings. */
const NAVY = "1D2D3D";
const RULE = "C8D2DC";
const MUTED = "5A6B7A";

/** `docx` sizes text in half-points. */
const pt = (size: number) => size * 2;

const FONT = "Calibri";

/** One image, already read from storage, with whatever dimensions we know. */
export interface ExportImage {
  data: Buffer | Uint8Array;
  /** "png" | "jpg" — `docx` needs to be told. */
  type: "png" | "jpg" | "gif" | "bmp";
  width: number;
  height: number;
}

/**
 * The caption the document prints.
 *
 * ONLY what a person wrote or accepted. `ai_caption` holds a proposal the
 * author has not agreed to — §16 is explicit that a model's words become the
 * caption on acceptance and not before — and the exporter used to fall through
 * to it whenever `caption` was empty. So a proposal nobody had read, or one the
 * author had deliberately cleared, was printed in a signed report as if they
 * had written it. An em dash says "no caption" honestly; a sentence somebody
 * did not write does not.
 */
export function printableCaption(photo: ReportPhoto): string {
  const written = photo.caption.trim();
  if (written) return written;
  // An accepted proposal IS the author's caption — `acceptPhotoCaption` and the
  // card's Accept both write it into `caption`, so this only catches a row that
  // recorded acceptance without copying the text across.
  if (photo.captionState === "accepted" && photo.aiCaption.trim()) {
    return photo.aiCaption.trim();
  }
  return "\u2014";
}

/** "09:30 – 16:45", or whichever end of it was recorded. */
export function visitHours(report: Report): string {
  const start = report.startTime?.trim() ?? "";
  const end = report.endTime?.trim() ?? "";
  if (start && end) return `${start} \u2013 ${end}`;
  return start || end;
}

export interface BuildDocxInput {
  report: Report;
  photos: readonly ReportPhoto[];
  /** Photo id → bytes. A photo with no entry is skipped rather than breaking. */
  images: Map<string, ExportImage>;
  /** The supplier's certificates, printed as §7's table. */
  certificates?: readonly SupplierCertificate[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Building blocks
// ─────────────────────────────────────────────────────────────────────────────

function heading(text: string, number?: string): Paragraph {
  return new Paragraph({
    spacing: { before: 320, after: 140 },
    keepNext: true,
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 6 } },
    children: [
      new TextRun({
        text: number ? `${number}  ${text}` : text,
        bold: true,
        size: pt(13),
        color: NAVY,
        font: FONT,
      }),
    ],
  });
}

/** Body prose. Empty input yields the em dash rather than a blank gap. */
function body(text: string): Paragraph[] {
  const trimmed = (text ?? "").trim();
  if (!trimmed) {
    return [
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: "—", size: pt(10.5), color: MUTED, font: FONT })],
      }),
    ];
  }

  // A blank line starts a new paragraph; a single newline is a line break
  // INSIDE one. It used to be flattened to a space, so a block of notes pasted
  // with one point per line arrived in Word as a single wall of prose and the
  // structure the author typed was gone — in the document and nowhere else.
  return trimmed.split(/\n{2,}/).map(
    (block) =>
      new Paragraph({
        spacing: { after: 120, line: 276 },
        alignment: AlignmentType.JUSTIFIED,
        children: lineRuns(block),
      }),
  );
}

/**
 * One run per line, with a break between them.
 *
 * `docx` has no "text with newlines" run: a `\n` inside a TextRun is dropped by
 * Word, so the lines have to be separate runs joined by explicit breaks.
 */
function lineRuns(block: string): TextRun[] {
  const lines = block.split("\n").map((line) => line.trim());
  return lines.map(
    (line, index) =>
      new TextRun({
        text: line,
        size: pt(10.5),
        font: FONT,
        break: index === 0 ? undefined : 1,
      }),
  );
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60 },
    // A key point pasted as a wrapped paragraph carries its own newlines.
    children: lineRuns(text),
  });
}

function cell(text: string, options: { bold?: boolean; header?: boolean; width?: number } = {}) {
  return new TableCell({
    width: options.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined,
    shading: options.header
      ? { type: ShadingType.CLEAR, fill: "EEF2F6", color: "auto" }
      : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: text || "—",
            bold: options.bold || options.header,
            size: pt(9.5),
            color: options.header ? NAVY : undefined,
            font: FONT,
          }),
        ],
      }),
    ],
  });
}

function table(rows: TableRow[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: RULE },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE },
      left: { style: BorderStyle.SINGLE, size: 4, color: RULE },
      right: { style: BorderStyle.SINGLE, size: 4, color: RULE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: RULE },
    },
    rows,
  });
}

/** A two-column key/value block — used for §2 Company Information. */
function definitionTable(pairs: ReadonlyArray<[string, string | null]>): Table {
  return table(
    pairs.map(
      ([label, value]) =>
        new TableRow({
          children: [cell(label, { bold: true, width: 32 }), cell(value ?? "—", { width: 68 })],
        }),
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Photo blocks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * An inline photograph with its caption, centred, for §4.1 and §8.1.
 *
 * These are not the appendix: they sit in the flow of the text at a comfortable
 * reading width rather than on the 6.5 cm grid.
 */
function inlinePhoto(photo: ReportPhoto, image: ExportImage): Paragraph[] {
  // 14 cm is comfortable inside the 17 cm body column and leaves the caption
  // visually attached to the photograph rather than floating under a full-bleed.
  const width = (140 / 25.4) * 72;
  const ratio = image.width > 0 && image.height > 0 ? image.width / image.height : 4 / 3;
  const height = width / ratio;

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 160, after: 60 },
      keepNext: true,
      children: [
        new ImageRun({
          data: image.data,
          type: image.type,
          transformation: { width: Math.round(width), height: Math.round(height) },
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: printableCaption(photo),
          italics: true,
          size: pt(9),
          color: MUTED,
          font: FONT,
        }),
      ],
    }),
  ];
}

/**
 * The appendix grid — README §23.
 *
 * One borderless table per page-worth of rows, so Word never splits a
 * photograph from its caption across a page boundary: the plan decides where
 * the breaks fall, and an explicit page break separates the tables.
 */
function appendixTables(
  photos: readonly ReportPhoto[],
  images: Map<string, ExportImage>,
): (Table | Paragraph)[] {
  const withBytes = photos.filter((photo) => images.has(photo.id));
  if (withBytes.length === 0) {
    return body("No appendix photographs were attached to this report.");
  }

  const plan = planAppendix(withBytes);
  const { columnWidthMm } = plan.geometry;
  const out: (Table | Paragraph)[] = [];

  plan.pages.forEach((page, pageIndex) => {
    if (pageIndex > 0) out.push(new Paragraph({ children: [new PageBreak()] }));

    const rows = page.rows.map((row) => {
      const cells = row.map((photo) => {
        const image = images.get(photo.id)!;
        const box = photoBoxPt(image.width, image.height, columnWidthMm);

        return new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          margins: { top: 60, bottom: 160, left: 60, right: 60 },
          borders: {
            top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 60 },
              children: [
                new ImageRun({
                  data: image.data,
                  type: image.type,
                  transformation: {
                    width: Math.round(box.width),
                    height: Math.round(box.height),
                  },
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: printableCaption(photo),
                  size: pt(8.5),
                  color: MUTED,
                  font: FONT,
                }),
              ],
            }),
          ],
        });
      });

      // A trailing odd photo keeps its column rather than stretching across.
      if (cells.length === 1) {
        cells.push(
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            },
            children: [new Paragraph({ children: [] })],
          }),
        );
      }

      return new TableRow({ children: cells, cantSplit: true });
    });

    out.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        },
        rows,
      }),
    );
  });

  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// The document
// ─────────────────────────────────────────────────────────────────────────────

function photosIn(photos: readonly ReportPhoto[], region: ReportPhoto["region"]) {
  return [...photos]
    .filter((photo) => photo.region === region)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * The supplier's certificates, as the report's own table.
 *
 * §7 used to print only the free note. The certificates themselves — the names,
 * the numbers, the dates somebody stood in a factory and copied off a wall —
 * were in the database, on the screen, and in no document. A section called
 * Certificates that lists none is the clearest kind of silent loss.
 */
function certificateTable(certificates: readonly SupplierCertificate[]): Paragraph[] {
  const listed = certificates.filter((certificate) => certificate.name.trim() !== "");
  if (listed.length === 0) return [];

  return [
    table([
      new TableRow({
        tableHeader: true,
        children: [
          cell("Certificate", { header: true, width: 34 }),
          cell("Number", { header: true, width: 24 }),
          cell("Issued", { header: true, width: 14 }),
          cell("Expires", { header: true, width: 14 }),
          cell("Copy", { header: true, width: 14 }),
        ],
      }),
      ...listed.map(
        (certificate) =>
          new TableRow({
            children: [
              cell(certificate.name),
              cell(certificate.number),
              cell(certificate.issueDate),
              cell(certificate.expirationDate),
              // What the reader needs to know is whether the paper was seen,
              // not the file name of the scan.
              cell(certificate.fileName ? "Collected" : "Not collected"),
            ],
          }),
      ),
    ]),
  ] as unknown as Paragraph[];
}

export async function buildReportDocx(input: BuildDocxInput): Promise<Buffer> {
  const { report, photos, images, certificates = [] } = input;
  const snapshot = report.supplierSnapshot;
  const sections = report.sections;

  const cover: Paragraph[] = [
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: "EBARA · GLOBAL SOURCING OFFICE",
          bold: true,
          size: pt(8.5),
          color: MUTED,
          font: FONT,
          characterSpacing: 24,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 40 },
      heading: HeadingLevel.TITLE,
      children: [
        new TextRun({
          text: "Supplier Visit Report",
          bold: true,
          size: pt(22),
          color: NAVY,
          font: FONT,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 280 },
      children: [
        new TextRun({
          text: snapshot.legalName || snapshot.shortName,
          size: pt(12),
          color: MUTED,
          font: FONT,
        }),
      ],
    }),
  ];

  const metaTable = definitionTable([
    ["Document Number", report.documentNumber],
    ["Supplier", snapshot.shortName],
    ["Employee", report.employee || report.reportOwner],
    ["Period", report.period],
    ["Visit Date", report.visitDate],
    // Stored by General Information and printed by neither exporter until the
    // audit looked: a reader could not tell a two-hour call from a day's audit.
    ["Hours", visitHours(report)],
    ["Location", report.location],
    ["Members", report.members.join(", ")],
    // The audit found these three stored and never printed.
    ["Project", report.project ?? ""],
    ["Business Unit", report.businessUnit ?? ""],
    ["Product Category", report.productCategory ?? ""],
  ]);

  const companyInfo = definitionTable([
    ["Legal Name", snapshot.legalName],
    ["President", snapshot.presidentName],
    ["Established", snapshot.establishedYear],
    ["Capital", snapshot.companyCapital],
    ["Employees", snapshot.employees],
    ["Factory Size", snapshot.factorySizeM2],
    ["Production Capacity", snapshot.productionCapacity],
    ["Certifications", snapshot.certifications],
    ["Address", [snapshot.address, snapshot.city, snapshot.region, snapshot.country].filter(Boolean).join(", ")],
    ["Telephone", snapshot.tel],
    ["Website", snapshot.websiteUrl],
    ["EBARA Track Record", snapshot.trackRecordEbara],
  ]);

  const productRows = sections.productRows.length
    ? [
        table([
          new TableRow({
            tableHeader: true,
            children: [
              cell("Type", { header: true, width: 22 }),
              cell("Standard", { header: true, width: 22 }),
              cell("Voltage", { header: true, width: 16 }),
              cell("Description", { header: true, width: 40 }),
            ],
          }),
          ...sections.productRows.map(
            (row) =>
              new TableRow({
                children: [
                  cell(row.type),
                  cell(row.standard),
                  cell(row.voltage),
                  cell(row.description),
                ],
              }),
          ),
        ]),
      ]
    : [];

  const targetRows = sections.targetProducts.length
    ? [
        table([
          new TableRow({
            tableHeader: true,
            children: [
              cell("Product", { header: true, width: 20 }),
              cell("Model", { header: true, width: 14 }),
              cell("Application", { header: true, width: 20 }),
              cell("Market", { header: true, width: 14 }),
              cell("Requirements", { header: true, width: 16 }),
              // The audit found this column missing: a user typed notes onto a
              // target product and they were in the database and in no document.
              cell("Comments", { header: true, width: 16 }),
            ],
          }),
          ...sections.targetProducts.map(
            (product) =>
              new TableRow({
                children: [
                  cell(product.name),
                  cell(product.model),
                  cell(product.application),
                  cell(product.expectedMarket),
                  cell(product.technicalRequirements),
                  cell(product.comments),
                ],
              }),
          ),
        ]),
      ]
    : [];

  const observations = sections.observations.length
    ? sections.observations.map((observation) =>
        bullet(
          `${observation.category}${
            observation.priority !== "Normal" ? ` (${observation.priority})` : ""
          } — ${observation.text}`,
        ),
      )
    : body("");

  const mainProductPhotos = photosIn(photos, "MAIN_PRODUCT_IMAGES");
  const partnerPhotos = photosIn(photos, "PARTNER_IMAGES");
  const appendixPhotos = photosIn(photos, "APPENDIX_IMAGES");

  const bodyChildren = [
    ...cover,
    metaTable,

    heading("Purpose", "1."),
    ...body(sections.purpose),

    heading("Company Information", "2."),
    companyInfo,

    heading("Company Overview", "3."),
    ...body(sections.overview),

    heading("Main Products", "4."),
    ...body(sections.mainProducts),
    ...productRows,
    ...mainProductPhotos.flatMap((photo) => {
      const image = images.get(photo.id);
      return image ? inlinePhoto(photo, image) : [];
    }),

    heading("Target Products", "5."),
    ...body(sections.targetNotes),
    ...targetRows,

    heading("Visit Relevant Information", "6."),
    ...observations,
    ...(sections.qaIncluded && sections.qaBullets.length
      ? [
          new Paragraph({
            spacing: { before: 160, after: 80 },
            children: [
              new TextRun({ text: "Questions and answers", bold: true, size: pt(10.5), font: FONT }),
            ],
          }),
          ...sections.qaBullets.map(bullet),
        ]
      : []),

    heading("Certificates", "7."),
    ...certificateTable(certificates),
    ...body(sections.certificateNote),

    heading("Partners", "8."),
    ...body(sections.partners),
    ...partnerPhotos.flatMap((photo) => {
      const image = images.get(photo.id);
      return image ? inlinePhoto(photo, image) : [];
    }),

    heading("Conclusion", "9."),
    ...body(sections.conclusion),
  ];

  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            children: [report.documentNumber, "  ·  ", PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES],
            size: pt(8),
            color: MUTED,
            font: FONT,
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    creator: "EBARA Global Sourcing Office",
    title: `${report.documentNumber} — ${snapshot.shortName} Visit Report`,
    description: "Supplier factory visit report",
    sections: [
      {
        properties: {
          page: {
            size: { width: convertMillimetersToTwip(210), height: convertMillimetersToTwip(297) },
            margin: {
              top: convertMillimetersToTwip(MARGIN_MM),
              bottom: convertMillimetersToTwip(MARGIN_MM),
              left: convertMillimetersToTwip(MARGIN_MM),
              right: convertMillimetersToTwip(MARGIN_MM),
            },
          },
        },
        footers: { default: footer },
        children: bodyChildren,
      },
      // The appendix is its own section so it can start on a new page and take
      // the narrower margin the 6.5 cm grid needs.
      {
        properties: {
          page: {
            size: { width: convertMillimetersToTwip(210), height: convertMillimetersToTwip(297) },
            margin: {
              top: convertMillimetersToTwip(APPENDIX_MARGIN_MM),
              bottom: convertMillimetersToTwip(APPENDIX_MARGIN_MM),
              left: convertMillimetersToTwip(APPENDIX_MARGIN_MM),
              right: convertMillimetersToTwip(APPENDIX_MARGIN_MM),
            },
          },
        },
        footers: { default: footer },
        children: [heading("Appendix", "10."), ...appendixTables(appendixPhotos, images)],
      },
    ],
  });

  const { Packer } = await import("docx");
  return Packer.toBuffer(doc);
}

/**
 * README §24 — `GSO-2608001x00_TESK_Visit_Report.docx`.
 *
 * Anything Windows refuses in a filename is replaced rather than dropped, so
 * two suppliers cannot collapse onto the same name.
 */
export function exportFileName(documentNumber: string, supplierShortName: string): string {
  const safe = (value: string) =>
    value
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");

  return `${safe(documentNumber)}_${safe(supplierShortName)}_Visit_Report.docx`;
}
