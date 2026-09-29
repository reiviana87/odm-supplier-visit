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
  /** The write is in flight — README §5's in-progress control state. */
  saving?: boolean;
  onCancel: () => void;
  /** Hands the two captured fields up; the caller owns the write. */
  onSave: (values: { category: string; text: string }) => void;
}

export function ObservationForm({
  saving = false,
  onCancel,
  onSave,
}: ObservationFormProps) {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [text, setText] = useState("");
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
          onClick={() => onSave({ category, text })}
          style={{ fontSize: 14, minHeight: 48, flex: 2 }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
