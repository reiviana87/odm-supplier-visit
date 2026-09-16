"use client";

import { useId, useState, type CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";

/**
 * Quick observation — README §17, prototype lines 2271..2296, screenshot 18.
 *
 *   title      Barlow Condensed 600 19px
 *   category   10px/.12em uppercase caption over chips: padding 7px 12px,
 *              13px, 1px divider — selected takes a var(--color-accent) border
 *              on an accent-100 ground
 *   text       textarea min-height 110 · 14px / 1.55
 *   photo      64×52 thumbnail beside a 46px "Attach another" button
 *   actions    Cancel (flex 1) · Save (flex 2), both 48px
 *
 * Save files the observation into §6 with its category. Phase 1 keeps the
 * visit's captures in local component state — there is no store behind this
 * yet — so Save reports what it did and returns home.
 *
 * The text area opens with the observation shown in the approved capture; the
 * screenshot is of a filled form, not an empty one.
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

const SEEDED_TEXT =
  "Supplier currently operates five CNC machining centers for stainless-steel components.";

/** 10px / .12em uppercase — the group caption (prototype line 2274). */
const GROUP_LABEL: CSSProperties = {
  font: "10px var(--font-body)",
  letterSpacing: ".12em",
  textTransform: "uppercase",
  color: "var(--color-neutral-600)",
  marginBottom: 7,
};

/** Matches `.field > label` in globals.css — used where there is no control. */
const FIELD_LABEL: CSSProperties = {
  display: "block",
  fontSize: 12,
  marginBottom: 5,
  color: "color-mix(in srgb, var(--color-text) 70%, transparent)",
};

export interface ObservationFormProps {
  /** The photo already attached to this observation. */
  photo: { src: string; caption: string };
  /** Open the camera to attach another frame. */
  onAttach: () => void;
  onCancel: () => void;
  onSave: () => void;
}

export function ObservationForm({
  photo,
  onAttach,
  onCancel,
  onSave,
}: ObservationFormProps) {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [text, setText] = useState(SEEDED_TEXT);
  const categoryLabelId = useId();
  const photoLabelId = useId();

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
      <div
        role="group"
        aria-labelledby={categoryLabelId}
        style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 16 }}
      >
        {CATEGORIES.map((option) => {
          const selected = option === category;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => setCategory(option)}
              className={selected ? undefined : "vm-chip"}
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
          style={{ minHeight: 110, fontSize: 14, lineHeight: 1.55 }}
        />
      </Field>

      <div role="group" aria-labelledby={photoLabelId} style={{ marginBottom: 16 }}>
        <div id={photoLabelId} style={FIELD_LABEL}>
          Related photo
        </div>
        <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- seeded photo,
              no known intrinsic size. */}
          <img
            src={photo.src}
            alt={photo.caption}
            style={{
              width: 64,
              height: 52,
              objectFit: "cover",
              border: "1px solid var(--color-divider)",
              flex: "none",
            }}
          />
          <Button
            variant="secondary"
            onClick={onAttach}
            style={{ fontSize: 13, minHeight: 46, flex: 1 }}
          >
            Attach another
          </Button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 9 }}>
        <Button
          variant="secondary"
          onClick={onCancel}
          style={{ fontSize: 14, minHeight: 48, flex: 1 }}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={onSave}
          style={{ fontSize: 14, minHeight: 48, flex: 2 }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
