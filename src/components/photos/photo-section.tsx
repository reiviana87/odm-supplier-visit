"use client";

import { useCallback, useMemo, useState, type JSX } from "react";

import { Blueprint } from "@/components/ui/blueprint";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { EmptyState, EMPTY_STATE_COPY } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import type {
  CaptionSource,
  ImageRegion,
  PhotoCaptionState,
  Report,
  ReportPhoto,
} from "@/types/domain";

import { AppendixLayout } from "./appendix-layout";
import { PhotoCard, type PhotoCardAction } from "./photo-card";
import { PhotoGrid } from "./photo-grid";
import { PhotoToolbar } from "./photo-toolbar";

/**
 * The photo manager of one image region — README §9–11 (screens 9, 10, 11),
 * §14 (the appendix Layout & Preview tab) and §10 (the shared photo model).
 *
 * The section title row belongs to `SectionFrame`, so this renders only the
 * toolbar, the grid and — for `APPENDIX_IMAGES` — the inline Photos /
 * Layout & Preview tabs.
 *
 * Phase 1 scope: uploading, AI captioning, bulk actions, drag reorder and
 * move-between-sections are later phases and say so. Caption editing is real
 * local state: typing marks the caption user-written and clears the AI
 * suggestion, and Accept genuinely takes the suggestion (README §11 — AI
 * output is a proposal until a human accepts it).
 */

/** Where each control lands, so no button is dead and none fakes a result. */
const PHASE = {
  upload: "Photo upload arrives in Phase 3",
  replace: "Replacing a photo arrives with the upload pipeline in Phase 3",
  retry: "Upload retry arrives with the upload pipeline in Phase 3",
  download: "Downloading the original arrives in Phase 3",
  caption: "AI captioning arrives in Phase 4",
  analyze: "Image analysis arrives in Phase 4",
  arrange: "Automatic arrangement arrives in Phase 3",
  reorder: "Drag to reorder arrives in Phase 3",
  move: "Moving photos between sections arrives in Phase 3",
  delete: "Deleting a photo arrives with report persistence in Phase 2",
} as const;

/** The locally edited fields of a caption. Everything else stays as seeded. */
interface CaptionEdit {
  caption: string;
  captionSource: CaptionSource;
  captionState: PhotoCaptionState;
}

type AppendixView = "photos" | "layout";

const NO_SELECTION: ReadonlySet<string> = new Set<string>();

const APPENDIX_TABS = [
  { id: "photos", label: "Photos" },
  { id: "layout", label: "Layout & Preview" },
];

export interface PhotoSectionProps {
  region: ImageRegion;
  report: Report;
  /** Every photo of the report; the region's own are selected here. */
  photos: readonly ReportPhoto[];
}

export function PhotoSection({
  region,
  report,
  photos,
}: PhotoSectionProps): JSX.Element {
  const { toast } = useToast();

  const [edits, setEdits] = useState<Record<string, CaptionEdit>>({});
  const [selected, setSelected] = useState<ReadonlySet<string>>(NO_SELECTION);
  const [view, setView] = useState<AppendixView>("photos");

  // Sections share this component, so a region change has to drop the edits
  // and the selection of the region being left behind.
  const [renderedRegion, setRenderedRegion] = useState<ImageRegion>(region);
  if (renderedRegion !== region) {
    setRenderedRegion(region);
    setEdits({});
    setSelected(NO_SELECTION);
    setView("photos");
  }

  const source = useMemo(
    () =>
      photos
        .filter((photo) => photo.region === region)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [photos, region],
  );

  const items = useMemo(
    () =>
      source.map((photo) => {
        const edit = edits[photo.id];
        return edit ? { ...photo, ...edit } : photo;
      }),
    [source, edits],
  );

  const missingCaptions = items.filter(
    (photo) => photo.caption.trim().length === 0,
  ).length;
  const awaitingReview = items.filter(
    (photo) => photo.captionState === "suggested" && photo.aiCaption.trim().length > 0,
  ).length;

  const handleCaptionChange = useCallback((id: string, caption: string) => {
    // README §11 — typing over a suggestion makes the caption the user's.
    setEdits((current) => ({
      ...current,
      [id]: {
        caption,
        captionSource: "user",
        captionState: caption.trim().length > 0 ? "accepted" : "none",
      },
    }));
  }, []);

  const handleAcceptCaption = useCallback(
    (id: string) => {
      const photo = source.find((candidate) => candidate.id === id);
      if (!photo) return;
      setEdits((current) => ({
        ...current,
        [id]: {
          caption: photo.aiCaption,
          captionSource: "ai",
          captionState: "accepted",
        },
      }));
      toast("Caption accepted");
    },
    [source, toast],
  );

  const handleCardAction = useCallback(
    (action: PhotoCardAction) => {
      toast(PHASE[action === "rewrite" ? "caption" : action]);
    },
    [toast],
  );

  const toggleSelectAll = useCallback(() => {
    setSelected((current) =>
      current.size === source.length && source.length > 0
        ? NO_SELECTION
        : new Set(source.map((photo) => photo.id)),
    );
  }, [source]);

  const uploadButton = (
    <Button icon="upload" onClick={() => toast(PHASE.upload)}>
      Upload Images
    </Button>
  );

  const grid = (
    <PhotoGrid>
      {items.map((photo, index) => (
        <PhotoCard
          key={photo.id}
          photo={photo}
          index={index + 1}
          showDragHandle={region === "APPENDIX_IMAGES"}
          selected={selected.has(photo.id)}
          onCaptionChange={handleCaptionChange}
          onAcceptCaption={handleAcceptCaption}
          onAction={handleCardAction}
        />
      ))}
      {region === "APPENDIX_IMAGES" ? null : (
        /* Prototype lines 1004..1013 — the dashed drop tile closing the grid. */
        <Blueprint
          dashed
          style={{
            display: "grid",
            placeItems: "center",
            padding: 20,
            textAlign: "center",
            minHeight: 220,
          }}
        >
          <div>
            <Icon
              name="image"
              size={22}
              style={{ opacity: 0.4, margin: "0 auto 8px", display: "block" }}
            />
            <div style={{ fontSize: 12.5 }}>Drag &amp; drop images here</div>
            <div
              style={{
                fontSize: 11.5,
                color: "var(--color-neutral-600)",
                marginTop: 2,
              }}
            >
              JPG / HEIC from iPhone · up to 40 at a time
            </div>
            <Button
              size="compact"
              onClick={() => toast(PHASE.upload)}
              style={{ marginTop: 9 }}
            >
              Upload Images
            </Button>
          </div>
        </Blueprint>
      )}
    </PhotoGrid>
  );

  const photosView = (
    <>
      <PhotoToolbar
        region={region}
        count={items.length}
        missingCaptions={missingCaptions}
        awaitingReview={awaitingReview}
        selectedCount={selected.size}
        allSelected={selected.size > 0 && selected.size === items.length}
        onUpload={() => toast(PHASE.upload)}
        onGenerateAll={() => toast(PHASE.caption)}
        onToggleSelectAll={toggleSelectAll}
        onArrange={() => toast(PHASE.arrange)}
        onMoveSelected={() => toast(PHASE.move)}
        onDeleteSelected={() => toast(PHASE.delete)}
      />

      {region === "APPENDIX_IMAGES" && items.length > 0 ? (
        /* Prototype line 1289 — order is the position in the Word appendix. */
        <div
          className="flex items-center"
          style={{
            gap: 8,
            fontSize: 11.5,
            color: "var(--color-neutral-600)",
            marginBottom: 12,
          }}
        >
          <Icon name="grip" size={13} />
          Drag a photo by its handle to reorder · order number is the position in
          the Word appendix · {items.length} photos
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState message={EMPTY_STATE_COPY.noImages} action={uploadButton} />
      ) : (
        grid
      )}
    </>
  );

  if (region !== "APPENDIX_IMAGES") return photosView;

  return (
    <>
      <Tabs
        items={APPENDIX_TABS}
        activeId={view}
        onChange={(id) => setView(id === "layout" ? "layout" : "photos")}
        label="Appendix views"
        className="mb-[16px]"
      />
      {view === "photos" ? (
        photosView
      ) : (
        <AppendixLayout photos={items} documentNumber={report.documentNumber} />
      )}
    </>
  );
}
