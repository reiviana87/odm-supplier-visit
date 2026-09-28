"use client";

import { useCallback, useRef, useState } from "react";

import { Blueprint } from "@/components/ui/blueprint";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { CompletionIndicator } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import { uploadReportPhoto } from "@/lib/data/photo-actions";
import { saveObservations } from "@/lib/data/report-actions";
import type { Observation, ReportStatus, SectionId } from "@/types/domain";

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
 * What is real, and what is still not, stated plainly rather than faked:
 *   · observations ARE persisted — Save writes the §6 list through
 *     `saveObservations` and the counter is the length of what came back;
 *   · camera hardware is not Phase 2 — the viewfinder shows a seeded photo and
 *     the shutter advances the local flow (see camera-screen.tsx);
 *   · offline sync is not Phase 2 — the weak-signal banner is real UI, the
 *     queue count behind it is seeded, and nothing is stored or replayed;
 *   · file upload and voice / transcript capture are not Phase 2 — their tiles
 *     say which phase they land in instead of pretending to work;
 *   · a photo or a note save still only moves the local counter and reports it.
 *     There is no capture store behind either one yet.
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
  /** The open visit every capture is filed against. */
  reportId: string;
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
  /**
   * Seeded: photo and note capture have no store yet. The third counter is
   * derived from `observations` instead of being passed, so the number on the
   * home screen cannot disagree with the list it counts.
   */
  counters: { photos: number; notes: number };
  /**
   * The report's §6 list as it stands. `saveObservations` replaces the whole
   * set, so the write needs the rows it must keep, not only the new one.
   */
  observations: readonly Observation[];
  lastPhotos: readonly VisitPhoto[];
  /** The frame standing in for the live viewfinder. */
  viewfinder: VisitPhoto;
  /** The photo already attached to the quick observation. */
  observationPhoto: VisitPhoto;
}

/** Natural dimensions, or zeros when the browser cannot decode the file. */
async function measureImage(file: File): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    return await new Promise<{ width: number; height: number }>((resolve) => {
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => resolve({ width: 0, height: 0 });
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function VisitMode({
  reportId,
  supplierName,
  visitLine,
  status,
  queuedItems,
  documentNumber,
  completion,
  sections,
  counters,
  observations,
  lastPhotos,
  viewfinder,
  observationPhoto,
}: VisitModeProps) {
  const { toast } = useToast();
  const [screen, setScreen] = useState<VisitScreen>("home");
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);

  const [tally, setTally] = useState(counters);
  const [filed, setFiled] = useState<readonly Observation[]>(observations);
  const [saving, setSaving] = useState(false);

  /**
   * Field photographs go straight to the appendix — §8's other two regions are
   * editorial choices made at a desk, and a phone in a factory is not the place
   * to make them.
   */
  const sendPhotos = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const list = Array.from(files);
      setUploading(list.length);

      let stored = 0;
      let firstError: string | null = null;

      for (const file of list) {
        const size = await measureImage(file);
        const result = await uploadReportPhoto({
          reportId,
          region: "APPENDIX_IMAGES",
          fileName: file.name,
          mimeType: file.type || "image/jpeg",
          width: size.width,
          height: size.height,
          capturedAt: file.lastModified ? new Date(file.lastModified).toISOString() : null,
          file,
        });
        if (result.ok) stored += 1;
        else if (!firstError) firstError = result.error.message;
      }

      setUploading(0);
      if (stored > 0) {
        setTally((current) => ({ ...current, photos: current.photos + stored }));
        toast(`${stored} photograph${stored === 1 ? "" : "s"} uploaded to the appendix.`);
      }
      if (firstError) toast(firstError, "error");
    },
    [reportId, toast],
  );

  /**
   * File one observation into §6.
   *
   * `saveObservations` takes the whole list and replaces it, so the new card
   * goes on the end of what is already there. The server assigns its id, which
   * is why the reply is kept rather than the payload: the next save has to send
   * the same row back with that id, or it would be deleted as surplus.
   *
   * A failure keeps the form open with the text still in it. The user is inside
   * a factory and may have no signal; losing what they just typed because the
   * write did not land is the one outcome worth designing against.
   */
  async function fileObservation(values: { category: string; text: string }) {
    // A category alone is not an observation, and `saveObservations` would take
    // the row because the category is never blank. Said in a toast rather than
    // by disabling Save: the approved button has one painted state.
    if (values.text.trim() === "") {
      toast("Write the observation before saving it.", "warning");
      return;
    }

    setSaving(true);
    const result = await saveObservations(reportId, [
      ...filed,
      {
        // The database assigns the real id — `saveObservations` treats an id it
        // does not already hold as a new card.
        id: "",
        category: values.category,
        // The approved mobile form has no priority control (README §17), so a
        // card captured in the field starts at the list's lowest priority and
        // is triaged on the desktop.
        priority: "Normal",
        text: values.text,
        sourceFindingId: null,
      },
    ]);
    setSaving(false);

    if (!result.ok) {
      toast(result.error.message, "error");
      return;
    }

    setFiled(result.data);
    setScreen("home");
    toast(`Observation saved to §6 · ${result.data.length} on this report`);
  }

  function handleAction(action: QuickActionId) {
    switch (action) {
      case "photo":
        // The real camera, not the mocked viewfinder: `capture` hands the OS
        // camera straight back as a file, which is the whole flow on a phone.
        if (uploading > 0) {
          toast(`Still uploading ${uploading} photograph${uploading === 1 ? "" : "s"}…`);
          return;
        }
        cameraRef.current?.click();
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
        if (uploading > 0) {
          toast(`Still uploading ${uploading} photograph${uploading === 1 ? "" : "s"}…`);
          return;
        }
        libraryRef.current?.click();
        return;
      case "voice":
        toast("Voice capture and transcript analysis land with transcript support");
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
      {/* One picker per affordance: `capture` opens the camera, the other the
          photo library. Hidden, because the approved grid is the UI. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(event) => {
          void sendPhotos(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(event) => {
          void sendPhotos(event.target.files);
          event.target.value = "";
        }}
      />

      <VisitHeader
        supplierName={supplierName}
        visitLine={visitLine}
        status={status}
        queuedItems={queuedItems}
      />

      {screen === "home" ? (
        <QuickActionGrid
          counters={{ ...tally, observations: filed.length }}
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
          saving={saving}
          onAttach={() => setScreen("camera")}
          onCancel={() => setScreen("home")}
          onSave={fileObservation}
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
