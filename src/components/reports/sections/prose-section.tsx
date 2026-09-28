"use client";

import { useCallback, useId, useMemo, useState, useTransition } from "react";

import { AiSuggestion } from "@/components/ai/ai-suggestion";
import { useSectionDraft } from "@/components/reports/section-draft";
import { improveText } from "@/lib/ai/actions";
import type { ImproveAction } from "@/lib/ai/schemas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { SECTIONS, type SectionId } from "@/types/domain";

/* ═══════════════════════════════════════════════════════════════════════════
   AI actions row — README §6.1 / §11, prototype line 861.

   "10px uppercase AI ACTIONS kicker + 1–3 compact secondary buttons."

   Deliberately hook-free so it can be rendered from `sections/index.tsx`
   (a module the server route imports): the calling section owns the toast.
   ═══════════════════════════════════════════════════════════════════════════ */

export function AiActionsRow({
  actions,
  onAction,
  busy = false,
}: {
  actions: readonly string[];
  onAction: (action: string) => void;
  /** Disables the row while a request is in flight, so one click means one call. */
  busy?: boolean;
}) {
  return (
    <div
      className="flex flex-wrap items-center"
      style={{ gap: 6, marginBottom: 9 }}
    >
      <span
        className="flex items-center"
        style={{
          gap: 5,
          font: "10px var(--font-body)",
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "var(--color-accent-700)",
          marginRight: 3,
        }}
      >
        <Icon name="spark" size={13} />
        AI actions
      </span>
      {actions.map((action) => (
        <Button
          key={action}
          size="compact"
          disabled={busy}
          onClick={() => onAction(action)}
        >
          {action}
        </Button>
      ))}
    </div>
  );
}

/**
 * README §11 — AI output is a proposal until a human accepts it. Phase 1 owns
 * the surface, not the model call, so every action says where it lands.
 */
export function aiActionMessage(action: string): string {
  return `${action} — this action is not wired to the assistant yet.`;
}

/** The approved button labels, mapped onto the documented §14 actions. */
const ACTION_BY_LABEL: Record<string, ImproveAction> = {
  "Improve with AI": "professional",
  Shorten: "concise",
  "Make More Technical": "technical",
  "Make More Executive": "executive",
};

/* ═══════════════════════════════════════════════════════════════════════════
   Formatting toolbar — README §4 "Rich text editor" [INFERRED]:
   "keep the same frame and allow bold/italic/lists only".

   Prototype line 876: 1px frame with the bottom border removed so the strip
   and the textarea read as one box. The controls are rendered in their
   approved state (`aria-pressed="false"`) and say where formatting lands —
   nothing here fakes a formatting result.
   ═══════════════════════════════════════════════════════════════════════════ */

const TOOLBAR_BUTTON = {
  width: 26,
  height: 24,
  minHeight: 0,
  padding: 0,
  color: "var(--color-text)",
} as const;

function FormattingToolbar({ label }: { label: string }) {
  const { toast } = useToast();
  const notImplemented = () =>
    toast(
      "Bold, italic and lists are not built — sections are stored as plain text, and what is typed here is saved.",
    );

  return (
    <div
      className="flex items-center"
      style={{
        gap: 2,
        border: "1px solid var(--color-divider)",
        borderBottom: 0,
        padding: "4px 6px",
        background: "var(--color-surface)",
      }}
    >
      <Button
        variant="ghost"
        size="compact"
        aria-pressed={false}
        aria-label="Bold"
        title="Bold"
        onClick={notImplemented}
        style={{
          ...TOOLBAR_BUTTON,
          fontFamily: "var(--font-body)",
          fontWeight: 700,
          fontSize: 12.5,
        }}
      >
        B
      </Button>
      <Button
        variant="ghost"
        size="compact"
        aria-pressed={false}
        aria-label="Italic"
        title="Italic"
        onClick={notImplemented}
        style={{
          ...TOOLBAR_BUTTON,
          fontFamily: "var(--font-body)",
          fontStyle: "italic",
          fontSize: 12.5,
        }}
      >
        I
      </Button>
      <Button
        variant="ghost"
        size="compact"
        aria-pressed={false}
        aria-label="Underline"
        title="Underline"
        onClick={notImplemented}
        style={{
          ...TOOLBAR_BUTTON,
          fontSize: 12.5,
          textDecoration: "underline",
        }}
      >
        U
      </Button>
      <span
        aria-hidden="true"
        style={{
          width: 1,
          height: 16,
          background: "var(--color-divider)",
          margin: "0 5px",
        }}
      />
      <Button
        variant="ghost"
        size="compact"
        aria-pressed={false}
        aria-label="Clear formatting"
        title="Clear formatting"
        onClick={notImplemented}
        style={TOOLBAR_BUTTON}
      >
        <Icon name="pencil" size={14} />
      </Button>
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 10.5, color: "var(--color-neutral-600)" }}>
        Heading 2 · {label}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Prose section — §1 Purpose, §3 Company Overview, §8 Partners
   ═══════════════════════════════════════════════════════════════════════════ */

/** The three text-only sections (README §6.2 rows 1, 3 and 8). */
export type ProseSectionId = Extract<SectionId, "purpose" | "overview" | "partners">;

/** Screenshot 04 — the approved action set on a prose section. */
const PROSE_AI_ACTIONS = [
  "Improve with AI",
  "Generate from Transcript",
  "Shorten",
  "Make More Technical",
  "Make More Executive",
] as const;

/** Prototype lines 881 (250px), 931 (260px) and 1197 (220px). */
const PROSE_SETTINGS: Record<
  ProseSectionId,
  { minHeight: number; placeholder: string }
> = {
  purpose: {
    minHeight: 250,
    placeholder: "Describe the main objectives of the supplier visit…",
  },
  overview: {
    minHeight: 260,
    placeholder: "Describe the company as observed during the visit…",
  },
  partners: {
    minHeight: 220,
    placeholder:
      "Strategic partners, main customers, OEM partners, technology partners, component suppliers…",
  },
};

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

function countParagraphs(text: string): number {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0).length;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * The writing column — README §6.1 and screenshot 04.
 *
 * Top to bottom: the AI actions row, the bordered editor box (toolbar strip +
 * prose textarea on `--color-neutral-100`) and the meta row carrying the live
 * paragraph / word counts and the Word placeholder this section feeds.
 *
 * The counts are computed from the text on every keystroke. The prototype
 * printed a fixed "2 paragraphs · 118 words"; the seeded §1 is 2 paragraphs and
 * 87 words, and this renders what is actually there.
 */
export function ProseSection({
  sectionId,
  reportId,
}: {
  sectionId: ProseSectionId;
  /** The report the assistant is asked about, and where the audit row lands. */
  reportId: string;
}) {
  const { toast } = useToast();
  const labelId = useId();
  const definition =
    SECTIONS.find((section) => section.id === sectionId) ?? SECTIONS[1];
  const settings = PROSE_SETTINGS[sectionId];

  // The editor shell owns the text: it is what autosaves it against the row's
  // version, so binding the textarea to local state here would leave the save
  // path with nothing to send (Phase 2 section 18).
  const { draft, setBody } = useSectionDraft(sectionId);
  const [suggestion, setSuggestion] = useState<{ text: string; summary: string } | null>(null);
  const [lastAction, setLastAction] = useState<ImproveAction | null>(null);
  const [aiBusy, startAi] = useTransition();

  const runImprove = useCallback(
    (action: ImproveAction) => {
      setLastAction(action);
      startAi(async () => {
        const result = await improveText({
          reportId,
          sectionId,
          sectionLabel: definition.label,
          text: draft.body,
          action,
        });
        if (!result.ok) {
          toast(result.error.message, "error");
          return;
        }
        setSuggestion({ text: result.data.text, summary: result.data.summary });
      });
    },
    [definition.label, draft.body, reportId, sectionId, toast],
  );
  const text = draft.body;
  const counts = useMemo(
    () => ({ words: countWords(text), paragraphs: countParagraphs(text) }),
    [text],
  );

  return (
    <div style={{ maxWidth: "var(--writing-column)" }}>
      <AiActionsRow
        actions={PROSE_AI_ACTIONS}
        busy={aiBusy}
        onAction={(action) => {
          const mapped = ACTION_BY_LABEL[action];
          if (!mapped) {
            toast(
              action === "Generate from Transcript"
                ? "Add a transcript in the Sources rail and analyse it — findings are inserted from there."
                : aiActionMessage(action),
            );
            return;
          }
          runImprove(mapped);
        }}
      />

      {/* §14 — the proposal never overwrites the section; the user accepts it. */}
      <AiSuggestion
        suggestion={suggestion?.text ?? null}
        summary={suggestion?.summary}
        busy={aiBusy}
        onAccept={(text) => {
          setBody(text);
          setSuggestion(null);
          toast("Suggestion accepted — autosave will store it.");
        }}
        onRegenerate={() => lastAction && runImprove(lastAction)}
        onDiscard={() => setSuggestion(null)}
      />

      <label className="sr-only" htmlFor={labelId}>
        {definition.label}
      </label>
      <FormattingToolbar label={definition.label} />
      <Textarea
        prose
        id={labelId}
        value={text}
        onChange={(event) => setBody(event.target.value)}
        placeholder={settings.placeholder}
        minHeight={settings.minHeight}
        style={{ borderTopWidth: 0 }}
      />

      <div
        className="flex"
        style={{
          gap: 16,
          fontSize: 11.5,
          color: "var(--color-neutral-600)",
          marginTop: 7,
        }}
      >
        <span>
          {plural(counts.paragraphs, "paragraph")} ·{" "}
          {plural(counts.words, "word")}
        </span>
        <span>Autosaved to draft</span>
        <div style={{ flex: 1 }} />
        <span>
          Maps to{" "}
          <span className="mono" style={{ color: "var(--color-accent-700)" }}>
            {definition.placeholder}
          </span>{" "}
          in the Word template
        </span>
      </div>
    </div>
  );
}
