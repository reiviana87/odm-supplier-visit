/**
 * Appendix pagination — README §16, and the arithmetic both DOCX generators obey.
 *
 * The numbers here are measured from the corporate template
 * (`EBARA_ODM_Visit_Report_v1.5.docx`), not chosen: its appendix photographs
 * carry `wp:extent` values of 2520000 x 1890000 EMU for a landscape shot and
 * 1890000 x 2520000 for a portrait one — 7.00 x 5.25 cm and 5.25 x 7.00 cm.
 * That is one rule, not two: every photograph is fitted inside a 7 cm square
 * with its aspect ratio preserved. Six photographs to a page, three rows of two.
 *
 * The business brief asks for twelve alternating photo/caption rows on one page.
 * On A4 that is not a layout, it is a wish: three rows of a 7 cm photo plus its
 * caption already fill the printable area, so twelve would need four pages. The
 * brief is explicit that the photo size is the requirement and the row count is
 * not, so this module keeps the 7 cm box, keeps two columns, and paginates
 * instead of shrinking.
 *
 * Everything is in millimetres until the last moment, because that is how the
 * page is specified. `docx` wants twentieths of a point, so the conversion
 * lives here too and nothing else has to think about it.
 */

/** A4 portrait, in millimetres. */
export const PAGE = { width: 210, height: 297 } as const;

/** Corporate margins for the body of the report. */
export const MARGIN_MM = 20;

/**
 * The appendix keeps the corporate margin, and that is a change of mind.
 *
 * It used to be 15 mm, and the justification was width: a 4:3 landscape photo
 * printed 8.67 cm wide at the old fixed 6.5 cm HEIGHT, and two of those plus a
 * gutter would not fit between 2 cm margins. The 7 cm BOX measured from the
 * template removes that constraint — the widest a photograph can now print is
 * 7 cm, and two 7 cm photos plus the gutter need 15 cm of a 17 cm text column.
 * There is nothing left for a narrower appendix margin to buy, so the appendix
 * uses the same 2 cm as the rest of the report, which is also the template's own
 * `w:pgMar` (1134 twips a side).
 *
 * The constant survives rather than being deleted because the generators name
 * the appendix section's margin explicitly, and a reader of that code should not
 * have to know whether it happens to equal the body's.
 */
export const APPENDIX_MARGIN_MM = MARGIN_MM;

/**
 * The side of the square every appendix photograph is fitted inside — the
 * measured 7.00 cm of the corporate template. It bounds width AND height, which
 * is why it is not called a height any more.
 */
export const PHOTO_BOX_MM = 70;

export const COLUMNS = 2;

/** Space between the two columns. */
export const COLUMN_GUTTER_MM = 6;

/**
 * Caption block under each photo.
 *
 * The template's captions are a single centred Arial 10pt line, which occupies
 * about 4.1 mm; 8 mm is two of them, so a caption that wraps still does not push
 * the row over its budget.
 */
export const CAPTION_BLOCK_MM = 8;

/**
 * Slack under a caption before the next row's photograph.
 *
 * The template's appendix table asks for none — its cells have no vertical
 * padding — so this is not a design gap but rounding room between Word's line
 * metrics and this arithmetic.
 */
export const ROW_GAP_MM = 2;

/**
 * What the "Appendix 1 - Pictures" heading costs on the first appendix page:
 * one 10.5pt bold line and the blank paragraph under it.
 */
export const HEADING_MM = 9;

export interface AppendixGeometry {
  /** Usable width between the margins. */
  contentWidthMm: number;
  /** Usable height between the margins. */
  contentHeightMm: number;
  /** Width of one photo cell. */
  columnWidthMm: number;
  /** Photo + caption + gap. */
  rowHeightMm: number;
  /** Rows that fit on the first page, which carries the heading. */
  rowsFirstPage: number;
  /** Rows that fit on every page after it. */
  rowsPerPage: number;
}

export function appendixGeometry(): AppendixGeometry {
  const contentWidthMm = PAGE.width - APPENDIX_MARGIN_MM * 2;
  const contentHeightMm = PAGE.height - APPENDIX_MARGIN_MM * 2;
  const columnWidthMm = (contentWidthMm - COLUMN_GUTTER_MM * (COLUMNS - 1)) / COLUMNS;
  const rowHeightMm = PHOTO_BOX_MM + CAPTION_BLOCK_MM + ROW_GAP_MM;

  return {
    contentWidthMm,
    contentHeightMm,
    columnWidthMm,
    rowHeightMm,
    rowsFirstPage: Math.max(1, Math.floor((contentHeightMm - HEADING_MM) / rowHeightMm)),
    rowsPerPage: Math.max(1, Math.floor(contentHeightMm / rowHeightMm)),
  };
}

export interface AppendixPage<T> {
  /** 1-based, for "Page 2 of 4" in the preview. */
  pageNumber: number;
  /** Each row holds one or two photos; the last row of the last page may hold one. */
  rows: T[][];
}

export interface AppendixPlan<T> {
  pages: AppendixPage<T>[];
  geometry: AppendixGeometry;
  /** Total photos laid out. */
  photoCount: number;
  /** Rows the whole appendix needs, across every page. */
  totalRows: number;
  /**
   * Set when the caller asked for more rows on one page than A4 allows —
   * README §16's warning. Null when the requested layout fits.
   */
  warning: string | null;
}

/**
 * Lay photos out two-up, top to bottom, paginating when the page is full.
 *
 * `requestedRowsPerPage` is the brief's twelve. It is honoured only when it
 * actually fits; otherwise the plan uses what fits and reports why, because a
 * silently shrunk photo is a worse answer than an extra page.
 */
export function planAppendix<T>(
  photos: readonly T[],
  requestedRowsPerPage?: number,
): AppendixPlan<T> {
  const geometry = appendixGeometry();

  const rows: T[][] = [];
  for (let index = 0; index < photos.length; index += COLUMNS) {
    rows.push(photos.slice(index, index + COLUMNS) as T[]);
  }

  let warning: string | null = null;
  if (requestedRowsPerPage !== undefined && requestedRowsPerPage > geometry.rowsPerPage) {
    warning =
      `${requestedRowsPerPage} rows per page do not fit on A4 inside the required ` +
      `${PHOTO_BOX_MM / 10} cm photo box — ${geometry.rowsPerPage} fit, so the ` +
      "appendix continues on further pages rather than shrinking the photographs.";
  }

  const pages: AppendixPage<T>[] = [];
  let cursor = 0;
  let pageNumber = 1;

  while (cursor < rows.length) {
    const capacity = pageNumber === 1 ? geometry.rowsFirstPage : geometry.rowsPerPage;
    pages.push({ pageNumber, rows: rows.slice(cursor, cursor + capacity) });
    cursor += capacity;
    pageNumber += 1;
  }

  return {
    pages,
    geometry,
    photoCount: photos.length,
    totalRows: rows.length,
    warning,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Units
// ─────────────────────────────────────────────────────────────────────────────

/** Millimetres → twentieths of a point, which is what `docx` measures in. */
export function mmToTwip(mm: number): number {
  return Math.round((mm / 25.4) * 1440);
}

/** Millimetres → points, for image sizing in `docx`. */
export function mmToPt(mm: number): number {
  return (mm / 25.4) * 72;
}

/**
 * The printed size of one photo, in points, fitted inside the 7 cm box.
 *
 * Aspect ratio is preserved, so a landscape photograph touches the box's width
 * and a portrait one its height — which is exactly the 7.00 x 5.25 cm and
 * 5.25 x 7.00 cm pair measured in the corporate template. An extreme panorama is
 * bounded by the box's width and simply prints short; it is never widened to fill
 * the column, because the template's grid is a square of fixed size and not a
 * column to be filled.
 *
 * `columnWidthMm` still bounds the result, for the case where a future template
 * asks for narrower columns than the box.
 */
export function photoBoxPt(
  naturalWidth: number,
  naturalHeight: number,
  columnWidthMm: number,
): { width: number; height: number } {
  const boxPt = mmToPt(PHOTO_BOX_MM);
  const maxWidthPt = Math.min(boxPt, mmToPt(columnWidthMm));

  // A photo with unknown dimensions is treated as 4:3, the commonest shape a
  // phone or compact camera produces, rather than stretched to the box.
  const ratio =
    naturalWidth > 0 && naturalHeight > 0 ? naturalWidth / naturalHeight : 4 / 3;

  if (ratio >= 1) {
    // Landscape (and square): the width is the binding side.
    const width = maxWidthPt;
    return { width, height: width / ratio };
  }

  // Portrait: the height is the binding side, unless that would overflow a
  // column narrower than the box.
  const height = Math.min(boxPt, maxWidthPt / ratio);
  return { width: height * ratio, height };
}
