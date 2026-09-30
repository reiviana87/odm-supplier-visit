"use client";

import { useId, useRef, useState, type CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import type { Observation, ReportPhoto } from "@/types/domain";

import { CapturedList } from "./captured-list";

/**
 * Quick observation — README §17, prototype lines 2271..2296, screenshot 18.
 *
 *   title      Barlow Condensed 600 19px
 *   category   10px/.12em uppercase caption over chips: padding 7px 12px,
 *              13px, 1px divider — selected takes a var(--color-accent) border
 *              on an accent-100 ground; painted as approved, with a transparent
 *              44px+ hit box (`.vm-hit`)
 *   text       textarea min-height 110 · 14px / 1.55
 *   actions    Cancel (flex 1) · Save (flex 2), both 48px
 *
 * Save files the observation into §6 with its category. The form owns the two
 * fields and hands them up; the write itself belongs to `VisitMode`, which
 * holds the rest of the §6 list that has to travel with them.
 *
 * The text area opens empty, with the approved capture's sentence as its
 * placeholder — see `TEXT_PLACEHOLDER` for why that moved in Phase 2.
 */

/** The six categories, in prototype order (line 3305). */
const CATEGORIES: readonly string[] = [
  "Manufacturing",
  "Quality",
  "Product",
  "Commercial",
  "Risk",
  "Other",
];

/**
 * The prototype hard-codes this sentence as the textarea's VALUE (line 2282)
 * and screenshot 18 is a capture of the filled form. In Phase 2 it is the
 * placeholder instead.
 *
 * The reason is the Save button: in Phase 1 it went nowhere, so a pre-filled
 * example cost nothing. It now writes into §6 of a real report, and one tap on
 * a form nobody typed into would file a sentence about CNC machining centres as
 * the author's own observation of a cable factory. A report is evidence of a
 * visit. The approved copy still shows in the field, at the approved size and
 * position, as the prompt it always was rather than as the user's words.
 */
const TEXT_PLACEHOLDER =
  "Supplier currently operates five CNC machining centers for stainless-steel components.";

/** 10px / .12em uppercase — the group caption (prototype line 2274). */
const GROUP_LABEL: CSSProperties = {
  font: "10px var(--font-body)",
  letterSpacing: ".12em",
  textTransform: "uppercase",
  color: "var(--color-neutral-600)",
  marginBottom: 7,
};

export interface ObservationFormProps {
  /** §6's observation cards as they stand. */
  observations: readonly Observation[];
  /**
   * Every stored photograph, so a card carrying an `imageId` can show it.
   *
   * Passed in rather than fetched: the screen already has them, and a second
   * read would only be a chance for the two to disagree.
   */
  photos: readonly ReportPhoto[];
  /**
   * Store a photograph and hand back the row it became.
   *
   * The write belongs to `VisitMode`, which owns every other write on this
   * screen; this form only knows that it now has an id to attach. Null means
   * the file could not be read or stored, and the caller has already said so.
   */
  onCapturePhoto: (file: File) => Promise<{ id: string; src: string } | null>;
  /** Replace the whole set — `saveObservations` takes the list, not a patch. */
  onReplace: (next: readonly Observation[]) => Promise<boolean>;
  /** The write is in flight — README §5's in-progress control state. */
  saving?: boolean;
  onCancel: () => void;
  /** Hands the captured fields up; the caller owns the write. */
  onSave: (values: { category: string; text: string; imageId: string | null }) => void;
}

export function ObservationForm({
  observations,
  photos,
  onCapturePhoto,
  onReplace,
  saving = false,
  onCancel,
  onSave,
}: ObservationFormProps) {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [text, setText] = useState("");
  const photoRef = useRef<HTMLInputElement>(null);
  // The photograph attached to the observation being written, once it is
  // stored. It is stored before Save rather than with it, because the row needs
  // an id to point at and the upload is the thing that assigns one.
  const [attached, setAttached] = useState<{ id: string; src: string } | null>(null);
  const [attaching, setAttaching] = useState(false);
  // Re-taken from the server whenever a write lands, so an observation just
  // saved joins the list below without a reload (see note-form.tsx).
  const [cards, setCards] = useState<readonly Observation[]>(observations);
  const [stored, setStored] = useState<readonly Observation[]>(observations);
  if (stored !== observations) {
    setStored(observations);
    setCards(observations);
  }
  const [busy, setBusy] = useState(false);

  /** A stored photograph by id — what a card needs in order to draw one. */
  const srcById = new Map(photos.map((photo) => [photo.id, photo.src]));

  async function attach(file: File | undefined) {
    if (!file) return;
    setAttaching(true);
    setAttached(await onCapturePhoto(file));
    setAttaching(false);
  }

  async function replace(next: readonly Observation[]) {
    setCards(next);
    setBusy(true);
    await onReplace(next.filter((card) => card.text.trim() !== ""));
    setBusy(false);
  }
  const categoryLabelId = useId();

  return (
    <div style={{ padding: "14px 16px 20px", flex: 1 }}>
      <h2
        style={{
          fontFamily: "var(--font-heading)",
          fontWeight: 600,
          fontSize: 19,
          letterSpacing: "normal",
          margin: "0 0 12px",
        }}
      >
        Quick Observation
      </h2>

      <div id={categoryLabelId} style={GROUP_LABEL}>
        Category
      </div>
      {/* rowGap 14, not the approved 7, is the other half of `.vm-hit`: it puts
          the wrapped rows exactly one hit box apart so the 44px targets tile
          instead of overlapping. The column gap stays at the approved 7. */}
      <div
        role="group"
        aria-labelledby={categoryLabelId}
        style={{
          display: "flex",
          flexWrap: "wrap",
          columnGap: 7,
          rowGap: 14,
          marginBottom: 16,
        }}
      >
        {CATEGORIES.map((option) => {
          const selected = option === category;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => setCategory(option)}
              // `vm-hit` — the confirmed touch-target decision: the chip keeps
              // its approved ~31px appearance and gains a transparent ±7px hit
              // box (45px effective) instead of being enlarged. The selected
              // chip paints its own border and ground, so it drops `vm-chip`
              // (the hover rule) but keeps the hit area. See phone-frame.tsx.
              className={selected ? "vm-hit" : "vm-chip vm-hit"}
              style={{
                padding: "7px 12px",
                border: `1px solid ${
                  selected ? "var(--color-accent)" : "var(--color-divider)"
                }`,
                background: selected ? "var(--color-accent-100)" : "transparent",
                font: "13px var(--font-body)",
                color: "var(--color-text)",
                cursor: "pointer",
              }}
            >
              {option}
            </button>
          );
        })}
      </div>

      <Field label="Text" style={{ marginBottom: 14 }}>
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={TEXT_PLACEHOLDER}
          style={{ minHeight: 110, fontSize: 14, lineHeight: 1.55 }}
        />
      </Field>

      {/* No `capture`: the phone offers its camera and its album, the same
          choice Take Photo makes. */}
      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          void attach(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <div style={{ marginBottom: 14 }}>
        {attached ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- stored
                photograph behind a signed URL, no known intrinsic size. */}
            <img
              src={attached.src}
              alt=""
              style={{
                width: "100%",
                maxHeight: 170,
                objectFit: "cover",
                display: "block",
                marginBottom: 7,
                border: "1px solid var(--color-divider)",
              }}
            />
            <div style={{ display: "flex", gap: 7 }}>
              <Button
                variant="secondary"
                disabled={attaching || saving}
                onClick={() => photoRef.current?.click()}
                style={{ fontSize: 13, minHeight: 44, flex: 1 }}
              >
                Replace photo
              </Button>
              <Button
                variant="secondary"
                disabled={attaching || saving}
                onClick={() => setAttached(null)}
                style={{ fontSize: 13, minHeight: 44, flex: 1 }}
              >
                Remove
              </Button>
            </div>
          </>
        ) : (
          <Button
            variant="secondary"
            block
            disabled={attaching || saving}
            onClick={() => photoRef.current?.click()}
            style={{ fontSize: 13, minHeight: 44 }}
          >
            {attaching ? "Storing the photograph\u2026" : "Add a photo (optional)"}
          </Button>
        )}
      </div>

      <div style={{ display: "flex", gap: 9 }}>
        <Button
          variant="secondary"
          onClick={onCancel}
          disabled={saving}
          style={{ fontSize: 14, minHeight: 48, flex: 1 }}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          loading={saving}
          onClick={() => {
            onSave({ category, text, imageId: attached?.id ?? null });
            setAttached(null);
          }}
          style={{ fontSize: 14, minHeight: 48, flex: 2 }}
        >
          Save
        </Button>
      </div>

      <CapturedList
        title="Observations on this report"
        destination="Printed in §6 Visit Relevant Information, each with its category."
        items={cards.map((card, index) => ({
          key: card.id || String(index),
          label: card.category.trim() === "" ? "No category" : card.category,
          text: card.text,
          imageSrc: card.imageId ? srcById.get(card.imageId) : undefined,
        }))}
        busy={busy || saving}
        onChange={(index, value) =>
          setCards((current) =>
            current.map((item, i) => (i === index ? { ...item, text: value } : item)),
          )
        }
        onCommit={() => void replace(cards)}
        onDelete={(index) => void replace(cards.filter((_, i) => i !== index))}
        emptyMessage="Nothing yet. What you write above lands here."
      />

      {/* The way out, at the end rather than only at the top: the list above is
          as long as the visit is, and Cancel scrolls off it. Same label and
          same 48px as the Photos screen, because it is the same journey. */}
      <Button
        variant="secondary"
        onClick={onCancel}
        block
        style={{ fontSize: 14, minHeight: 48, marginTop: 20 }}
      >
        Back to Visit Mode
      </Button>
    </div>
  );
}
