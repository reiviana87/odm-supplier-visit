"use client";

import type { CSSProperties, ReactNode } from "react";

import { Tag } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IMAGE_REGION_GEOMETRY, type ImageRegion } from "@/types/domain";

/**
 * Photo manager toolbar — README §9–11.
 *
 * "Toolbar (Upload Images, Generate all captions, selection/arrange actions,
 * right-aligned meta: `{n} images · region MAIN_PRODUCT_IMAGES · 2 columns,
 * 7.0 cm`)". Prototype lines 979..985 (product) and 1278..1288 (appendix).
 *
 * The meta line is built from `IMAGE_REGION_GEOMETRY` — it states the export
 * requirement of the region (README §16), not whatever the Appendix Layout tab
 * is currently being tuned to.
 */
export interface PhotoToolbarProps {
  region: ImageRegion;
  /** Images currently in the region. */
  count: number;
  /** Images with no caption — export completeness (README §10 image rules). */
  missingCaptions: number;
  /** Images holding an unaccepted AI suggestion. */
  awaitingReview: number;
  selectedCount: number;
  allSelected: boolean;
  /**
   * The upload control itself, not a callback.
   *
   * This used to be `onUpload: () => void`, wired to `uploadRef.current?.click()`
   * against a ref that was never attached to anything — so the button did
   * nothing, in every region. Handing the live control down removes the
   * indirection rather than repairing it.
   */
  uploadSlot: ReactNode;
  onGenerateAll: () => void;
  onToggleSelectAll: () => void;
  onArrange: () => void;
  onMoveSelected: () => void;
  onDeleteSelected: () => void;
}

const TOOLBAR_BUTTON: CSSProperties = { fontSize: 12.5 };

/** Prototype line 981 — AI actions carry the accent tint (README §11). */
const AI_BUTTON: CSSProperties = {
  ...TOOLBAR_BUTTON,
  borderColor: "var(--color-accent-300)",
  color: "var(--color-accent-800)",
};

const META_LINE: CSSProperties = {
  fontSize: 11.5,
  color: "var(--color-neutral-600)",
};

const META_REGION: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--color-accent-700)",
};

export function PhotoToolbar({
  region,
  count,
  missingCaptions,
  awaitingReview,
  selectedCount,
  allSelected,
  uploadSlot,
  onGenerateAll,
  onToggleSelectAll,
  onArrange,
  onMoveSelected,
  onDeleteSelected,
}: PhotoToolbarProps) {
  const { columns, targetHeightCm } = IMAGE_REGION_GEOMETRY[region];

  return (
    <div
      className="flex flex-wrap items-center"
      style={{ gap: 8, marginBottom: 12 }}
    >
      {uploadSlot}
      <Button icon="spark" style={AI_BUTTON} onClick={onGenerateAll}>
        Generate all captions
      </Button>
      <Button
        style={TOOLBAR_BUTTON}
        aria-pressed={allSelected}
        onClick={onToggleSelectAll}
        disabled={count === 0}
      >
        {allSelected ? "Clear selection" : "Select All"}
      </Button>
      <Button style={TOOLBAR_BUTTON} onClick={onArrange} disabled={count === 0}>
        Arrange Automatically
      </Button>

      {selectedCount > 0 ? (
        <>
          <Button style={TOOLBAR_BUTTON} onClick={onMoveSelected}>
            Move to section
          </Button>
          <Button
            variant="destructive"
            style={TOOLBAR_BUTTON}
            onClick={onDeleteSelected}
          >
            Delete
          </Button>
          <Tag tone="accent">{selectedCount} selected</Tag>
        </>
      ) : null}

      {awaitingReview > 0 ? (
        <Tag tone="warning">
          {awaitingReview} {awaitingReview === 1 ? "caption" : "captions"} awaiting
          review
        </Tag>
      ) : null}
      {missingCaptions > 0 ? (
        <Tag tone="warning">{missingCaptions} without caption</Tag>
      ) : null}

      <div style={{ flex: 1 }} />

      <span style={META_LINE}>
        {count} {count === 1 ? "image" : "images"} · region{" "}
        <span style={META_REGION}>{region}</span> · {columns}{" "}
        {columns === 1 ? "column" : "columns"}, {targetHeightCm.toFixed(1)} cm
      </span>
    </div>
  );
}
