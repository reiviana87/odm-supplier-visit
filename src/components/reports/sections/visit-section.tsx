"use client";

import { useCallback, useRef, useState, useTransition } from "react";

import { useSectionDraft } from "@/components/reports/section-draft";
import { Blueprint } from "@/components/ui/blueprint";
import { Tag, type TagTone } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { EmptyState, EMPTY_STATE_COPY } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { TranscriptPanel } from "@/components/reports/transcript-panel";
import { saveObservations } from "@/lib/data/report-actions";
import { joinQaBullets, splitQaBullets } from "@/lib/data/report-mappers";
import type { TranscriptSource } from "@/lib/data/transcript-actions";
import type { Observation, Report, ReportPhoto } from "@/types/domain";

/**
 * §6 Visit Relevant Information — prototype lines 1070..1138 and the approved
 * capture `screenshots/05-editor-visit-relevant-information.png`.
 *
 * Observations are the section's content and are stored as their own rows:
 * `saveObservations` replaces the set, numbering them by the order on screen.
 * The Q&A block is **optional** (README §25) and is the `visit` section body —
 * one bullet per line — so it rides the editor's autosave, and its `Optional`
 * tag and exclude control write the row's `excluded` flag.
 *
 * The banner counts come from the transcript findings, never from a constant:
 * README §12 — "9 AI findings … · 4 already added".
 */

type VisitView = "observations" | "qa" | "transcript" | "rich";

const VIEWS: ReadonlyArray<{ id: VisitView; label: string }> = [
  { id: "observations", label: "Observations" },
  // Named for what it holds. It was "Q&A", and the bullet editor behind it —
  // the one place §6 keeps loose points from the visit — went unfound.
  { id: "qa", label: "Q&A / Key points" },
  // The transcript surface used to live only in the right-hand rail, under a
  // heading that said "Sources"; on a phone it was off-screen entirely.
  { id: "transcript", label: "Transcript" },
  { id: "rich", label: "Rich text" },
];

/** Prototype line 3001 — Normal is the neutral tag, anything higher warns. */
const PRIORITY_TONE: Record<Observation["priority"], TagTone> = {
  Normal: "neutral",
  High: "warning",
  Critical: "danger",
};

const PRIORITIES: ReadonlyArray<Observation["priority"]> = [
  "Normal",
  "High",
  "Critical",
];

/**
 * A card the author opened and never typed into is not an observation — the
 * rule `saveObservations` applies before it writes anything, restated here so
 * the screen can tell which of its cards the database is answering about.
 */
function isBlank(observation: Observation): boolean {
  return observation.category.trim() === "" && observation.text.trim() === "";
}

/** The stored rows, back under the cards they belong to — see §5 for the why. */
function adoptStored(
  local: readonly Observation[],
  stored: readonly Observation[],
): Observation[] {
  let next = 0;
  return local.map((observation) =>
    isBlank(observation) ? observation : (stored[next++] ?? observation),
  );
}

/**
 * README §4 "Observation card" lists `editing` among its states: the resting
 * card is the approved read-only one, and the pencil opens the same card with
 * its three values in controls. Nothing moves; the tags become the fields they
 * were printing.
 */
function ObservationCard({
  observation,
  photoSrc,
  index,
  editing,
  onToggleEdit,
  onChange,
  onCommit,
  onDelete,
  onUnavailable,
}: {
  observation: Observation;
  /** The photograph taken with it in the field, already signed. */
  photoSrc: string | undefined;
  index: number;
  editing: boolean;
  onToggleEdit: () => void;
  /** Apply a patch, and hand back the list it produced so a save can use it. */
  onChange: (patch: Partial<Observation>) => readonly Observation[];
  /** Save. Given a list, saves that one rather than the component's state. */
  onCommit: (next?: readonly Observation[]) => void;
  onDelete: () => void;
  onUnavailable: (message: string) => void;
}) {
  const position = `observation ${index + 1}`;

  return (
    <Blueprint style={{ padding: "11px 12px" }}>
      {photoSrc ? (
        /* Captured with the observation in Visit Mode (0008). The photograph
           itself lives in the appendix; this is the same object, shown where
           the sentence about it is. */
        /* eslint-disable-next-line @next/next/no-img-element -- stored
           photograph behind a signed URL, no known intrinsic size. */
        <img
          src={photoSrc}
          alt={`Photograph taken with ${position}`}
          style={{
            width: "100%",
            maxHeight: 180,
            objectFit: "cover",
            display: "block",
            marginBottom: 9,
            border: "1px solid var(--color-divider)",
          }}
        />
      ) : null}
      <div className="flex items-center" style={{ gap: 7, marginBottom: 6 }}>
        {editing ? (
          <>
            <Input
              compact
              value={observation.category}
              aria-label={`Category of ${position}`}
              placeholder="Category"
              onChange={(event) => onChange({ category: event.target.value })}
              onBlur={() => onCommit()}
              style={{ width: 190, fontSize: 11.5 }}
            />
            <Select
              compact
              value={observation.priority}
              aria-label={`Priority of ${position}`}
              onChange={(event) => {
                // The patched list goes straight to the save. Reading state
                // here would send the priority the card had a moment ago.
                onCommit(
                  onChange({ priority: event.target.value as Observation["priority"] }),
                );
              }}
              style={{ width: 104, fontSize: 11.5 }}
            >
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </Select>
          </>
        ) : (
          <>
            {observation.category.trim() === "" ? null : (
              <Tag tone="outline" style={{ fontSize: 10 }}>
                {observation.category}
              </Tag>
            )}
            <Tag tone={PRIORITY_TONE[observation.priority]}>
              {observation.priority}
            </Tag>
          </>
        )}
        <div style={{ flex: 1 }} />
        <IconButton
          label={`Attach photo to ${position}`}
          name="image"
          size={23}
          className="text-neutral-500"
          onClick={() => onUnavailable("Attaching a photo arrives in Phase 4")}
        />
        <IconButton
          label={editing ? `Finish editing ${position}` : `Edit ${position}`}
          name={editing ? "check" : "pencil"}
          size={23}
          className="text-neutral-500"
          onClick={onToggleEdit}
        />
        <IconButton
          label={`Delete ${position}`}
          name="trash"
          size={23}
          className="text-neutral-500"
          onClick={onDelete}
        />
      </div>

      {editing ? (
        <Textarea
          value={observation.text}
          aria-label={`Text of ${position}`}
          placeholder="What was seen, said or measured…"
          onChange={(event) => onChange({ text: event.target.value })}
          onBlur={() => onCommit()}
          minHeight={64}
          style={{ fontSize: 13, lineHeight: 1.6, background: "var(--color-bg)" }}
        />
      ) : (
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>{observation.text}</div>
      )}
    </Blueprint>
  );
}

function QaBlock({ onExtract }: { onExtract: () => void }) {
  // README §6.2 — §6's Q&A block is the `visit` section body, one bullet per
  // line, and the exclude control is that row's `excluded` flag.
  const { draft, setBody, setExcluded } = useSectionDraft("visit");

  const [bullets, setBullets] = useState(() =>
    splitQaBullets(draft.body).map((text, index) => ({
      id: `qa-${index}`,
      text,
    })),
  );
  const [nextId, setNextId] = useState(() => splitQaBullets(draft.body).length);

  const included = !draft.excluded;

  /** Local ids keep the inputs stable; the body is what is stored. */
  const commit = useCallback(
    (next: ReadonlyArray<{ id: string; text: string }>) => {
      setBullets([...next]);
      setBody(joinQaBullets(next.map((bullet) => bullet.text)));
    },
    [setBody],
  );

  return (
    <>
      <div
        className="flex flex-wrap items-center"
        style={{ gap: 9, margin: "0 0 9px" }}
      >
        <h6 style={{ margin: 0 }}>Q&amp;A — key points</h6>
        <Tag tone="outline">Optional</Tag>
        <Tag tone="neutral">
          {bullets.length} {bullets.length === 1 ? "bullet" : "bullets"}
        </Tag>
        <div style={{ flex: 1 }} />
        <Button
          variant="ghost"
          size="compact"
          aria-pressed={!included}
          style={{ fontSize: 11.5, color: "var(--color-neutral-700)" }}
          onClick={() => setExcluded(included)}
        >
          {included ? "Exclude from report" : "Include in report"}
        </Button>
      </div>

      {included ? (
        <Blueprint style={{ padding: "11px 13px 12px" }}>
          <div className="flex flex-col" style={{ gap: 6 }}>
            {bullets.map((bullet, index) => (
              <div key={bullet.id} className="flex items-start" style={{ gap: 8 }}>
                <span
                  aria-hidden="true"
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontWeight: 600,
                    color: "var(--color-accent-700)",
                    flex: "none",
                    fontSize: 14,
                    lineHeight: "30px",
                  }}
                >
                  —
                </span>
                <Textarea
                  compact
                  aria-label={`Q&A key point ${index + 1}`}
                  value={bullet.text}
                  onChange={(event) =>
                    commit(
                      bullets.map((item) =>
                        item.id === bullet.id
                          ? { ...item, text: event.target.value }
                          : item,
                      ),
                    )
                  }
                  minHeight={30}
                  style={{
                    flex: 1,
                    fontSize: 12.5,
                    lineHeight: 1.5,
                    padding: "6px 8px",
                    background: "var(--color-bg)",
                  }}
                />
                <IconButton
                  label={`Delete key point ${index + 1}`}
                  name="trash"
                  size={24}
                  className="text-neutral-500"
                  style={{ width: 24, height: 24, minHeight: 24, marginTop: 3 }}
                  onClick={() =>
                    commit(bullets.filter((item) => item.id !== bullet.id))
                  }
                />
              </div>
            ))}
          </div>

          <div
            className="flex flex-wrap items-center"
            style={{ gap: 8, marginTop: 11 }}
          >
            <Button
              size="compact"
              icon="plus"
              onClick={() => {
                // A blank line is not a bullet, so an empty new one changes the
                // stored body only once it is written in.
                setBullets((current) => [
                  ...current,
                  { id: `qa-new-${nextId}`, text: "" },
                ]);
                setNextId((current) => current + 1);
              }}
            >
              Add bullet
            </Button>
            <Button
              size="compact"
              icon="spark"
              style={{
                borderColor: "var(--color-accent-300)",
                color: "var(--color-accent-800)",
              }}
              onClick={onExtract}
            >
              Extract from transcript
            </Button>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 11.5, color: "var(--color-neutral-600)" }}>
              Written to §6 as a bullet list
            </span>
          </div>
        </Blueprint>
      ) : (
        <EmptyState
          message="Q&A excluded from this report — §6 will contain observations only."
          action={
            <Button size="compact" onClick={() => setExcluded(false)}>
              Include again
            </Button>
          }
        />
      )}
    </>
  );
}

export function VisitSection({
  report,
  transcripts,
  photos,
}: {
  report: Report;
  /** The report's transcript sources — §6 hosts the paste field itself now. */
  transcripts: readonly TranscriptSource[];
  /** Every stored photograph, so a card carrying an `imageId` can show it. */
  photos: readonly ReportPhoto[];
}) {
  const { toast } = useToast();
  const [view, setView] = useState<VisitView>("observations");

  const [observations, setObservations] = useState<readonly Observation[]>(
    () => report.sections.observations,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [, startSave] = useTransition();

  /** See §5: the stored rows are only taken back in when nothing has moved on. */
  const revision = useRef(0);
  const drafted = useRef(0);

  const edit = useCallback((next: readonly Observation[]) => {
    revision.current += 1;
    setObservations(next);
  }, []);

  const persist = useCallback(
    (next: readonly Observation[]) => {
      const at = revision.current;

      startSave(async () => {
        const result = await saveObservations(report.id, next);
        if (!result.ok) {
          toast(result.error.message, "error");
          return;
        }
        if (revision.current === at) {
          setObservations((current) => adoptStored(current, result.data));
        }
      });
    },
    [report.id, toast],
  );

  /**
   * Apply a patch and hand back the list it produced.
   *
   * The list is returned because a caller that patches and then saves in the
   * same handler cannot use `observations`: the state has not advanced yet, so
   * it would write the values from before the change. The priority dropdown did
   * exactly that — it saved the OLD priority and then visibly snapped back to
   * it when the stored rows came home.
   */
  const patchObservation = useCallback(
    (id: string, patch: Partial<Observation>): readonly Observation[] => {
      const next = observations.map((observation) =>
        observation.id === id ? { ...observation, ...patch } : observation,
      );
      edit(next);
      return next;
    },
    [edit, observations],
  );

  const deleteObservation = useCallback(
    (id: string) => {
      const next = observations.filter((observation) => observation.id !== id);
      if (editingId === id) setEditingId(null);
      edit(next);
      persist(next);
    },
    [edit, editingId, observations, persist],
  );

  /** A new card is added to the screen and stored once something is in it. */
  const addObservation = useCallback(() => {
    drafted.current += 1;
    const id = `draft-${drafted.current}`;
    edit([
      ...observations,
      { id, category: "", priority: "Normal", text: "", sourceFindingId: null, imageId: null },
    ]);
    setEditingId(id);
    setView("observations");
  }, [edit, observations]);

  /**
   * How many of §6's cards came out of a transcript rather than being typed.
   *
   * This used to be a pair of numbers from the mock module, so every report
   * claimed the same findings were waiting — including reports with no
   * transcript at all.
   */
  const fromTranscript = observations.filter(
    (observation) => observation.sourceFindingId !== null,
  ).length;

  return (
    <div style={{ maxWidth: 900 }}>
      <div
        className="flex flex-wrap items-center"
        style={{ gap: 8, marginBottom: 12 }}
      >
        <Tabs
          items={VIEWS.map((item) => ({ id: item.id, label: item.label }))}
          activeId={view}
          label="Visit information view"
          onChange={(id) => {
            const next = VIEWS.find((item) => item.id === id);
            if (!next) return;
            setView(next.id);
            if (next.id === "rich") {
              toast(
                "The §6 rich-text view is not built — observations and Q&A are the surfaces that exist, and both are saved.",
              );
            }
          }}
        />
        <div style={{ flex: 1 }} />
        <Button
          size="compact"
          icon="spark"
          style={{
            borderColor: "var(--color-accent-300)",
            color: "var(--color-accent-800)",
          }}
          onClick={() => setView("transcript")}
        >
          Analyze Transcript
        </Button>
        <Button size="compact" icon="plus" onClick={addObservation}>
          Add Observation
        </Button>
      </div>

      {view === "rich" ? (
        <EmptyState message="The rich-text view of §6 arrives with the rich-text editor — observations and Q&A are the two surfaces that exist today, and both are saved." />
      ) : null}

      {view === "observations" ? (
        <>
          {fromTranscript > 0 ? (
            <div
              className="flex items-center"
              style={{
                gap: 10,
                padding: "8px 11px",
                border: "1px solid var(--color-accent-300)",
                background: "var(--color-accent-100)",
                marginBottom: 14,
              }}
            >
              <Icon
                name="spark"
                size={14}
                style={{ color: "var(--color-accent-800)", flex: "none" }}
              />
              <span
                style={{ flex: 1, fontSize: 12.5, color: "var(--color-accent-900)" }}
              >
                {fromTranscript} of these came from a transcript
              </span>
              <Button
                variant="primary"
                size="compact"
                style={{ fontSize: 11.5 }}
                onClick={() => setView("transcript")}
              >
                Open transcript
              </Button>
            </div>
          ) : observations.length === 0 ? (
            <EmptyState
              message={EMPTY_STATE_COPY.noFindings}
              action={
                <Button size="compact" icon="spark" onClick={() => setView("transcript")}>
                  Analyze Transcript
                </Button>
              }
              className="mb-[14px]"
            />
          ) : null}

          {observations.length > 0 ? (
            <div
              className="flex flex-col"
              style={{ gap: 9, marginBottom: 24 }}
            >
              {observations.map((observation, index) => (
                <ObservationCard
                  key={observation.id}
                  observation={observation}
                  photoSrc={
                    observation.imageId
                      ? photos.find((photo) => photo.id === observation.imageId)?.src
                      : undefined
                  }
                  index={index}
                  editing={editingId === observation.id}
                  onToggleEdit={() => {
                    if (editingId !== observation.id) {
                      setEditingId(observation.id);
                      return;
                    }
                    // Closing the card is the author saying it is finished.
                    setEditingId(null);
                    persist(observations);
                  }}
                  onChange={(patch) => patchObservation(observation.id, patch)}
                  onCommit={(next) => persist(next ?? observations)}
                  onDelete={() => deleteObservation(observation.id)}
                  onUnavailable={toast}
                />
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {view === "transcript" ? (
        /* The same panel the rail carries, hosted here because this is the
           section it belongs to — and because the rail is off the side of a
           phone. Pasting is the point: the transcript is made elsewhere. */
        <TranscriptPanel
          reportId={report.id}
          transcripts={transcripts}
          observations={observations}
        />
      ) : null}

      {view === "observations" || view === "qa" ? (
        <QaBlock onExtract={() => setView("transcript")} />
      ) : null}
    </div>
  );
}
