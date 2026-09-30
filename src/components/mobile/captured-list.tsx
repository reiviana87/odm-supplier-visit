"use client";

import { Blueprint } from "@/components/ui/blueprint";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/states";

/**
 * What this visit has already captured, under the field that captures more.
 *
 * [INFERRED] The approved capture screens are write-only: Add Note and Add
 * Observation each opened an empty field, saved, and returned to a grid where
 * a counter had gone up. "I put in a note and then I do not know where it
 * goes" is what that produces — so both screens now show what is already
 * there, in the order the report will print it, editable in place.
 *
 * Deliberately one component for both: a key point and an observation differ in
 * what sits above the text (a category, or nothing) and in which part of §6
 * they become, and in nothing else that a phone needs to draw.
 */

export interface CapturedItem {
  /** Stable across re-renders — a row id where there is one, else the index. */
  key: string;
  /** The category chip above the text, when the kind has one. */
  label?: string;
  text: string;
}

export interface CapturedListProps {
  /** e.g. "Key points on this report". */
  title: string;
  /** Where these end up once the report is exported. One short sentence. */
  destination: string;
  items: readonly CapturedItem[];
  /** A write is in flight — the list goes quiet rather than accepting edits. */
  busy?: boolean;
  /** Typing: the parent holds the text, this only reports the keystroke. */
  onChange: (index: number, text: string) => void;
  /** Blur: the parent writes what it holds. */
  onCommit: () => void;
  onDelete: (index: number) => void;
  /** What the empty state says when nothing has been captured yet. */
  emptyMessage: string;
}

export function CapturedList({
  title,
  destination,
  items,
  busy = false,
  onChange,
  onCommit,
  onDelete,
  emptyMessage,
}: CapturedListProps) {
  return (
    <section style={{ marginTop: 22 }}>
      <div
        style={{
          font: "10px var(--font-body)",
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "var(--color-neutral-600)",
          marginBottom: 4,
        }}
      >
        {title} · {items.length}
      </div>
      <p
        style={{
          fontSize: 11.5,
          lineHeight: 1.45,
          color: "var(--color-neutral-600)",
          margin: "0 0 10px",
        }}
      >
        {destination}
      </p>

      {items.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <div className="flex flex-col" style={{ gap: 8 }}>
          {items.map((item, index) => (
            <Blueprint key={item.key} style={{ padding: 8 }}>
              {item.label ? (
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: ".12em",
                    textTransform: "uppercase",
                    color: "var(--color-neutral-600)",
                    marginBottom: 5,
                  }}
                >
                  {item.label}
                </div>
              ) : null}
              <Textarea
                aria-label={`${title} ${index + 1}`}
                value={item.text}
                disabled={busy}
                onChange={(event) => onChange(index, event.target.value)}
                onBlur={onCommit}
                style={{ minHeight: 60, fontSize: 13.5, lineHeight: 1.5 }}
              />
              <Button
                size="compact"
                variant="secondary"
                disabled={busy}
                onClick={() => onDelete(index)}
                style={{ marginTop: 6, fontSize: 12 }}
              >
                Delete
              </Button>
            </Blueprint>
          ))}
        </div>
      )}
    </section>
  );
}
