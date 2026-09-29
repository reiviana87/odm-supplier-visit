"use client";

/**
 * Photo upload — README §6, §7, §29.
 *
 * One file picker, one drop target, and on a phone the camera. The browser
 * measures each image before it is sent, because the DOCX appendix needs the
 * aspect ratio and decoding every photograph again on a serverless request to
 * learn something the browser already knew would be wasteful.
 *
 * No preview is base64'd into React state: an object URL is created for the
 * thumbnail and revoked as soon as the upload settles (§29). Forty photographs
 * held as data URLs is how a tab runs out of memory on a phone.
 */

import { useCallback, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { uploadReportPhoto } from "@/lib/data/photo-actions";
import { prepareImage } from "@/lib/photos/prepare-image";
import { cn } from "@/lib/utils/cn";
import type { ImageRegion } from "@/types/domain";

/**
 * Everything the browser can decode, which on an iPhone includes the HEIC it
 * shoots by default. `prepareImage` turns whatever is picked into a JPEG the
 * appendix can place, so the picker no longer has to grey out the phone's own
 * format and ask the user to go and change a camera setting.
 */
const ACCEPT = "image/*";

/** The advice when a file cannot be decoded here at all — see `prepareImage`. */
function cannotRead(file: File): string {
  return /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)
    ? `${file.name} — this browser cannot read iPhone HEIC. Upload it from the phone itself, or set Settings › Camera › Formats › Most Compatible and share it again.`
    : `${file.name} — the image could not be read.`;
}

export interface PhotoUploadProps {
  reportId: string;
  region: ImageRegion;
  /** Called after every successful upload so the grid can refresh. */
  onUploaded?: () => void;
  /** `compact` is the toolbar button; `zone` is the drop area. */
  variant?: "button" | "zone";
  className?: string;
}

interface Progress {
  total: number;
  done: number;
  failed: string[];
}

export function PhotoUpload({
  reportId,
  region,
  onUploaded,
  variant = "button",
  className,
}: PhotoUploadProps) {
  const { toast } = useToast();
  const inputId = useId();
  const cameraId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [dragging, setDragging] = useState(false);

  const busy = progress !== null;

  const send = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;

      setProgress({ total: list.length, done: 0, failed: [] });
      const failed: string[] = [];

      // Sequential on purpose: a phone on factory wifi uploading eight photos
      // at once tends to time all of them out rather than finish any.
      for (const [index, file] of list.entries()) {
        // Shrunk and converted here, in the browser, before anything is sent:
        // a phone photograph is several times larger than one upload request
        // may carry and many times more detailed than the page can print.
        const prepared = await prepareImage(file);
        if (!prepared) {
          failed.push(cannotRead(file));
          setProgress({ total: list.length, done: index + 1, failed });
          continue;
        }

        const result = await uploadReportPhoto({
          reportId,
          region,
          fileName: prepared.file.name,
          mimeType: prepared.file.type || "image/jpeg",
          width: prepared.width,
          height: prepared.height,
          capturedAt: file.lastModified ? new Date(file.lastModified).toISOString() : null,
          file: prepared.file,
        });

        if (!result.ok) failed.push(`${file.name} — ${result.error.message}`);
        setProgress({ total: list.length, done: index + 1, failed });
      }

      setProgress(null);

      const uploaded = list.length - failed.length;
      if (uploaded > 0) {
        toast(`${uploaded} photograph${uploaded === 1 ? "" : "s"} uploaded.`);
        onUploaded?.();
      }
      if (failed.length > 0) {
        // Named, not counted: which photograph failed is the useful part.
        toast(`Could not upload ${failed.join("; ")}`, "error");
      }
    },
    [onUploaded, region, reportId, toast],
  );

  const onPick = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (files) void send(files);
      // Reset so picking the same file twice still fires a change event.
      event.target.value = "";
    },
    [send],
  );

  const label = busy
    ? `Uploading ${progress.done}/${progress.total}…`
    : variant === "zone"
      ? "Drop photographs here"
      : "Upload";

  const inputs = (
    <>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={onPick}
      />
      {/* `capture` opens the camera directly on a phone and is ignored on a
          desktop, so the same markup serves both (§6). */}
      <input
        id={cameraId}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={onPick}
      />
    </>
  );

  if (variant === "button") {
    return (
      <>
        {inputs}
        <Button
          icon="upload"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className={className}
        >
          {label}
        </Button>
      </>
    );
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (event.dataTransfer.files.length) void send(event.dataTransfer.files);
      }}
      className={cn("flex flex-col items-center justify-center", className)}
      style={{
        border: `1px dashed ${dragging ? "var(--color-accent)" : "var(--color-border)"}`,
        background: dragging ? "var(--color-accent-100)" : "transparent",
        padding: "22px 18px",
        gap: 10,
        transition: "background 120ms ease, border-color 120ms ease",
      }}
    >
      {inputs}
      <span style={{ fontSize: 12.5, color: "var(--color-neutral-600)" }}>{label}</span>
      {!busy ? (
        <div className="flex items-center" style={{ gap: 8 }}>
          <Button icon="upload" onClick={() => inputRef.current?.click()}>
            Choose files
          </Button>
          {/* Only useful on a device with a camera; harmless elsewhere. The
              button opens the capture input rather than wrapping it, because
              the kit's Button renders a real <button> and nesting one inside a
              <label> makes the click ambiguous. */}
          <Button
            icon="camera"
            onClick={() => document.getElementById(cameraId)?.click()}
          >
            Take photo
          </Button>
        </div>
      ) : null}
      {progress && progress.failed.length > 0 ? (
        <span style={{ fontSize: 11.5, color: "var(--color-danger-ink)" }}>
          {progress.failed.length} failed
        </span>
      ) : null}
    </div>
  );
}
