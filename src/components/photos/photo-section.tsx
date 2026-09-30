"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState, useTransition, type JSX } from "react";

import { Blueprint } from "@/components/ui/blueprint";
import { Icon } from "@/components/ui/icon";
import { EmptyState, EMPTY_STATE_COPY } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { PhotoUpload } from "@/components/photos/photo-upload";
import { generatePhotoCaption } from "@/lib/ai/actions";
import {
  deletePhoto,
  movePhotoToRegion,
  reorderPhotos,
  updatePhotoCaption,
} from "@/lib/data/photo-actions";
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
  replace: "Replacing a photo in place is not built — delete it and upload the new one.",
  retry: "Upload retry is not built — upload the photograph again.",
  download: "Downloading the original is not built yet.",
  analyze: "Standalone image analysis is not built — generate a caption instead.",
  arrange: "Automatic arrangement is not built — drag the cards into order.",
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
  const router = useRouter();
  const [, startAction] = useTransition();

  const [edits, setEdits] = useState<Record<string, CaptionEdit>>({});
  const [selected, setSelected] = useState<ReadonlySet<string>>(NO_SELECTION);

  /**
   * README §1 lists the Layout & Preview tab as its own address —
   * `/reports/:id/appendix?view=layout` — so the tab lives in the URL rather
   * than in component state. That makes it linkable, back-button-able and the
   * target the dashboard and the export warnings can point at.
   */
    const pathname = usePathname();
  const searchParams = useSearchParams();
  const view: AppendixView =
    searchParams.get("view") === "layout" ? "layout" : "photos";

  const setView = useCallback(
    (next: AppendixView) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "layout") {
        params.set("view", "layout");
      } else {
        params.delete("view");
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  // Sections share this component, so a region change has to drop the edits
  // and the selection of the region being left behind. The view does not need
  // resetting: it lives in the query string, which a section navigation drops.
  const [renderedRegion, setRenderedRegion] = useState<ImageRegion>(region);
  if (renderedRegion !== region) {
    setRenderedRegion(region);
    setEdits({});
    setSelected(NO_SELECTION);
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

  /**
   * Persist whatever is in the card's caption field.
   *
   * Reached on blur, so a caption typed by hand is saved by moving on rather
   * than by finding a button — the card has none. It used to be reachable only
   * from Accept, which meant a hand-typed caption lived in `edits` until the
   * next refresh threw it away.
   */
  const handleCommitCaption = useCallback(
    async (id: string, caption: string) => {
      const result = await updatePhotoCaption(id, caption);
      if (!result.ok) {
        toast(result.error.message, "error");
        return;
      }
      // The stored row is the truth from here. Keeping the optimistic edit
      // would mask whatever the server actually wrote.
      setEdits((current) => {
        if (!(id in current)) return current;
        const next = { ...current };
        delete next[id];
        return next;
      });
      router.refresh();
    },
    [router, toast],
  );

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
      // The proposal only becomes the caption once it is written; until then
      // the card is showing an optimistic edit, not a saved one (§16).
      void handleCommitCaption(id, photo.aiCaption);
    },
    [handleCommitCaption, source],
  );

  /**
   * The per-card overflow actions. `rewrite` is the AI caption; the rest are
   * either real writes or honestly unbuilt.
   */
  const handleCardAction = useCallback(
    (action: PhotoCardAction, photo?: ReportPhoto) => {
      const id = photo?.id;
      if (!id) {
        toast(PHASE[action as keyof typeof PHASE] ?? "That action is not built yet.");
        return;
      }

      if (action === "rewrite") {
        startAction(async () => {
          const result = await generatePhotoCaption({ reportId: report.id, photoId: id });
          if (!result.ok) {
            toast(result.error.message, "error");
            return;
          }
          toast(
            result.data.confidence < 85
              ? `Caption proposed at ${result.data.confidence}% — review it before accepting.`
              : "Caption proposed — accept, edit or discard it.",
            result.data.confidence < 85 ? "warning" : undefined,
          );
          router.refresh();
        });
        return;
      }

      if (action === "delete") {
        startAction(async () => {
          const result = await deletePhoto(id);
          if (!result.ok) {
            toast(result.error.message, "error");
            return;
          }
          toast("Photograph deleted.");
          router.refresh();
        });
        return;
      }

      toast(PHASE[action as keyof typeof PHASE] ?? "That action is not built yet.");
    },
    [report.id, router, toast],
  );

  /** README §8 — move the selected cards to another region. */
  const handleMoveSelected = useCallback(
    (target: ImageRegion) => {
      const ids = [...selected];
      if (ids.length === 0) return;

      startAction(async () => {
        const failures: string[] = [];
        for (const id of ids) {
          const result = await movePhotoToRegion(id, target);
          if (!result.ok) failures.push(result.error.message);
        }
        setSelected(NO_SELECTION);
        if (failures.length > 0) {
          toast(failures[0], "error");
          return;
        }
        toast(`${ids.length} photograph${ids.length === 1 ? "" : "s"} moved.`);
        router.refresh();
      });
    },
    [router, selected, toast],
  );

  const handleDeleteSelected = useCallback(() => {
    const ids = [...selected];
    if (ids.length === 0) return;

    startAction(async () => {
      const failures: string[] = [];
      for (const id of ids) {
        const result = await deletePhoto(id);
        if (!result.ok) failures.push(result.error.message);
      }
      setSelected(NO_SELECTION);
      if (failures.length > 0) {
        toast(failures[0], "error");
        return;
      }
      toast(`${ids.length} photograph${ids.length === 1 ? "" : "s"} deleted.`);
      router.refresh();
    });
  }, [router, selected, toast]);

  /**
   * §16 — bulk captioning is a loop over the single-photo call rather than a
   * separate batch endpoint: one prompt per image is what the vision API takes,
   * and doing them one at a time keeps a partial run useful.
   */
  const handleGenerateAllCaptions = useCallback(() => {
    const targets = items.filter((photo) => !photo.caption.trim());
    if (targets.length === 0) {
      toast("Every photograph in this section already has a caption.");
      return;
    }

    startAction(async () => {
      let done = 0;
      let firstError: string | null = null;

      for (const photo of targets) {
        const result = await generatePhotoCaption({ reportId: report.id, photoId: photo.id });
        if (result.ok) done += 1;
        else if (!firstError) firstError = result.error.message;
      }

      if (done > 0) {
        toast(`${done} caption${done === 1 ? "" : "s"} proposed — review before accepting.`);
        router.refresh();
      }
      if (firstError) toast(firstError, "error");
    });
  }, [items, report.id, router, toast]);

  /** README §9 — persist a drag-to-reorder as the whole region's new order. */
  const handleReorder = useCallback(
    (orderedIds: readonly string[]) => {
      startAction(async () => {
        const result = await reorderPhotos(report.id, region, orderedIds);
        if (!result.ok) {
          toast(result.error.message, "error");
          return;
        }
        router.refresh();
      });
    },
    [region, report.id, router, toast],
  );

  const toggleSelectAll = useCallback(() => {
    setSelected((current) =>
      current.size === source.length && source.length > 0
        ? NO_SELECTION
        : new Set(source.map((photo) => photo.id)),
    );
  }, [source]);

  const uploadButton = (
    <PhotoUpload reportId={report.id} region={region} onUploaded={() => router.refresh()} />
  );

  /**
   * README §9 — drag to reorder, with the native API rather than a library.
   *
   * The cards are a flat list, so a reorder is an index move; a drag library
   * would add a dependency for animation this screen does not ask for. The
   * dragged id lives in a ref because `dataTransfer` is unreadable during
   * `dragover`, which is exactly when the drop target has to decide.
   */
  const draggingId = useRef<string | null>(null);

  const dropOn = useCallback(
    (targetId: string) => {
      const sourceId = draggingId.current;
      draggingId.current = null;
      if (!sourceId || sourceId === targetId) return;

      const ids = items.map((photo) => photo.id);
      const from = ids.indexOf(sourceId);
      const to = ids.indexOf(targetId);
      if (from === -1 || to === -1) return;

      ids.splice(to, 0, ids.splice(from, 1)[0]);
      handleReorder(ids);
    },
    [handleReorder, items],
  );

  /**
   * Move one photograph one place, which is how people actually reorder.
   *
   * Dragging existed and was the only way. It asks for a precise press-hold-
   * drag-release onto another card, which is hard with a mouse, harder on a
   * laptop trackpad, and impossible to undo if it lands wrong — "I tried to
   * reorder the photos and they disappeared" started here. Two arrows move the
   * card by one; dragging still works for a long jump.
   */
  const nudge = useCallback(
    (photoId: string, by: -1 | 1) => {
      const ids = items.map((photo) => photo.id);
      const from = ids.indexOf(photoId);
      const to = from + by;
      if (from === -1 || to < 0 || to >= ids.length) return;

      ids.splice(to, 0, ids.splice(from, 1)[0]);
      handleReorder(ids);
    },
    [handleReorder, items],
  );

  const reorderable = region === "APPENDIX_IMAGES";

  const grid = (
    <PhotoGrid>
      {items.map((photo, index) => (
        <div
          key={photo.id}
          draggable={reorderable}
          onDragStart={() => {
            draggingId.current = photo.id;
          }}
          onDragOver={(event) => {
            if (reorderable) event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            dropOn(photo.id);
          }}
          style={{ cursor: reorderable ? "grab" : undefined }}
        >
          <PhotoCard
            photo={photo}
            index={index + 1}
            showDragHandle={reorderable}
            onMoveEarlier={index === 0 ? undefined : () => nudge(photo.id, -1)}
            onMoveLater={
              index === items.length - 1 ? undefined : () => nudge(photo.id, 1)
            }
            selected={selected.has(photo.id)}
            onCaptionChange={handleCaptionChange}
            onCommitCaption={handleCommitCaption}
            onAcceptCaption={handleAcceptCaption}
            onAction={handleCardAction}
          />
        </div>
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
              JPEG, PNG or WebP · several at a time
            </div>
            <div style={{ marginTop: 9 }}>
              <PhotoUpload
                reportId={report.id}
                region={region}
                onUploaded={() => router.refresh()}
              />
            </div>
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
        uploadSlot={uploadButton}
        onGenerateAll={handleGenerateAllCaptions}
        onToggleSelectAll={toggleSelectAll}
        onArrange={() => toast(PHASE.arrange)}
        onMoveTo={handleMoveSelected}
        onDeleteSelected={handleDeleteSelected}
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
