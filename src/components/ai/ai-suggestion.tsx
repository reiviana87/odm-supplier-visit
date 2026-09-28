"use client";

/**
 * The review step every AI proposal goes through — README §14, §17, §18.
 *
 * Nothing the assistant writes reaches a report without passing through this:
 * the suggestion is shown beside what it would replace, and the four answers
 * are Accept, Edit, Regenerate and Discard. There is deliberately no "apply
 * automatically" path, because the whole point of §18 is that a human decides
 * whether a sentence about a factory is true.
 */

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Textarea } from "@/components/ui/field";

export interface AiSuggestionProps {
  /** The proposal. Null closes the panel. */
  suggestion: string | null;
  /** One line describing what the assistant did, shown under the heading. */
  summary?: string;
  /** Areas it deliberately left out, when it reported any (§17). */
  omitted?: readonly string[];
  busy?: boolean;
  onAccept: (text: string) => void;
  onRegenerate: () => void;
  onDiscard: () => void;
}

export function AiSuggestion({
  suggestion,
  summary,
  omitted,
  busy = false,
  onAccept,
  onRegenerate,
  onDiscard,
}: AiSuggestionProps) {
  const [draft, setDraft] = useState(suggestion ?? "");
  const [editing, setEditing] = useState(false);
  const [shown, setShown] = useState(suggestion);

  // A regenerated proposal replaces the draft, and an edit in progress does not
  // survive it — it is a different suggestion, so carrying the old edit forward
  // would quietly mix two of them. Adjusted during render rather than in an
  // effect: React re-runs this component immediately with the new state and
  // never paints the stale draft, which an effect would.
  if (suggestion !== shown) {
    setShown(suggestion);
    setDraft(suggestion ?? "");
    setEditing(false);
  }

  if (suggestion === null) return null;

  return (
    <div
      className="anim-rise"
      style={{
        border: "1px solid var(--color-accent-300)",
        background: "var(--color-accent-100)",
        padding: "12px 14px",
        marginBottom: 14,
      }}
    >
      <div className="flex items-center" style={{ gap: 7, marginBottom: 8 }}>
        <Icon name="spark" size={13} />
        <strong style={{ fontSize: 12.5, color: "var(--color-accent-800)" }}>
          Suggestion — not saved yet
        </strong>
      </div>

      {summary ? (
        <p style={{ margin: "0 0 9px", fontSize: 11.5, color: "var(--color-neutral-600)" }}>
          {summary}
        </p>
      ) : null}

      {editing ? (
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          minHeight={180}
          prose
          aria-label="Edit the suggestion before accepting it"
        />
      ) : (
        <div
          style={{
            whiteSpace: "pre-wrap",
            fontSize: 13,
            lineHeight: 1.65,
            background: "var(--color-surface)",
            border: "1px solid var(--color-divider)",
            padding: "10px 12px",
            maxHeight: 320,
            overflowY: "auto",
          }}
        >
          {draft}
        </div>
      )}

      {omitted && omitted.length > 0 ? (
        <p style={{ margin: "9px 0 0", fontSize: 11.5, color: "var(--color-warning-ink)" }}>
          Not covered, for lack of evidence in the report: {omitted.join(", ")}.
        </p>
      ) : null}

      <div className="flex items-center" style={{ gap: 7, marginTop: 11, flexWrap: "wrap" }}>
        <Button variant="primary" onClick={() => onAccept(draft)} disabled={busy}>
          Accept
        </Button>
        <Button onClick={() => setEditing((value) => !value)} disabled={busy}>
          {editing ? "Preview" : "Edit"}
        </Button>
        <Button onClick={onRegenerate} disabled={busy}>
          {busy ? "Working…" : "Regenerate"}
        </Button>
        <Button variant="secondary" onClick={onDiscard} disabled={busy}>
          Discard
        </Button>
      </div>
    </div>
  );
}
