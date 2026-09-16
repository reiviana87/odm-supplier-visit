"use client";

import { useId, useMemo, useState, type CSSProperties } from "react";

import { Blueprint } from "@/components/ui/blueprint";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { EmptyState, EMPTY_STATE_COPY } from "@/components/ui/states";
import { IMAGE_REGION_GEOMETRY, type ReportPhoto } from "@/types/domain";

/**
 * Appendix Layout & Preview — README §14, screen 12.
 *
 * Left: the controls. Right: a 210px "Page geometry" column (border-left,
 * padding-left 16px) that shows the arithmetic rather than a verdict. Below:
 * the paginated page previews.
 *
 * **Validation warning, never silent resizing.** When the requested rows do
 * not fit the column height the user is told what was asked, what fits, and is
 * offered the two explicit choices. The app never shrinks an image on its own
 * (README §14, "Image rules").
 */

/* ───────────────────────────────────────────────────────────────────────────
   The arithmetic. Transcribed from the approved prototype,
   `design-handoff/ODM Supplier Visit.dc.html` lines 3140..3146:

     const rowH   = apxH + 0.55;
     const avail  = 25.7;
     const needed = (s.appendixRows / 2) * rowH;
     const maxRows = Math.floor(avail / rowH) * 2;
     const fits   = needed <= avail;

   The literal `2` there is the appendix column count, which the prototype
   never varies; README §14 exposes Columns 1–3, so it is `columns` here.
   ─────────────────────────────────────────────────────────────────────────── */

/** The caption row the corporate template reserves under each image row. */
const CAPTION_ROW_CM = 0.55;
/** Usable column height: the A4 text box is 17.0 × 25.7 cm. */
const USABLE_COLUMN_HEIGHT_CM = 25.7;

const HEIGHT_MIN_CM = 4;
const HEIGHT_MAX_CM = 8;
const HEIGHT_STEP_CM = 0.5;
const ROWS_MAX = 16;

/**
 * Preview scale. The prototype draws its 6.5 cm cell 78px tall (line 2081),
 * so one centimetre of print is 12 screen pixels.
 */
const PREVIEW_PX_PER_CM = 12;

const SORT_OPTIONS = [
  { id: "manual", label: "Manual order" },
  { id: "capture", label: "Capture time" },
  { id: "category", label: "Category" },
] as const;

type SortOption = (typeof SORT_OPTIONS)[number]["id"];

function isSortOption(value: string): value is SortOption {
  return SORT_OPTIONS.some((option) => option.id === value);
}

/* ───────────────────────────────────────────────────────────────────────────
   Styles measured from the prototype
   ─────────────────────────────────────────────────────────────────────────── */

const KICKER: CSSProperties = {
  font: "10px var(--font-body)",
  letterSpacing: ".12em",
  textTransform: "uppercase",
  color: "var(--color-neutral-600)",
  marginBottom: 7,
};

/** Prototype line 1513 — the 210px geometry column. */
const GEOMETRY_COLUMN: CSSProperties = {
  width: 210,
  flex: "none",
  borderLeft: "1px solid var(--color-divider)",
  paddingLeft: 16,
};

/** Prototype line 2044 — the range control strips the `.input` chrome. */
const RANGE_INPUT: CSSProperties = {
  padding: 0,
  minHeight: 24,
  background: "transparent",
  border: 0,
  accentColor: "var(--color-accent)",
};

/** Prototype line 3275 — the fit warning band. */
const WARNING_CARD: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 9,
  padding: "10px 12px",
  border: "1px solid var(--color-warning-border)",
  background: "var(--color-warning-bg)",
};

/** Prototype line 3276 — the band shown when the request does fit. */
const OK_CARD: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  padding: "10px 12px",
  border: "1px solid var(--color-accent-300)",
  background: "var(--color-accent-100)",
};

export interface AppendixLayoutProps {
  /** The appendix photos, already in print order. */
  photos: readonly ReportPhoto[];
  /** Named in the preview header so it is clear which report is being laid out. */
  documentNumber: string;
}

function GeometryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline" style={{ gap: 8 }}>
      <span style={{ flex: 1, color: "var(--color-neutral-700)" }}>{label}</span>
      <span style={{ flex: "none", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
    </div>
  );
}

export function AppendixLayout({ photos, documentNumber }: AppendixLayoutProps) {
  const geometry = IMAGE_REGION_GEOMETRY.APPENDIX_IMAGES;
  const columnsLabelId = useId();

  const [columns, setColumns] = useState<number>(geometry.columns);
  const [targetHeightCm, setTargetHeightCm] = useState<number>(
    geometry.targetHeightCm,
  );
  /**
   * Rows per page counts image cells, not grid rows — the prototype's
   * `appendixRows` of 12 is six 2-up rows (line 2386). Keeping it a whole
   * multiple of `columns` keeps the page grid rectangular and keeps both
   * warning choices applicable. [INFERRED]
   */
  const [rowsPerPage, setRowsPerPage] = useState<number>(12);
  const [sort, setSort] = useState<SortOption>("manual");
  const [category, setCategory] = useState<string>("all");

  const categories = useMemo(() => {
    const seen = new Set<string>();
    for (const photo of photos) {
      if (photo.category) seen.add(photo.category);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [photos]);

  const ordered = useMemo(() => {
    const filtered =
      category === "all"
        ? [...photos]
        : photos.filter((photo) => photo.category === category);

    if (sort === "capture") {
      return filtered.sort((a, b) =>
        (a.capturedAt ?? "").localeCompare(b.capturedAt ?? ""),
      );
    }
    if (sort === "category") {
      return filtered.sort(
        (a, b) =>
          a.category.localeCompare(b.category) || a.sortOrder - b.sortOrder,
      );
    }
    return filtered.sort((a, b) => a.sortOrder - b.sortOrder);
  }, [photos, category, sort]);

  // ── the arithmetic ────────────────────────────────────────────────────────
  const rowHeightCm = targetHeightCm + CAPTION_ROW_CM;
  const neededCm = (rowsPerPage / columns) * rowHeightCm;
  const gridRowsThatFit = Math.floor(USABLE_COLUMN_HEIGHT_CM / rowHeightCm);
  const maxRowsPerPage = gridRowsThatFit * columns;
  const fits = neededCm <= USABLE_COLUMN_HEIGHT_CM;

  /** The tallest image that would let the requested rows fit, on the 0.5 step. */
  const maxTargetHeightCm =
    Math.floor(
      ((USABLE_COLUMN_HEIGHT_CM * columns) / rowsPerPage - CAPTION_ROW_CM) /
        HEIGHT_STEP_CM,
    ) * HEIGHT_STEP_CM;
  const heightChoiceIsPossible = maxTargetHeightCm >= HEIGHT_MIN_CM;

  const rowsMax = Math.floor(ROWS_MAX / columns) * columns;

  function changeColumns(next: number) {
    setColumns(next);
    // Keep the page grid rectangular under the new column count.
    const rows = Math.max(next, Math.round(rowsPerPage / next) * next);
    setRowsPerPage(Math.min(rows, Math.floor(ROWS_MAX / next) * next));
  }

  const pages = useMemo(() => {
    const size = Math.max(1, rowsPerPage);
    const result: ReportPhoto[][] = [];
    for (let i = 0; i < ordered.length; i += size) {
      result.push(ordered.slice(i, i + size));
    }
    return result;
  }, [ordered, rowsPerPage]);

  const cellHeight = Math.round(targetHeightCm * PREVIEW_PX_PER_CM);

  return (
    <div>
      <Blueprint style={{ padding: 16, marginBottom: 18 }}>
        <div className="flex items-start" style={{ gap: 20 }}>
          {/* ── controls ───────────────────────────────────────────────── */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={KICKER}>Layout</div>

            <div role="group" aria-labelledby={columnsLabelId} style={{ marginBottom: 12 }}>
              <span
                id={columnsLabelId}
                style={{
                  display: "block",
                  fontSize: 12,
                  marginBottom: 5,
                  color: "color-mix(in srgb, var(--color-text) 70%, transparent)",
                }}
              >
                Columns
              </span>
              <div className="flex" style={{ gap: 6 }}>
                {[1, 2, 3].map((option) => {
                  const active = option === columns;
                  return (
                    <Button
                      key={option}
                      size="compact"
                      aria-pressed={active}
                      onClick={() => changeColumns(option)}
                      style={{
                        background: active
                          ? "var(--color-accent-100)"
                          : undefined,
                        borderColor: active ? "var(--color-accent)" : undefined,
                        color: active ? "var(--color-accent-800)" : undefined,
                      }}
                    >
                      {option} {option === 1 ? "column" : "columns"}
                    </Button>
                  );
                })}
              </div>
            </div>

            <Field
              label={`Target height — ${targetHeightCm.toFixed(1)} cm`}
              hint={`The appendix requirement is ${geometry.targetHeightCm.toFixed(1)} cm.`}
              style={{ marginBottom: 12 }}
            >
              <Input
                type="range"
                min={HEIGHT_MIN_CM}
                max={HEIGHT_MAX_CM}
                step={HEIGHT_STEP_CM}
                value={targetHeightCm}
                onChange={(event) =>
                  setTargetHeightCm(Number(event.target.value))
                }
                style={RANGE_INPUT}
              />
            </Field>

            <Field
              label={`Rows per page — ${rowsPerPage} images`}
              hint={`${rowsPerPage / columns} rows of ${columns}.`}
              style={{ marginBottom: 12 }}
            >
              <Input
                type="range"
                min={columns}
                max={rowsMax}
                step={columns}
                value={rowsPerPage}
                onChange={(event) => setRowsPerPage(Number(event.target.value))}
                style={RANGE_INPUT}
              />
            </Field>

            <div className="flex flex-wrap" style={{ gap: 10, marginBottom: 14 }}>
              <Field label="Sort" style={{ flex: 1, minWidth: 150 }}>
                <Select
                  compact
                  value={sort}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (isSortOption(next)) setSort(next);
                  }}
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Filter" style={{ flex: 1, minWidth: 150 }}>
                <Select
                  compact
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  <option value="all">All categories</option>
                  {categories.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {fits ? (
              <div style={OK_CARD}>
                <Icon
                  name="check"
                  size={15}
                  strokeWidth={1.8}
                  style={{ flex: "none", color: "var(--color-accent-800)" }}
                />
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    lineHeight: 1.5,
                    color: "var(--color-accent-900)",
                  }}
                >
                  Fits the template · {neededCm.toFixed(1)} cm of{" "}
                  {USABLE_COLUMN_HEIGHT_CM.toFixed(1)} cm used
                </p>
              </div>
            ) : (
              <div role="alert" style={WARNING_CARD}>
                <Icon
                  name="alert"
                  size={15}
                  style={{
                    marginTop: 2,
                    flex: "none",
                    color: "var(--color-warning-ink)",
                  }}
                />
                <div style={{ fontSize: 12, lineHeight: 1.55 }}>
                  <p style={{ margin: 0, color: "var(--color-warning-ink)" }}>
                    <strong style={{ fontWeight: 500 }}>
                      Does not fit the template.
                    </strong>{" "}
                    {rowsPerPage} images per page at {targetHeightCm.toFixed(1)} cm
                    need {neededCm.toFixed(1)} cm of column height; the text box
                    is {USABLE_COLUMN_HEIGHT_CM.toFixed(1)} cm. What fits is{" "}
                    {maxRowsPerPage} images per page at this height. Nothing has
                    been resized — choose one:
                  </p>
                  <div className="flex flex-wrap" style={{ gap: 6, marginTop: 9 }}>
                    <Button
                      size="compact"
                      onClick={() => setRowsPerPage(maxRowsPerPage)}
                      style={{ background: "var(--color-bg)" }}
                    >
                      Reduce to {maxRowsPerPage} per page
                    </Button>
                    <Button
                      size="compact"
                      disabled={!heightChoiceIsPossible}
                      title={
                        heightChoiceIsPossible
                          ? undefined
                          : `${rowsPerPage} images per page would need ${maxTargetHeightCm.toFixed(1)} cm images, below the ${HEIGHT_MIN_CM.toFixed(1)} cm minimum.`
                      }
                      onClick={() => setTargetHeightCm(maxTargetHeightCm)}
                      style={{ background: "var(--color-bg)" }}
                    >
                      Reduce height to {maxTargetHeightCm.toFixed(1)} cm
                    </Button>
                  </div>
                  {heightChoiceIsPossible ? null : (
                    <p
                      style={{
                        margin: "7px 0 0",
                        color: "var(--color-warning-ink)",
                      }}
                    >
                      At {rowsPerPage} images per page the image would have to
                      drop below {HEIGHT_MIN_CM.toFixed(1)} cm, so fewer images
                      per page — or a template with smaller margins — is the
                      only way to keep {geometry.targetHeightCm.toFixed(1)} cm.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── page geometry ──────────────────────────────────────────── */}
          <div style={GEOMETRY_COLUMN}>
            <div style={KICKER}>Page geometry</div>
            <div
              style={{
                fontSize: 12,
                lineHeight: 1.75,
                color: "var(--color-neutral-800)",
              }}
            >
              <GeometryRow label="A4 portrait" value="21.0 × 29.7 cm" />
              <GeometryRow label="Text box" value="17.0 × 25.7 cm" />
              <GeometryRow
                label="Usable height"
                value={`${USABLE_COLUMN_HEIGHT_CM.toFixed(1)} cm`}
              />
              <div
                style={{
                  borderTop: "1px solid var(--color-divider)",
                  margin: "7px 0",
                }}
              />
              <GeometryRow
                label="Image height"
                value={`${targetHeightCm.toFixed(1)} cm`}
              />
              <GeometryRow
                label="Caption row"
                value={`${CAPTION_ROW_CM.toFixed(2)} cm`}
              />
              <GeometryRow
                label="Row height"
                value={`${rowHeightCm.toFixed(2)} cm`}
              />
              <div
                style={{
                  borderTop: "1px solid var(--color-divider)",
                  margin: "7px 0",
                }}
              />
              <GeometryRow
                label="Rows that fit"
                value={`${gridRowsThatFit} × ${columns}`}
              />
              <GeometryRow label="Maximum per page" value={`${maxRowsPerPage}`} />
              <GeometryRow
                label="Requested"
                value={`${rowsPerPage} · ${neededCm.toFixed(1)} cm`}
              />
            </div>
          </div>
        </div>
      </Blueprint>

      {/* ── page previews ────────────────────────────────────────────────── */}
      <div className="flex items-center" style={{ gap: 9, marginBottom: 9 }}>
        <div style={{ ...KICKER, flex: 1, marginBottom: 0 }}>
          Appendix preview · {documentNumber}
        </div>
        <span style={{ fontSize: 11.5, color: "var(--color-neutral-600)" }}>
          {ordered.length} {ordered.length === 1 ? "photo" : "photos"} ·{" "}
          {pages.length} {pages.length === 1 ? "page" : "pages"}
        </span>
      </div>

      {pages.length === 0 ? (
        <EmptyState message={EMPTY_STATE_COPY.noImages} />
      ) : (
        <div className="flex flex-col" style={{ gap: 14 }}>
          {pages.map((page, pageIndex) => (
            <div key={pageIndex}>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--color-neutral-600)",
                  marginBottom: 5,
                }}
              >
                Page {pageIndex + 1}
              </div>
              <Blueprint style={{ padding: "16px 14px", background: "#fff" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                    gap: 10,
                  }}
                >
                  {page.map((photo) => {
                    const caption = photo.caption.trim();
                    return (
                      <div key={photo.id}>
                        {/* eslint-disable-next-line @next/next/no-img-element --
                            the appendix cell is sized in print centimetres, not
                            in intrinsic pixels; the SVG placeholders carry no
                            intrinsic size for next/image to reason about. */}
                        <img
                          src={photo.src}
                          alt=""
                          loading="lazy"
                          style={{
                            width: "100%",
                            height: cellHeight,
                            objectFit: "cover",
                            border: "1px solid var(--color-neutral-300)",
                            display: "block",
                          }}
                        />
                        <div
                          style={{
                            fontSize: 9,
                            lineHeight: 1.3,
                            marginTop: 2,
                            textAlign: "center",
                            color: caption
                              ? undefined
                              : "var(--color-danger-ink)",
                          }}
                        >
                          {caption || "Caption required"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Blueprint>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
