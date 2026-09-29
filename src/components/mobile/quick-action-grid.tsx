"use client";

import type { CSSProperties } from "react";

import { Blueprint } from "@/components/ui/blueprint";
import { Icon, type IconName } from "@/components/ui/icon";

/**
 * Visit Mode home — README §17, prototype lines 2200..2222.
 *
 *   tiles     2-up grid · gap 10 · min-height 84 · padding 13px 12px
 *             1px var(--color-divider) · 19px accent-700 icon over a 13.5px
 *             label · hover accent-100 / accent-300
 *   counters  3-up grid · gap 8 · blueprint padding 9px 10px ·
 *             9.5px/.1em uppercase label over Barlow Condensed 600 23px
 *   last shots  "LAST PHOTOS" 10px/.12em label + a 3-up grid of 70px images
 *
 * The home grid is the navigation: README §17 — "Bottom navigation — not used;
 * the home grid is the navigation. Keep it that way."
 */

/** The six tiles, in prototype order (line 3299). */
export type QuickActionId =
  | "photo"
  | "note"
  | "observation"
  | "upload"
  | "voice"
  | "report";

interface QuickAction {
  id: QuickActionId;
  label: string;
  icon: IconName;
}

const ACTIONS: readonly QuickAction[] = [
  { id: "photo", label: "Take Photo", icon: "camera" },
  { id: "note", label: "Add Note", icon: "note" },
  { id: "observation", label: "Add Observation", icon: "list" },
  { id: "upload", label: "Upload File", icon: "upload" },
  { id: "voice", label: "Voice / Transcript", icon: "mic" },
  { id: "report", label: "View Report", icon: "file" },
];

/** 9.5px / .1em uppercase — the counter caption (prototype line 2210). */
const COUNTER_LABEL: CSSProperties = {
  font: "9.5px var(--font-body)",
  letterSpacing: ".1em",
  textTransform: "uppercase",
  color: "var(--color-neutral-600)",
};

/** 10px / .12em uppercase — the section caption (prototype line 2214). */
const SECTION_LABEL: CSSProperties = {
  font: "10px var(--font-body)",
  letterSpacing: ".12em",
  textTransform: "uppercase",
  color: "var(--color-neutral-600)",
  marginBottom: 7,
};

export interface VisitPhoto {
  id: string;
  src: string;
  caption: string;
}

export interface QuickActionGridProps {
  counters: { photos: number; notes: number; observations: number };
  lastPhotos: readonly VisitPhoto[];
  onAction: (action: QuickActionId) => void;
  /**
   * Open the Photos screen.
   *
   * The strip is the affordance rather than a seventh tile: the approved grid
   * is six, and a row of photographs that cannot be tapped is a dead end the
   * user finds on their own.
   */
  onOpenPhotos: () => void;
}

export function QuickActionGrid({
  counters,
  lastPhotos,
  onAction,
  onOpenPhotos,
}: QuickActionGridProps) {
  return (
    <div style={{ padding: "14px 16px 20px", flex: 1 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 16,
        }}
      >
        {ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => onAction(action.id)}
            className="vm-tile"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 9,
              padding: "13px 12px",
              minHeight: 84,
              border: "1px solid var(--color-divider)",
              background: "transparent",
              cursor: "pointer",
              textAlign: "left",
              font: "13.5px var(--font-body)",
              color: "var(--color-text)",
            }}
          >
            <Icon
              name={action.icon}
              size={19}
              style={{ color: "var(--color-accent-700)" }}
            />
            <span>{action.label}</span>
          </button>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <Counter label="Photos" value={counters.photos} />
        <Counter label="Notes" value={counters.notes} />
        <Counter label="Obs." value={counters.observations} />
      </div>

      <div style={SECTION_LABEL}>Last photos</div>
      {lastPhotos.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--color-neutral-600)", margin: 0 }}>
          None yet on this visit.
        </p>
      ) : (
        <button
          type="button"
          onClick={onOpenPhotos}
          aria-label={`Open all ${counters.photos} photographs`}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 6,
            width: "100%",
            padding: 0,
            border: 0,
            background: "none",
            cursor: "pointer",
          }}
        >
          {lastPhotos.map((photo) => (
            /* eslint-disable-next-line @next/next/no-img-element -- stored
               photographs behind signed URLs, no known intrinsic size. */
            <img
              key={photo.id}
              src={photo.src}
              alt={photo.caption}
              style={{
                width: "100%",
                height: 70,
                objectFit: "cover",
                border: "1px solid var(--color-divider)",
              }}
            />
          ))}
        </button>
      )}
    </div>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <Blueprint style={{ padding: "9px 10px" }}>
      <div style={COUNTER_LABEL}>{label}</div>
      <div
        style={{
          fontFamily: "var(--font-heading)",
          fontWeight: 600,
          fontSize: 23,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
    </Blueprint>
  );
}
