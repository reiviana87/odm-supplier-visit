"use client";

import { useState } from "react";

import { Blueprint } from "@/components/ui/blueprint";
import { Tag, type TagTone } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { EmptyState, EMPTY_STATE_COPY } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { transcriptFindingCounts } from "@/lib/mock-data";
import type { Observation, Report } from "@/types/domain";

/**
 * §6 Visit Relevant Information — prototype lines 1070..1138 and the approved
 * capture `screenshots/05-editor-visit-relevant-information.png`.
 *
 * Observations are the section's content; the Q&A block is **optional**
 * (README §25) and carries its own `Optional` tag and exclude control. The
 * banner counts come from the transcript findings, never from a constant:
 * README §12 — "9 AI findings … · 4 already added".
 */

type VisitView = "observations" | "qa" | "rich";

const VIEWS: ReadonlyArray<{ id: VisitView; label: string }> = [
  { id: "observations", label: "Observations" },
  { id: "qa", label: "Q&A" },
  { id: "rich", label: "Rich text" },
];

/** Prototype line 3001 — Normal is the neutral tag, anything higher warns. */
const PRIORITY_TONE: Record<Observation["priority"], TagTone> = {
  Normal: "neutral",
  High: "warning",
  Critical: "danger",
};

const TRANSCRIPT_PHASE = "Transcript analysis arrives in Phase 6";

function ObservationCard({
  observation,
  onUnavailable,
}: {
  observation: Observation;
  onUnavailable: (message: string) => void;
}) {
  return (
    <Blueprint style={{ padding: "11px 12px" }}>
      <div className="flex items-center" style={{ gap: 7, marginBottom: 6 }}>
        <Tag tone="outline" style={{ fontSize: 10 }}>
          {observation.category}
        </Tag>
        <Tag tone={PRIORITY_TONE[observation.priority]}>{observation.priority}</Tag>
        <div style={{ flex: 1 }} />
        <IconButton
          label="Attach photo"
          name="image"
          size={23}
          className="text-neutral-500"
          onClick={() => onUnavailable("Attaching a photo arrives in Phase 4")}
        />
        <IconButton
          label="Edit observation"
          name="pencil"
          size={23}
          className="text-neutral-500"
          onClick={() => onUnavailable("Editing observations arrives in Phase 2")}
        />
        <IconButton
          label="Delete observation"
          name="trash"
          size={23}
          className="text-neutral-500"
          onClick={() => onUnavailable("Deleting observations arrives in Phase 2")}
        />
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.6 }}>{observation.text}</div>
    </Blueprint>
  );
}

function QaBlock({ report }: { report: Report }) {
  const { toast } = useToast();
  const [included, setIncluded] = useState(report.sections.qaIncluded);
  const [bullets, setBullets] = useState(() =>
    report.sections.qaBullets.map((text, index) => ({
      id: `qa-${index}`,
      text,
    })),
  );
  const [nextId, setNextId] = useState(report.sections.qaBullets.length);

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
          onClick={() => setIncluded((current) => !current)}
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
                    setBullets((current) =>
                      current.map((item) =>
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
                    setBullets((current) =>
                      current.filter((item) => item.id !== bullet.id),
                    )
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
              onClick={() => toast(TRANSCRIPT_PHASE)}
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
            <Button size="compact" onClick={() => setIncluded(true)}>
              Include again
            </Button>
          }
        />
      )}
    </>
  );
}

export function VisitSection({ report }: { report: Report }) {
  const { toast } = useToast();
  const [view, setView] = useState<VisitView>("observations");

  const observations = report.sections.observations;
  const counts = transcriptFindingCounts();
  /**
   * The seeded findings belong to the report whose observations came from
   * them; a report with no transcript-sourced observation has nothing to
   * review yet, and shows the §21 empty state instead of another report's
   * counts.
   */
  const hasFindings = observations.some(
    (observation) => observation.sourceFindingId !== null,
  );

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
              toast("The §6 rich-text view arrives with the rich-text editor in Phase 2");
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
          onClick={() => toast(TRANSCRIPT_PHASE)}
        >
          Analyze Transcript
        </Button>
        <Button
          size="compact"
          icon="plus"
          onClick={() => toast("Adding an observation arrives in Phase 2")}
        >
          Add Observation
        </Button>
      </div>

      {view === "rich" ? (
        <EmptyState message="The rich-text view of §6 arrives with the rich-text editor in Phase 2 — observations and Q&A are the approved Phase 1 surfaces." />
      ) : null}

      {view === "observations" ? (
        <>
          {hasFindings ? (
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
                {counts.open} AI findings from the transcript are waiting for review ·{" "}
                {counts.added} already added
              </span>
              <Button
                variant="primary"
                size="compact"
                style={{ fontSize: 11.5 }}
                onClick={() => toast(TRANSCRIPT_PHASE)}
              >
                Review findings
              </Button>
            </div>
          ) : (
            <EmptyState
              message={EMPTY_STATE_COPY.noFindings}
              action={
                <Button
                  size="compact"
                  icon="spark"
                  onClick={() => toast(TRANSCRIPT_PHASE)}
                >
                  Analyze Transcript
                </Button>
              }
              className="mb-[14px]"
            />
          )}

          {observations.length > 0 ? (
            <div
              className="flex flex-col"
              style={{ gap: 9, marginBottom: 24 }}
            >
              {observations.map((observation) => (
                <ObservationCard
                  key={observation.id}
                  observation={observation}
                  onUnavailable={toast}
                />
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {view === "observations" || view === "qa" ? <QaBlock report={report} /> : null}
    </div>
  );
}
