"use client";

import { useState } from "react";

import { Blueprint } from "@/components/ui/blueprint";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/states";
import type { TranscriptSource } from "@/lib/data/transcript-actions";

/**
 * Voice / Transcript on the phone — README §11.
 *
 * The tile used to answer with a toast saying voice capture was not built, and
 * that was the whole feature. Recording audio and transcribing it is still not
 * built, and this does not pretend otherwise: what it gives you is the field
 * the transcript goes into, which is the part that was missing. The phone's own
 * keyboard has a dictation key, so speaking into this box is dictation without
 * a recorder, a codec, or a model of our own — and pasting what Plaud or any
 * other tool produced works the same way.
 *
 * Saved transcripts are listed underneath, as on the other two capture screens,
 * because a source that vanishes into a counter is the complaint that produced
 * all three lists.
 */

const PLACEHOLDER =
  "Paste the transcript here — or tap the microphone on the keyboard and talk.";

const HINT =
  "Saved as a source on the report. At a desk, §6 can turn it into observations.";

export interface TranscriptFormProps {
  transcripts: readonly TranscriptSource[];
  saving?: boolean;
  /** Store the text as a new transcript source. */
  onSave: (content: string) => void;
  onDelete: (id: string) => void;
  onCancel: () => void;
}

export function TranscriptForm({
  transcripts,
  saving = false,
  onSave,
  onDelete,
  onCancel,
}: TranscriptFormProps) {
  const [text, setText] = useState("");

  return (
    <div style={{ padding: "14px 16px 20px", flex: 1 }}>
      <h2
        style={{
          fontFamily: "var(--font-heading)",
          fontWeight: 600,
          fontSize: 19,
          letterSpacing: "normal",
          margin: "0 0 4px",
        }}
      >
        Transcript
      </h2>
      <p style={{ fontSize: 12.5, color: "var(--color-neutral-700)", margin: "0 0 14px" }}>
        Recording audio is not built. This is where the text goes.
      </p>

      <Field label="Transcript" hint={HINT} style={{ marginBottom: 16 }}>
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={PLACEHOLDER}
          style={{ minHeight: 200, fontSize: 14, lineHeight: 1.6 }}
        />
      </Field>

      <div style={{ display: "flex", gap: 9, marginBottom: 22 }}>
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
          onClick={() => {
            onSave(text);
            setText("");
          }}
          disabled={saving || text.trim().length < 20}
          style={{ fontSize: 14, minHeight: 48, flex: 2 }}
        >
          {saving ? "Saving…" : "Save transcript"}
        </Button>
      </div>

      <div
        style={{
          font: "10px var(--font-body)",
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "var(--color-neutral-600)",
          marginBottom: 8,
        }}
      >
        Sources on this report · {transcripts.length}
      </div>

      {transcripts.length === 0 ? (
        <EmptyState message="Nothing yet. What you save above lands here." />
      ) : (
        <div className="flex flex-col" style={{ gap: 8, marginBottom: 20 }}>
          {transcripts.map((transcript) => (
            <Blueprint key={transcript.id} style={{ padding: 10 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 2 }}>
                {transcript.fileName}
              </div>
              <div
                style={{ fontSize: 11.5, color: "var(--color-neutral-600)", marginBottom: 6 }}
              >
                {transcript.wordCount.toLocaleString("en-US")} words
              </div>
              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: "var(--color-neutral-700)",
                }}
              >
                {transcript.content.slice(0, 160)}
                {transcript.content.length > 160 ? "…" : ""}
              </p>
              <Button
                size="compact"
                variant="secondary"
                disabled={saving}
                onClick={() => onDelete(transcript.id)}
                style={{ fontSize: 12 }}
              >
                Delete
              </Button>
            </Blueprint>
          ))}
        </div>
      )}

      <Button
        variant="secondary"
        onClick={onCancel}
        block
        style={{ fontSize: 14, minHeight: 48, marginTop: 10 }}
      >
        Back to Visit Mode
      </Button>
    </div>
  );
}
