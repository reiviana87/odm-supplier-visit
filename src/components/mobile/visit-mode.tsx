"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Blueprint } from "@/components/ui/blueprint";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { CompletionIndicator } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { generatePhotoCaption } from "@/lib/ai/actions";
import { updatePhotoCaption, uploadReportPhoto } from "@/lib/data/photo-actions";
import {
  getSectionRecord,
  saveObservations,
  saveSection,
} from "@/lib/data/report-actions";
import { joinQaBullets, splitQaBullets } from "@/lib/data/report-mappers";
import {
  deleteTranscript,
  saveTranscript,
  type TranscriptSource,
} from "@/lib/data/transcript-actions";
import { prepareImage } from "@/lib/photos/prepare-image";
import {
  IMAGE_REGIONS,
  IMAGE_REGION_LABELS,
  type ImageRegion,
  type Observation,
  type ReportPhoto,
  type ReportStatus,
  type SectionId,
} from "@/types/domain";

import { CaptionSheet } from "./caption-sheet";
import { NoteForm } from "./note-form";
import { TranscriptForm } from "./transcript-form";
import { ObservationForm } from "./observation-form";
import { QuickActionGrid, type QuickActionId } from "./quick-action-grid";
import { VisitHeader } from "./visit-header";

/**
 * Mobile Visit Mode — README §17, prototype lines 2186..2333.
 *
 * Five screens: home · photos · note · observation · report. Navigation between
 * them is local component state, exactly as the prototype does it — they are not
 * routes, and the home grid is the only navigation (README §17: "Bottom
 * navigation — not used; the home grid is the navigation").
 *
 * What is real, and what is still not, stated plainly rather than faked:
 *   · photographs ARE stored — Take Photo opens the phone's own camera, the
 *     frame is shrunk and converted in the browser, a caption can be typed
 *     before it is sent, and Photos shows what this visit actually holds;
 *   · observations ARE persisted — Save writes the §6 list through
 *     `saveObservations` and the counter is the length of what came back;
 *   · notes ARE persisted — a Quick Note becomes one of §6's key points, which
 *     is what "something I do not want to lose before the desktop" meant;
 *   · offline sync is not built — the weak-signal banner is real UI, nothing is
 *     queued or replayed, and the count beside it now says zero rather than
 *     inventing a depth;
 *   · transcripts ARE stored — recording audio is not built, and the tile no
 *     longer pretends otherwise: it opens the field the text goes into, which
 *     the phone's own dictation key can fill;
 *   · Upload Photos is named for what its picker accepts. It said "Upload
 *     File" and took image/* only.
 *
 * There is no mock viewfinder any more. `capture="environment"` hands the
 * phone's own camera back as a file, which is both simpler and the thing that
 * works; the caption sheet then sits over the grid until each frame is filed.
 */

export type VisitScreen =
  | "home"
  | "photos"
  | "note"
  | "observation"
  | "voice"
  | "report";

/** One navigator row of the read-only report screen. */
export interface VisitSectionRow {
  id: SectionId;
  /** Displayed number: "1.", "4.1", or "" for General Information. */
  number: string;
  label: string;
  done: boolean;
  /**
   * What the section actually holds, in a line.
   *
   * A tick alone told the user nothing: the report screen listed thirteen
   * labels and thirteen circles, and a section could be ticked without the
   * reader learning a single thing that was written in it.
   */
  excerpt: string;
}

/**
 * A frame the camera has returned that nobody has filed yet.
 *
 * It is held here, un-uploaded, for exactly as long as the caption sheet is
 * open. That is the whole reason the queue exists: a caption typed while
 * standing in front of the machine is worth more than one written from memory
 * at a desk, and it cannot be typed after the upload has already happened.
 */
interface PendingPhoto {
  file: File;
  width: number;
  height: number;
  capturedAt: string | null;
  /** Object URL for the sheet's thumbnail; revoked when the frame is filed. */
  previewUrl: string;
}

export interface VisitModeProps {
  /** The open visit every capture is filed against. */
  reportId: string;
  supplierName: string;
  /** e.g. "Factory Visit · Aug 12 · 10:32". */
  visitLine: string;
  status: ReportStatus;
  documentNumber: string;
  /** 0–100, derived from the section predicates. */
  completion: number;
  sections: readonly VisitSectionRow[];
  /**
   * Counted from the report, not held here: photographs are `report_images`
   * rows and notes are §6's key points. The third counter is derived from
   * `observations` instead of being passed, so the number on the home screen
   * cannot disagree with the list it counts.
   */
  counters: { photos: number; notes: number };
  /**
   * The report's §6 list as it stands. `saveObservations` replaces the whole
   * set, so the write needs the rows it must keep, not only the new one.
   */
  observations: readonly Observation[];
  /** §6's key points, one per line on the `visit` row — what a Note becomes. */
  keyPoints: readonly string[];
  /** The transcripts already saved against this report. */
  transcripts: readonly TranscriptSource[];
  /** Every stored photograph, in print order — what the Photos screen shows. */
  photos: readonly ReportPhoto[];
  /** The six most recent, for the home strip. */
  lastPhotos: readonly ReportPhoto[];
}

/**
 * What to say when the phone handed over something this browser cannot decode.
 *
 * On the phone itself this should not happen — iOS reads its own HEIC — so the
 * sentence is written for the other case, a visit being written up afterwards
 * on a desktop from photographs copied off the phone.
 */
function cannotRead(file: File): string {
  return /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)
    ? `${file.name} could not be read here. Upload it from the iPhone itself, or set Settings › Camera › Formats › Most Compatible and share it again.`
    : `${file.name} could not be read as an image.`;
}

export function VisitMode({
  reportId,
  supplierName,
  visitLine,
  status,
  documentNumber,
  completion,
  sections,
  counters,
  observations,
  keyPoints,
  transcripts,
  photos,
  lastPhotos,
}: VisitModeProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [screen, setScreen] = useState<VisitScreen>("home");
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(0);

  const [pending, setPending] = useState<readonly PendingPhoto[]>([]);
  const [caption, setCaption] = useState("");
  const [region, setRegion] = useState<ImageRegion>("APPENDIX_IMAGES");
  const [filing, setFiling] = useState(false);

  const [filed, setFiled] = useState<readonly Observation[]>(observations);
  const [saving, setSaving] = useState(false);

  /**
   * Prepare the frames the camera returned, and stop.
   *
   * Nothing is uploaded here. Each file is shrunk and converted — a phone
   * photograph is several times larger than one request may carry and many
   * times more detailed than the page can print — and then queued for the
   * caption sheet, which is what actually sends it.
   */
  const queuePhotos = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const list = Array.from(files);
      setPreparing(list.length);

      const prepared: PendingPhoto[] = [];
      let firstError: string | null = null;

      for (const file of list) {
        const image = await prepareImage(file);
        if (!image) {
          if (!firstError) firstError = cannotRead(file);
          continue;
        }
        prepared.push({
          file: image.file,
          width: image.width,
          height: image.height,
          capturedAt: file.lastModified ? new Date(file.lastModified).toISOString() : null,
          previewUrl: URL.createObjectURL(image.file),
        });
      }

      setPreparing(0);
      if (firstError) toast(firstError, "error");
      if (prepared.length > 0) {
        setCaption("");
        setPending((current) => [...current, ...prepared]);
      }
    },
    [toast],
  );

  /**
   * File the frame at the head of the queue.
   *
   * The caption is written in a second call rather than as part of the upload:
   * `uploadReportPhoto` hands back the new row id, and `updatePhotoCaption`
   * already exists and already records that the words are the author's and not
   * the model's. A caption that fails to save does not cost the photograph —
   * by then it is stored, and the sentence says which of the two happened.
   */
  const fileHead = useCallback(
    async (mode: "mine" | "ai") => {
      const head = pending[0];
      if (!head || filing) return;

      setFiling(true);
      const result = await uploadReportPhoto({
        reportId,
        region,
        fileName: head.file.name,
        mimeType: head.file.type || "image/jpeg",
        width: head.width,
        height: head.height,
        capturedAt: head.capturedAt,
        file: head.file,
      });

      if (!result.ok) {
        setFiling(false);
        toast(result.error.message, "error");
        return;
      }

      const text = caption.trim();
      let note: string;

      if (mode === "ai") {
        // The button says the model will caption it, so the model is asked —
        // here, not "later" in some queue that does not exist. The proposal
        // lands in ai_caption and waits to be accepted at a desk, which is the
        // §16 rule: nothing the model writes becomes the caption on its own.
        const suggested = await generatePhotoCaption({
          reportId,
          photoId: result.data.id,
          hint: text || undefined,
        });
        note = suggested.ok
          ? `Filed under ${IMAGE_REGION_LABELS[region]} — the AI drafted a caption to review.`
          : `Filed under ${IMAGE_REGION_LABELS[region]}, but the AI caption failed: ${suggested.error.message}`;
      } else if (text !== "") {
        const captioned = await updatePhotoCaption(result.data.id, text);
        note = captioned.ok
          ? `Filed under ${IMAGE_REGION_LABELS[region]} with your caption.`
          : `Photograph saved, but its caption did not: ${captioned.error.message}`;
      } else {
        note = `Filed under ${IMAGE_REGION_LABELS[region]} — caption still to write.`;
      }

      URL.revokeObjectURL(head.previewUrl);
      setPending((current) => current.slice(1));
      setCaption("");
      setFiling(false);
      router.refresh();
      toast(note);
    },
    [caption, filing, pending, region, reportId, router, toast],
  );

  /** Drop the head of the queue without storing it, and open the camera again. */
  const retakeHead = useCallback(() => {
    const head = pending[0];
    if (head) URL.revokeObjectURL(head.previewUrl);
    setPending((current) => current.slice(1));
    setCaption("");
    cameraRef.current?.click();
  }, [pending]);

  /**
   * Replace §6's key points with `next`.
   *
   * Read-modify-write against the row's current version rather than the one
   * the phone loaded when the visit started: someone at a desk may well be in
   * the same section, and a stale version is a refused write, not a silent
   * overwrite.
   */
  const writeKeyPoints = useCallback(
    async (next: readonly string[]): Promise<boolean> => {
      const record = await getSectionRecord(reportId, "visit");
      if (!record.ok) {
        toast(record.error.message, "error");
        return false;
      }
      const result = await saveSection({
        reportId,
        sectionId: "visit",
        body: joinQaBullets([...next]),
        version: record.data.version,
      });
      if (!result.ok) {
        toast(result.error.message, "error");
        return false;
      }
      router.refresh();
      return true;
    },
    [reportId, router, toast],
  );

  /**
   * Store one photograph immediately and hand back the row it became.
   *
   * The observation form needs an id to point at before its own Save runs, so
   * this cannot wait for the caption sheet the way Take Photo does. It files to
   * the appendix like every other photograph — the observation refers to it, it
   * does not own it — and the returned object URL is only for the thumbnail on
   * the form, which lives as long as the screen does.
   */
  const capturePhoto = useCallback(
    async (file: File): Promise<{ id: string; src: string } | null> => {
      const image = await prepareImage(file);
      if (!image) {
        toast(cannotRead(file), "error");
        return null;
      }

      const result = await uploadReportPhoto({
        reportId,
        region: "APPENDIX_IMAGES",
        fileName: image.file.name,
        mimeType: image.file.type || "image/jpeg",
        width: image.width,
        height: image.height,
        capturedAt: file.lastModified ? new Date(file.lastModified).toISOString() : null,
        file: image.file,
      });
      if (!result.ok) {
        toast(result.error.message, "error");
        return null;
      }

      router.refresh();
      return { id: result.data.id, src: URL.createObjectURL(image.file) };
    },
    [reportId, router, toast],
  );

  /** Replace §6's observation cards. */
  const writeObservations = useCallback(
    async (next: readonly Observation[]): Promise<boolean> => {
      const result = await saveObservations(reportId, next);
      if (!result.ok) {
        toast(result.error.message, "error");
        return false;
      }
      setFiled(result.data);
      router.refresh();
      return true;
    },
    [reportId, router, toast],
  );

  /**
   * A Quick Note becomes one of §6's key points.
   *
   * It used to become nothing at all: the text sat in the form's own state, the
   * counter moved, and the note was gone. Key points are the right home for it —
   * already one bullet per line on the `visit` row, already exported, already
   * editable at a desk. The row is re-read immediately before the write so the
   * version is the current one rather than whatever the phone loaded when the
   * visit started.
   */
  async function fileNote(text: string) {
    const note = text.trim();
    if (note === "") {
      toast("Write the note before saving it.", "warning");
      return;
    }

    setSaving(true);
    // Appended to what the row holds now, not to the `keyPoints` prop: the prop
    // only catches up after `router.refresh()`, so two notes written quickly in
    // a row would see the same list and the first would be overwritten.
    const record = await getSectionRecord(reportId, "visit");
    if (!record.ok) {
      setSaving(false);
      toast(record.error.message, "error");
      return;
    }
    const saved = await writeKeyPoints([...splitQaBullets(record.data.body), note]);
    setSaving(false);
    if (!saved) return;

    // Deliberately stays on the screen: the answer to "where did that go?" is
    // the list underneath, which the note has just joined.
    toast(`Saved to §6 key points · ${keyPoints.length + 1} on this report`);
  }

  /**
   * Store what was pasted or dictated as a source on the report.
   *
   * Named by the day rather than by a file, because it came from a keyboard
   * and not from a file: "Dictated on the visit" is what the Sources list at a
   * desk will show, and it is true.
   */
  async function fileTranscript(content: string) {
    setSaving(true);
    const result = await saveTranscript({
      reportId,
      fileName: "Dictated on the visit",
      content,
    });
    setSaving(false);

    if (!result.ok) {
      toast(result.error.message, "error");
      return;
    }
    router.refresh();
    toast(`Transcript saved — ${result.data.wordCount.toLocaleString("en-US")} words.`);
  }

  async function dropTranscript(id: string) {
    setSaving(true);
    const result = await deleteTranscript(id);
    setSaving(false);
    if (!result.ok) {
      toast(result.error.message, "error");
      return;
    }
    router.refresh();
    toast("Transcript removed.");
  }

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
  async function fileObservation(values: {
    category: string;
    text: string;
    imageId: string | null;
  }) {
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
        imageId: values.imageId,
      },
    ]);
    setSaving(false);

    if (!result.ok) {
      toast(result.error.message, "error");
      return;
    }

    setFiled(result.data);
    toast(`Observation saved to §6 · ${result.data.length} on this report`);
  }

  function handleAction(action: QuickActionId) {
    switch (action) {
      case "photo":
        // The real camera, not a mocked viewfinder: `capture` hands the OS
        // camera straight back as a file, which is the whole flow on a phone.
        if (preparing > 0) return;
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
        if (preparing > 0) return;
        libraryRef.current?.click();
        return;
      case "voice":
        setScreen("voice");
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
      {/* Take Photo used to force the camera with `capture`, which meant a
          photograph already on the phone could only be reached through Upload
          File. Without the attribute iOS offers the choice itself — Take Photo,
          Photo Library, Choose File — which is what the tile should have done
          from the start. Upload File keeps `multiple`, for filing a batch at
          the end of a visit. Hidden, because the approved grid is the UI. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          void queuePhotos(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          void queuePhotos(event.target.files);
          event.target.value = "";
        }}
      />

      <VisitHeader supplierName={supplierName} visitLine={visitLine} status={status} />

      {pending.length === 0 && screen === "home" ? (
        <QuickActionGrid
          counters={{ ...counters, observations: filed.length }}
          lastPhotos={lastPhotos}
          onAction={handleAction}
          onOpenPhotos={() => setScreen("photos")}
          onOpenNotes={() => setScreen("note")}
          onOpenObservations={() => setScreen("observation")}
        />
      ) : null}

      {pending.length === 0 && screen === "photos" ? (
        <PhotoScreen
          photos={photos}
          onBack={() => setScreen("home")}
          onCaptioned={() => router.refresh()}
        />
      ) : null}

      {pending.length === 0 && screen === "note" ? (
        <NoteForm
          keyPoints={keyPoints}
          onReplace={writeKeyPoints}
          saving={saving}
          onCancel={() => setScreen("home")}
          onSave={fileNote}
        />
      ) : null}

      {pending.length === 0 && screen === "observation" ? (
        <ObservationForm
          observations={filed}
          photos={photos}
          onCapturePhoto={capturePhoto}
          onReplace={writeObservations}
          saving={saving}
          onCancel={() => setScreen("home")}
          onSave={fileObservation}
        />
      ) : null}

      {pending.length === 0 && screen === "voice" ? (
        <TranscriptForm
          transcripts={transcripts}
          saving={saving}
          onSave={fileTranscript}
          onDelete={dropTranscript}
          onCancel={() => setScreen("home")}
        />
      ) : null}

      {pending.length === 0 && screen === "report" ? (
        <ReportPreview
          documentNumber={documentNumber}
          completion={completion}
          sections={sections}
          onBack={() => setScreen("home")}
        />
      ) : null}

      {preparing > 0 ? (
        <p
          role="status"
          style={{
            margin: 0,
            padding: "10px 16px",
            fontSize: 12.5,
            borderTop: "1px solid var(--color-divider)",
            color: "var(--color-neutral-700)",
          }}
        >
          Preparing {preparing} photograph{preparing === 1 ? "" : "s"}…
        </p>
      ) : null}

      {/* The caption step takes the screen.
          It used to be appended under whichever screen was open, which put it
          at the bottom of a long scrolling page — under the browser's own
          toolbar on a phone, where a tap lands on the toolbar and the button
          appears not to work. A frame the camera has returned and nobody has
          filed is the most urgent thing on the phone; it gets the screen. */}
      {pending.length > 0 ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "14px 16px 10px" }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: "var(--color-neutral-600)",
                marginBottom: 7,
              }}
            >
              {pending.length === 1
                ? "1 photograph to file"
                : `${pending.length} photographs to file`}
            </div>
            <Select
              aria-label="Destination section"
              value={region}
              disabled={filing}
              onChange={(event) => setRegion(event.target.value as ImageRegion)}
              // The one control that cannot meet the 44px touch target
              // invisibly: a native <select> renders no ::after and a
              // transparent wrapper cannot open its popup, so the box itself
              // grows (README §24).
              style={{ fontSize: 12.5, minHeight: 44 }}
            >
              {IMAGE_REGIONS.map((option) => (
                <option key={option} value={option}>
                  Section · {IMAGE_REGION_LABELS[option]}
                </option>
              ))}
            </Select>
          </div>

          {/* Pushed to the foot of the viewport rather than to the foot of the
              document: the two buttons stay where a thumb expects them. */}
          <div style={{ marginTop: "auto" }}>
            <CaptionSheet
              src={pending[0].previewUrl}
              photoNumber={counters.photos + 1}
              sectionLabel={IMAGE_REGION_LABELS[region]}
              value={caption}
              onChange={setCaption}
              busy={filing}
              onRetake={retakeHead}
              onAiLater={() => void fileHead("ai")}
              onSave={() => void fileHead("mine")}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Photos — what this visit has actually stored, and where a caption gets typed.
 *
 * [INFERRED] The approved design has no such screen: the prototype's home strip
 * is six thumbnails with nowhere to go. But a photograph that cannot be looked
 * at on the phone that took it, and a caption that can only be written at a desk
 * days later, are not what a factory floor needs. Built from the screens beside
 * it rather than from anything new — the report screen's padding and type, the
 * caption sheet's textarea.
 */
function PhotoScreen({
  photos,
  onBack,
  onCaptioned,
}: {
  photos: readonly ReportPhoto[];
  onBack: () => void;
  onCaptioned: () => void;
}) {
  const { toast } = useToast();
  // Keyed by photo id: what the user has typed but not yet committed. What is
  // stored stays the source of truth for every card not being edited.
  const [edits, setEdits] = useState<Record<string, string>>({});

  // Newest first — during a visit the useful end is what was just taken, which
  // is the opposite of the appendix print order these arrive in.
  const newestFirst = [...photos].reverse();

  async function commit(photo: ReportPhoto, next: string) {
    if (next.trim() === photo.caption.trim()) return;
    const result = await updatePhotoCaption(photo.id, next.trim());
    if (!result.ok) {
      toast(result.error.message, "error");
      return;
    }
    toast("Caption saved.");
    onCaptioned();
  }

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
        Photos
      </h2>
      <p style={{ fontSize: 12.5, color: "var(--color-neutral-700)", margin: "0 0 14px" }}>
        {photos.length} on this visit · the caption here is the one the report prints
      </p>

      {photos.length === 0 ? (
        <EmptyState message="No photographs yet. Take Photo files one straight into the report." />
      ) : (
        <div className="flex flex-col" style={{ gap: 14, marginBottom: 16 }}>
          {newestFirst.map((photo) => (
            <Blueprint key={photo.id} style={{ padding: 10 }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- stored
                  photograph behind a signed URL, no known intrinsic size. */}
              <img
                src={photo.src}
                alt={photo.caption || "Stored photograph, no caption yet"}
                style={{
                  width: "100%",
                  maxHeight: 260,
                  objectFit: "contain",
                  background: "var(--color-neutral-100)",
                  display: "block",
                  marginBottom: 8,
                }}
              />
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: "var(--color-neutral-600)",
                  marginBottom: 5,
                }}
              >
                {IMAGE_REGION_LABELS[photo.region]}
              </div>
              <Textarea
                aria-label="Caption"
                value={edits[photo.id] ?? photo.caption}
                placeholder="Type a caption — or leave it for the AI at the desk"
                onChange={(event) =>
                  setEdits((current) => ({ ...current, [photo.id]: event.target.value }))
                }
                onBlur={(event) => void commit(photo, event.target.value)}
                style={{ minHeight: 60, fontSize: 13, lineHeight: 1.45 }}
              />
            </Blueprint>
          ))}
        </div>
      )}

      <Button variant="secondary" onClick={onBack} block style={{ fontSize: 14, minHeight: 48 }}>
        Back to Visit Mode
      </Button>
    </div>
  );
}

/**
 * The report as it stands — prototype lines 2310..2330, with the content added.
 *
 * The approved screen is the document number, the completion block, the
 * thirteen section rows and the way back. It was exactly that and nothing more,
 * so a section could be ticked without the reader learning one thing that was
 * written in it — "I can only see what is ticked" was the complaint, and it was
 * fair. Each row now carries a line of what the section actually holds. Editing
 * still stays on the desktop; this is a preview, which is what it claimed to be.
 */
function ReportPreview({
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

      <CompletionIndicator value={completion} label="Completion" className="mb-[16px]" />

      <Blueprint style={{ padding: 0, marginBottom: 16 }}>
        {sections.map((section) => (
          <div
            key={section.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 9,
              padding: "9px 11px",
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
                marginTop: 2,
                color: section.done ? "var(--color-accent)" : "var(--color-neutral-400)",
              }}
            />
            <span
              style={{
                width: 22,
                flex: "none",
                marginTop: 1,
                fontSize: 11,
                color: "var(--color-neutral-600)",
              }}
            >
              {section.number}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 12.5 }}>{section.label}</span>
              <span
                style={{
                  display: "block",
                  marginTop: 2,
                  fontSize: 11.5,
                  lineHeight: 1.45,
                  color: section.excerpt
                    ? "var(--color-neutral-700)"
                    : "var(--color-neutral-500)",
                }}
              >
                {section.excerpt || "Empty"}
              </span>
            </span>
          </div>
        ))}
      </Blueprint>

      <Button variant="secondary" onClick={onBack} block style={{ fontSize: 14, minHeight: 48 }}>
        Back to Visit Mode
      </Button>
    </div>
  );
}
