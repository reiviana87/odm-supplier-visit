"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";

/**
 * Quick note — README §17, prototype lines 2298..2307.
 *
 * The observation form's shape, simpler: one long field and two actions.
 *
 *   title    Barlow Condensed 600 19px
 *   field    textarea min-height 180 · 14px / 1.6
 *   hint     11.5px neutral-600
 *   actions  Cancel (flex 1) · Save note (flex 2), both 48px
 *
 * [INFERRED] — the visible "Note" label. The prototype labels this field with
 * its placeholder alone, which README §24 rules out ("placeholders are never
 * the only label"); there is no screenshot of this screen, so the label costs
 * no approved pixels. The hint below the field is the prototype's own copy,
 * wired through `aria-describedby` by `<Field hint>`.
 *
 * Phase 1 keeps the visit's captures in local component state — Save reports
 * what it did and returns home.
 */

const NOTE_PLACEHOLDER = "Anything you do not want to lose before the desktop…";

const NOTE_HINT =
  "Notes are attached to the report as a source file. AI can draft sections from them later.";

export interface NoteFormProps {
  onCancel: () => void;
  onSave: () => void;
}

export function NoteForm({ onCancel, onSave }: NoteFormProps) {
  const [text, setText] = useState("");

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
        Quick Note
      </h2>

      <Field label="Note" hint={NOTE_HINT} style={{ marginBottom: 16 }}>
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={NOTE_PLACEHOLDER}
          style={{ minHeight: 180, fontSize: 14, lineHeight: 1.6 }}
        />
      </Field>

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
          Save note
        </Button>
      </div>
    </div>
  );
}
