"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";

import { CapturedList } from "./captured-list";

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
 * The key points already on the report are listed underneath, editable in
 * place. The screen used to be the field and nothing else, so a note went into
 * a counter and out of reach.
 */

const NOTE_PLACEHOLDER = "Anything you do not want to lose before the desktop…";

const NOTE_HINT =
  "Saved as a key point in §6 Visit Relevant Information, where it can be edited at a desk.";

export interface NoteFormProps {
  /** §6's key points as they stand — one bullet per line on the `visit` row. */
  keyPoints: readonly string[];
  /**
   * Replace the whole list.
   *
   * The whole list rather than a patch because that is what `saveSection`
   * takes: the bullets are one text column, not rows.
   */
  onReplace: (next: readonly string[]) => Promise<boolean>;
  onCancel: () => void;
  /**
   * The text itself, which the caller writes.
   *
   * It used to take nothing: the note lived in this component's state, Save
   * moved a counter, and what the user typed standing in a factory was thrown
   * away. Handing the text up is the whole fix.
   */
  onSave: (text: string) => Promise<boolean>;
  /** The write is in flight — README §5's in-progress control state. */
  saving?: boolean;
}

export function NoteForm({
  keyPoints,
  onReplace,
  onCancel,
  onSave,
  saving = false,
}: NoteFormProps) {
  const [text, setText] = useState("");
  // A local copy, so a keystroke shows immediately rather than waiting on a
  // round trip. It is re-taken from the server whenever a write lands, which is
  // how a note just saved appears in the list below without a reload. Adjusting
  // state during render, rather than in an effect, is React's own answer to
  // deriving state from props.
  const [points, setPoints] = useState<readonly string[]>(keyPoints);
  const [stored, setStored] = useState<readonly string[]>(keyPoints);
  if (stored !== keyPoints) {
    setStored(keyPoints);
    setPoints(keyPoints);
  }
  const [busy, setBusy] = useState(false);

  async function replace(next: readonly string[]) {
    setPoints(next);
    setBusy(true);
    await onReplace(next.filter((line) => line.trim() !== ""));
    setBusy(false);
  }

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
          onClick={async () => {
            // Cleared only once the write has landed. Leaving the text in the
            // box let a second tap file the same note twice; clearing it before
            // the answer came back would have lost it on a failure.
            if (await onSave(text)) setText("");
          }}
          disabled={saving}
          style={{ fontSize: 14, minHeight: 48, flex: 2 }}
        >
          {saving ? "Saving…" : "Save note"}
        </Button>
      </div>

      <CapturedList
        title="Key points on this report"
        destination="Printed in §6 Visit Relevant Information as a bullet list."
        items={points.map((line, index) => ({ key: String(index), text: line }))}
        busy={busy || saving}
        onChange={(index, value) =>
          setPoints((current) => current.map((item, i) => (i === index ? value : item)))
        }
        onCommit={() => void replace(points)}
        onDelete={(index) => void replace(points.filter((_, i) => i !== index))}
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
