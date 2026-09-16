"use client";

import { useState } from "react";

import { Blueprint } from "@/components/ui/blueprint";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { CompletionIndicator } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import type { ReportStatus, SectionId } from "@/types/domain";

import { CameraScreen } from "./camera-screen";
import { NoteForm } from "./note-form";
import { ObservationForm } from "./observation-form";
import {
  QuickActionGrid,
  type QuickActionId,
  type VisitPhoto,
} from "./quick-action-grid";
import { VisitHeader } from "./visit-header";

/**
 * Mobile Visit Mode — README §17, prototype lines 2186..2333.
 *
 * Five screens: home · camera · note · observation · report. Navigation
 * between them is local component state, exactly as the prototype does it —
 * they are not routes, and the home grid is the only navigation (README §17:
 * "Bottom navigation — not used; the home grid is the navigation").
 *
 * Phase 1 scope, stated plainly rather than faked:
 *   · camera hardware is not Phase 1 — the viewfinder shows a seeded photo and
 *     the shutter advances the local flow (see camera-screen.tsx);
 *   · offline sync is not Phase 1 — the weak-signal banner is real UI, the
 *     queue count behind it is seeded, and nothing is stored or replayed;
 *   · file upload and voice / transcript capture are not Phase 1 — their tiles
 *     say which phase they land in instead of pretending to work;
 *   · what a save does today is move the local counter and report it. There is
 *     no store behind Visit Mode yet.
 */

export type VisitScreen = "home" | "camera" | "note" | "observation" | "report";

/** One navigator row of the read-only report screen. */
export interface VisitSectionRow {
  id: SectionId;
  /** Displayed number: "1.", "4.1", or "" for General Information. */
  number: string;
  label: string;
  done: boolean;
}

export interface VisitModeProps {
  supplierName: string;
  /** e.g. "Factory Visit · Aug 12 · 10:32". */
  visitLine: string;
  status: ReportStatus;
  /** Seeded offline-queue depth shown in the header banner. */
  queuedItems: number;
  documentNumber: string;
  /** 0–100, derived from the section predicates. */
  completion: number;
  sections: readonly VisitSectionRow[];
  counters: { photos: number; notes: number; observations: number };
  lastPhotos: readonly VisitPhoto[];
  /** The frame standing in for the live viewfinder. */
  viewfinder: VisitPhoto;
  /** The photo already attached to the quick observation. */
  observationPhoto: VisitPhoto;
}

export function VisitMode({
  supplierName,
  visitLine,
  status,
  queuedItems,
  documentNumber,
  completion,
  sections,
  counters,
  lastPhotos,
  viewfinder,
  observationPhoto,
}: VisitModeProps) {
  const { toast } = useToast();
  const [screen, setScreen] = useState<VisitScreen>("home");
  const [tally, setTally] = useState(counters);

  function handleAction(action: QuickActionId) {
    switch (action) {
      case "photo":
        setScreen("camera");
        toast("Live camera lands in Phase 2 — the viewfinder shows a sample frame");
        return;
      case "note":
        setScreen("note");
        return;
      case "observation":
        setScreen("observation");
        return;
      case "report":
        setScreen("report");
        return;
      case "upload":
        toast("Uploading files from the field lands in Phase 2");
        return;
      case "voice":
        toast("Voice capture and transcript analysis land in Phase 2");
        return;
    }
  }

  return (
    <div
      style={{
        fontFamily: "var(--font-body)",
        background: "var(--color-bg)",
        minHeight: "100%",
        flex: 1,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <VisitHeader
        supplierName={supplierName}
        visitLine={visitLine}
        status={status}
        queuedItems={queuedItems}
      />

      {screen === "home" ? (
        <QuickActionGrid
          counters={tally}
          lastPhotos={lastPhotos}
          onAction={handleAction}
        />
      ) : null}

      {screen === "camera" ? (
        <CameraScreen
          src={viewfinder.src}
          todayCount={tally.photos}
          onPhotoSaved={() =>
            setTally((current) => ({ ...current, photos: current.photos + 1 }))
          }
          onExit={() => setScreen("home")}
        />
      ) : null}

      {screen === "note" ? (
        <NoteForm
          onCancel={() => setScreen("home")}
          onSave={() => {
            const notes = tally.notes + 1;
            setTally((current) => ({ ...current, notes }));
            setScreen("home");
            toast(`Note saved · ${notes} notes today`);
          }}
        />
      ) : null}

      {screen === "observation" ? (
        <ObservationForm
          photo={observationPhoto}
          onAttach={() => setScreen("camera")}
          onCancel={() => setScreen("home")}
          onSave={() => {
            setTally((current) => ({
              ...current,
              observations: current.observations + 1,
            }));
            setScreen("home");
            toast("Observation saved to §6 · queued for sync");
          }}
        />
      ) : null}

      {screen === "report" ? (
        <ReportScreen
          documentNumber={documentNumber}
          completion={completion}
          sections={sections}
          onBack={() => setScreen("home")}
        />
      ) : null}
    </div>
  );
}

/**
 * The read-only report screen — prototype lines 2310..2330.
 *
 * Document number, the completion block, the thirteen section rows with their
 * completion ticks, and the way back. Editing stays on the desktop.
 */
function ReportScreen({
  documentNumber,
  completion,
  sections,
  onBack,
}: {
  documentNumber: string;
  completion: number;
  sections: readonly VisitSectionRow[];
  onBack: () => void;
}) {
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
        {documentNumber}
      </h2>
      <p
        style={{
          fontSize: 12.5,
          color: "var(--color-neutral-700)",
          margin: "0 0 14px",
        }}
      >
        Read-only on mobile · complete on desktop
      </p>

      <CompletionIndicator
        value={completion}
        label="Completion"
        className="mb-[16px]"
      />

      <Blueprint style={{ padding: 0, marginBottom: 16 }}>
        {sections.map((section) => (
          <div
            key={section.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "8px 11px",
              borderBottom: "1px solid var(--rule-row)",
            }}
          >
            <Icon
              name={section.done ? "check" : "circle"}
              size={13}
              strokeWidth={1.8}
              title={section.done ? "Complete" : "Not complete"}
              style={{
                flex: "none",
                color: section.done
                  ? "var(--color-accent)"
                  : "var(--color-neutral-400)",
              }}
            />
            <span
              style={{
                width: 22,
                flex: "none",
                fontSize: 11,
                color: "var(--color-neutral-600)",
              }}
            >
              {section.number}
            </span>
            <span style={{ flex: 1, fontSize: 12.5 }}>{section.label}</span>
          </div>
        ))}
      </Blueprint>

      <Button
        variant="secondary"
        onClick={onBack}
        block
        style={{ fontSize: 14, minHeight: 48 }}
      >
        Back to Visit Mode
      </Button>
    </div>
  );
}
