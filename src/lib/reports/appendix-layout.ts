/**
 * Appendix pagination — README §16, and the arithmetic the DOCX export obeys.
 *
 * The business brief asks for twelve alternating photo/caption rows. On A4 that
 * is not a layout, it is a wish: a 6.5 cm photo with its caption underneath
 * occupies roughly 7.6 cm of column height, so three rows fill the printable
 * area and twelve would need four pages. The brief is explicit that the photo
 * height is the requirement and the row count is not, so this module keeps
 * 6.5 cm fixed, keeps two columns, and paginates instead of shrinking.
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
 * The appendix gets its own, narrower margin, and the reason is arithmetic.
 *
 * A 4:3 landscape photograph — what a phone or a compact camera produces, so
 * most of what a visit collects — is 8.67 cm wide at the required 6.5 cm
 * height. Two of those plus a gutter need 18 cm of page, which 2 cm margins do
 * not leave. Keeping 2 cm here would quietly bound every landscape photo by
 * width and print it at 6.1 cm, which is exactly the silent shrink §16 forbids.
 *
 * 1.5 cm is still a normal corporate margin — wider than Word's own "Narrow"
 * preset — and it is applied only to the appendix section, so the text pages
 * keep their 2 cm.
 */
export const APPENDIX_MARGIN_MM = 15;

/** README §16 — the export requirement, not a preference. */
export const PHOTO_HEIGHT_MM = 65;

export const COLUMNS = 2;

/** Space between the two columns. */
export const COLUMN_GUTTER_MM = 6;

/** Caption block under each photo: two 9pt lines plus the gap above them. */
export const CAPTION_BLOCK_MM = 11;

/** Breathing room under a caption before the next row's photo. */
export const ROW_GAP_MM = 5;

/** The "Appendix" heading only costs height on the first page. */
export const HEADING_MM = 14;

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
  const rowHeightMm = PHOTO_HEIGHT_MM + CAPTION_BLOCK_MM + ROW_GAP_MM;

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
      `${requestedRowsPerPage} rows per page do not fit on A4 at the required ` +
      `${PHOTO_HEIGHT_MM / 10} cm photo height — ${geometry.rowsPerPage} fit, so the ` +
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
 * The printed size of one photo, in points, at the required height.
 *
 * Aspect ratio is preserved. A photo wider than the column is bounded by the
 * column instead, which is the only case where the height drops below 6.5 cm —
 * and it drops because the page cannot be wider, not to fit more rows in.
 */
export function photoBoxPt(
  naturalWidth: number,
  naturalHeight: number,
  columnWidthMm: number,
): { width: number; height: number } {
  const maxHeightPt = mmToPt(PHOTO_HEIGHT_MM);
  const maxWidthPt = mmToPt(columnWidthMm);

  // A photo with unknown dimensions is treated as 4:3, the commonest shape a
  // phone or compact camera produces, rather than stretched to the box.
  const ratio =
    naturalWidth > 0 && naturalHeight > 0 ? naturalWidth / naturalHeight : 4 / 3;

  const height = maxHeightPt;
  const width = height * ratio;

  if (width <= maxWidthPt) return { width, height };
  return { width: maxWidthPt, height: maxWidthPt / ratio };
}
