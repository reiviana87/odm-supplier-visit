"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";

/**
 * After the shutter — README §17 "After the shutter", prototype lines
 * 2246..2267, screenshot 17b.
 *
 *   sheet     padding 13px 16px 16px · border-top 1px var(--color-divider)
 *   thumb     46×46 cover, 1px divider
 *   title     Barlow Condensed 600 14px "Photo {n} captured"
 *   sub       11.5px neutral-600 "{section} · caption optional"
 *   retake    ghost button, 12px, padding 3px 8px
 *   caption   textarea min-height 60 · 13px / 1.45 · padding 8px 10px
 *   starters  five chips, 11.5px, padding 4px 9px, min-height 30 — painted as
 *             approved, with a transparent 44px hit box (`.vm-hit`)
 *   actions   two 44px buttons — "AI caption later" then the save button,
 *             which reads "Save without caption" while the field is empty
 *
 * Saving returns to the viewfinder for the next shot; that transition is owned
 * by `CameraScreen`.
 *
 * The caption field carries no visible `<label>`: the approved sheet labels it
 * with the two lines above the control instead, so the accessible name is
 * supplied through `aria-label` (README §24 asks for a real name, and this one
 * duplicates visible text rather than replacing it).
 */

/** The five one-tap starters (README §17, prototype line 3319). */
const STARTERS: readonly string[] = [
  "Production line",
  "Testing laboratory",
  "Warehouse",
  "Certificate board",
  "Meeting room",
];

export const CAPTION_PLACEHOLDER =
  "Type a caption now — or leave empty and let the AI write it";

export interface CaptionSheetProps {
  /** The frame just captured. */
  src: string;
  /** Sequence number of this photo in the visit. */
  photoNumber: number;
  /** Destination section, e.g. "Appendix Pictures". */
  sectionLabel: string;
  value: string;
  onChange: (value: string) => void;
  onRetake: () => void;
  onAiLater: () => void;
  onSave: () => void;
}

export function CaptionSheet({
  src,
  photoNumber,
  sectionLabel,
  value,
  onChange,
  onRetake,
  onAiLater,
  onSave,
}: CaptionSheetProps) {
  const hasCaption = value.trim().length > 0;

  return (
    <div
      style={{
        padding: "13px 16px 16px",
        borderTop: "1px solid var(--color-divider)",
        background: "var(--color-bg)",
        flex: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- captured frame,
            no known intrinsic size. */}
        <img
          src={src}
          alt={`Photo ${photoNumber}, just captured`}
          style={{
            width: 46,
            height: 46,
            objectFit: "cover",
            border: "1px solid var(--color-divider)",
            flex: "none",
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 14 }}>
            Photo {photoNumber} captured
          </div>
          <div style={{ fontSize: 11.5, color: "var(--color-neutral-600)" }}>
            {sectionLabel} · caption optional
          </div>
        </div>
        <Button
          variant="ghost"
          onClick={onRetake}
          style={{ fontSize: 12, padding: "3px 8px", minHeight: 44 }}
        >
          Retake
        </Button>
      </div>

      <Textarea
        aria-label="Photo caption"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={CAPTION_PLACEHOLDER}
        style={{
          minHeight: 60,
          fontSize: 13,
          lineHeight: 1.45,
          padding: "8px 10px",
          marginBottom: 9,
        }}
      />

      {/* rowGap 14, not the approved 6, is the other half of `.vm-hit`: it puts
          the wrapped rows exactly one hit box apart so the 44px targets tile
          instead of overlapping. The column gap stays at the approved 6. */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          columnGap: 6,
          rowGap: 14,
          marginBottom: 11,
        }}
      >
        {STARTERS.map((starter) => (
          <button
            key={starter}
            type="button"
            // `vm-hit` — the confirmed touch-target decision: the chip keeps its
            // approved 30px appearance and gains a transparent ±7px hit box
            // (44px effective) instead of being enlarged. See phone-frame.tsx.
            className="vm-chip vm-hit"
            onClick={() => onChange(`${starter} — `)}
            style={{
              border: "1px solid var(--color-divider)",
              background: "transparent",
              padding: "4px 9px",
              font: "11.5px var(--font-body)",
              color: "var(--color-text)",
              cursor: "pointer",
              minHeight: 30,
            }}
          >
            {starter}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <Button
          variant="secondary"
          onClick={onAiLater}
          style={{ flex: 1, fontSize: 12.5, minHeight: 44 }}
        >
          AI caption later
        </Button>
        <Button
          variant="primary"
          onClick={onSave}
          style={{ flex: 1, fontSize: 12.5, minHeight: 44 }}
        >
          {hasCaption ? "Save caption" : "Save without caption"}
        </Button>
      </div>
    </div>
  );
}
