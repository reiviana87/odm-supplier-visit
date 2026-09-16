"use client";

import type { CSSProperties } from "react";

import { Blueprint } from "@/components/ui/blueprint";
import { Button, IconButton } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { ProgressBar } from "@/components/ui/progress";
import type { ReportPhoto } from "@/types/domain";

/**
 * Photo card — README §4 "Photo card", §10 "Photo management UX".
 *
 *   `.blueprint`, padding 0, background --color-neutral-100
 *   image height 150px, object-fit cover, overlay index tag top-left
 *   body padding 8px 9px 9px — caption textarea (11.5px/1.4) + action row
 *
 * Prototype lines 986..1002 (product), 1211..1240 (partner, the AI-suggested
 * treatment) and 1294..1311 (appendix, the dense action row).
 *
 * The six approved states all render here: default · AI-suggested · accepted ·
 * selected · uploading · failed.
 */

/** Everything the card can ask its owner to do beyond editing the caption. */
export type PhotoCardAction =
  | "rewrite"
  | "analyze"
  | "replace"
  | "download"
  | "delete"
  | "reorder"
  | "retry";

export interface PhotoCardProps {
  photo: ReportPhoto;
  /** 1-based position inside the region — the "01" overlay tag, and print order. */
  index: number;
  /** Appendix cards carry the drag handle: order is the Word print order (§10). */
  showDragHandle?: boolean;
  /** README §4 — selected is a 2px accent outline drawn inside the frame. */
  selected?: boolean;
  onCaptionChange: (id: string, caption: string) => void;
  onAcceptCaption: (id: string) => void;
  onAction: (action: PhotoCardAction, photo: ReportPhoto) => void;
}

/** README §10 — below this the card says "· review required" in warning ink. */
const CONFIDENCE_REVIEW_THRESHOLD = 85;

/** Prototype line 991 — the monospace index chip on the accent-900 ground. */
const INDEX_TAG: CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  background: "var(--color-accent-900)",
  color: "#fff",
  fontSize: 10,
  padding: "2px 6px",
  fontFamily: "var(--font-mono)",
};

/** Prototype line 992 — the category chip, page ground at 92%. */
const CATEGORY_TAG: CSSProperties = {
  position: "absolute",
  top: 0,
  right: 0,
  background: "color-mix(in srgb, var(--color-bg) 92%, transparent)",
  fontSize: 9.5,
  padding: "2px 6px",
  letterSpacing: ".06em",
  textTransform: "uppercase",
};

/** Prototype line 1299 — the drag handle badge, accent-900 at 82%. */
const HANDLE_BADGE: CSSProperties = {
  position: "absolute",
  bottom: 0,
  left: 0,
  display: "flex",
  padding: "3px 5px",
  border: 0,
  cursor: "grab",
  background: "color-mix(in srgb, var(--color-accent-900) 82%, transparent)",
  color: "#fff",
};

/** README §4 — caption textarea: 11.5px / 1.4 on the page ground. */
const CAPTION_TEXTAREA: CSSProperties = {
  minHeight: 42,
  fontSize: 11.5,
  lineHeight: 1.4,
  padding: "5px 7px",
  background: "var(--color-bg)",
};

/** README §4 — the action row runs at 10.5px. */
const ACTION_BUTTON: CSSProperties = {
  fontSize: 10.5,
  padding: "2px 6px",
  minHeight: 0,
};

const STATUS_LINE: CSSProperties = {
  fontSize: 10,
  letterSpacing: ".06em",
  textTransform: "uppercase",
};

function confidenceLine(photo: ReportPhoto): { text: string; color: string } {
  const confident = photo.confidence >= CONFIDENCE_REVIEW_THRESHOLD;
  return {
    text: confident
      ? `AI · ${photo.confidence}% confidence`
      : `AI · ${photo.confidence}% · review required`,
    color: confident ? "var(--color-accent-700)" : "var(--color-warning-strong)",
  };
}

/**
 * README §24 — "photographs carry their caption as `alt`". A photo still
 * waiting for a caption gets a factual description instead; the unaccepted AI
 * suggestion is never presented as if it were the caption. [INFERRED]
 */
function altText(photo: ReportPhoto, label: string): string {
  const caption = photo.caption.trim();
  if (caption.length > 0) return caption;
  return `Visit photograph ${label} — ${photo.category}, caption not written yet`;
}

export function PhotoCard({
  photo,
  index,
  showDragHandle = false,
  selected = false,
  onCaptionChange,
  onAcceptCaption,
  onAction,
}: PhotoCardProps) {
  const label = String(index).padStart(2, "0");
  const uploading = photo.uploadState === "uploading";
  const failed = photo.uploadState === "failed";
  const hasCaption = photo.caption.trim().length > 0;
  const suggested =
    !uploading &&
    !failed &&
    photo.captionState === "suggested" &&
    photo.aiCaption.trim().length > 0;
  const confidence = confidenceLine(photo);

  return (
    <Blueprint
      style={{
        padding: 0,
        background: "var(--color-neutral-100)",
        // README §4 — selected is a 2px accent outline; drawn inside the frame
        // so it never collides with the registration marks.
        outline: selected ? "2px solid var(--color-accent)" : undefined,
        outlineOffset: selected ? -2 : undefined,
      }}
    >
      <div style={{ position: "relative" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- the seed ships
            SVG placeholders of unknown intrinsic size, so next/image has no
            width/height to work from; the approved card is an explicit 150px
            box with object-fit:cover, which a plain <img> states honestly. */}
        <img
          src={photo.src}
          alt={altText(photo, label)}
          loading="lazy"
          style={{
            width: "100%",
            height: 150,
            objectFit: "cover",
            display: "block",
            opacity: uploading || failed ? 0.45 : 1,
          }}
        />
        <span style={INDEX_TAG}>{label}</span>
        {photo.category ? <span style={CATEGORY_TAG}>{photo.category}</span> : null}
        {showDragHandle && !uploading && !failed ? (
          <button
            type="button"
            aria-label={`Reorder image ${label}`}
            title="Drag to reorder"
            onClick={() => onAction("reorder", photo)}
            style={HANDLE_BADGE}
          >
            <Icon name="grip" size={12} />
          </button>
        ) : null}
        {uploading ? (
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
            {/* README §23 — image upload shows per-card progress over the thumbnail. */}
            <ProgressBar indeterminate label={`Uploading image ${label}`} />
          </div>
        ) : null}
      </div>

      <div style={{ padding: "8px 9px 9px" }}>
        {uploading ? (
          <p
            aria-live="polite"
            style={{ ...STATUS_LINE, margin: 0, color: "var(--color-neutral-600)" }}
          >
            Uploading…
          </p>
        ) : failed ? (
          <div role="alert">
            <p
              style={{
                margin: 0,
                fontSize: 11.5,
                lineHeight: 1.45,
                color: "var(--color-danger-ink)",
              }}
            >
              Upload failed — tap to retry. The photo is still on this device.
            </p>
            <div className="flex" style={{ gap: 5, marginTop: 7 }}>
              <Button
                variant="secondary"
                size="compact"
                icon="refresh"
                onClick={() => onAction("retry", photo)}
                style={{ ...ACTION_BUTTON, background: "var(--color-bg)" }}
              >
                Retry
              </Button>
              <Button
                variant="destructive"
                size="compact"
                onClick={() => onAction("delete", photo)}
                style={ACTION_BUTTON}
              >
                Remove
              </Button>
            </div>
          </div>
        ) : suggested ? (
          /* README §10 / §11 — an AI draft is a proposal: it is shown as an
             accent-bordered suggestion and must be Accepted, Rewritten or
             Analyzed before it becomes the caption. Prototype line 1216. */
          <div>
            <div
              className="flex items-center"
              style={{
                gap: 5,
                fontSize: 10,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: "var(--color-accent-700)",
                marginBottom: 5,
              }}
            >
              <Icon name="spark" size={12} />
              Suggested caption
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                lineHeight: 1.45,
                padding: "6px 8px",
                border: "1px solid var(--color-accent-300)",
                background: "var(--color-accent-100)",
              }}
            >
              {photo.aiCaption}
            </p>
            <p style={{ ...STATUS_LINE, margin: "6px 0 0", color: confidence.color }}>
              {confidence.text}
            </p>
            <div className="flex flex-wrap" style={{ gap: 4, marginTop: 8 }}>
              <Button
                variant="primary"
                size="compact"
                onClick={() => onAcceptCaption(photo.id)}
                style={{ ...ACTION_BUTTON, flex: 1 }}
              >
                Accept
              </Button>
              <Button
                variant="secondary"
                size="compact"
                onClick={() => onAction("rewrite", photo)}
                style={ACTION_BUTTON}
              >
                Rewrite
              </Button>
              <Button
                variant="secondary"
                size="compact"
                onClick={() => onAction("analyze", photo)}
                style={ACTION_BUTTON}
              >
                Analyze
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Textarea
              compact
              value={photo.caption}
              onChange={(event) => onCaptionChange(photo.id, event.target.value)}
              aria-label={`Caption for image ${label}`}
              placeholder="Caption required for export…"
              style={CAPTION_TEXTAREA}
            />
            <div className="flex items-center" style={{ gap: 4, marginTop: 6 }}>
              <span
                style={{
                  ...STATUS_LINE,
                  color: !hasCaption
                    ? "var(--color-warning-strong)"
                    : photo.captionSource === "ai"
                      ? confidence.color
                      : "var(--color-neutral-600)",
                }}
              >
                {!hasCaption
                  ? "Caption required"
                  : photo.captionSource === "ai"
                    ? confidence.text
                    : "Ready"}
              </span>
              <div style={{ flex: 1 }} />
              <IconButton
                label={`Analyze image ${label}`}
                name="spark"
                size={22}
                iconSize={12}
                onClick={() => onAction("analyze", photo)}
                style={{ color: "var(--color-accent-700)" }}
              />
              <IconButton
                label={`Replace image ${label}`}
                name="refresh"
                size={22}
                iconSize={12}
                onClick={() => onAction("replace", photo)}
                style={{ color: "var(--color-neutral-600)" }}
              />
              <IconButton
                label={`Download image ${label}`}
                name="download"
                size={22}
                iconSize={12}
                onClick={() => onAction("download", photo)}
                style={{ color: "var(--color-neutral-600)" }}
              />
              <IconButton
                label={`Delete image ${label}`}
                name="trash"
                size={22}
                iconSize={12}
                onClick={() => onAction("delete", photo)}
                style={{ color: "var(--color-neutral-600)" }}
              />
            </div>
          </div>
        )}
      </div>
    </Blueprint>
  );
}
