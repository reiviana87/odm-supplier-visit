"use client";

import { useState, type CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { IMAGE_REGION_LABELS, type ImageRegion } from "@/types/domain";

import { CaptionSheet } from "./caption-sheet";

/**
 * Visit Mode camera — README §17, prototype lines 2224..2269, screenshot 17.
 *
 *   viewfinder  flex 1 · #111 ground · min-height 330 · photo at cover, .92
 *   overlays    section chip "APPENDIX · AUTO" top-left, "{n} today" top-right,
 *               both 10.5px on accent-900 at 80%; the section select sits at
 *               bottom 12 on a 92% var(--color-bg) ground
 *   controls    padding 16 · Photo Library · a 64px round shutter · Done
 *
 * The shutter is the one round element in the design; everything else stays
 * square (README §3.4).
 *
 * Camera hardware is NOT Phase 1. The viewfinder shows a seeded photograph and
 * the shutter advances the local capture flow — it does not open a device
 * camera, and nothing is written anywhere. The same goes for the photo library
 * picker, which belongs to the upload pipeline (Phase 2).
 */

/** Regions a field photo can be filed under, in prototype order (line 2235). */
const SECTION_OPTIONS: readonly ImageRegion[] = [
  "APPENDIX_IMAGES",
  "MAIN_PRODUCT_IMAGES",
  "PARTNER_IMAGES",
];

/** The overlay chip is the short form of the region, rendered uppercase. */
const SECTION_CHIP: Record<ImageRegion, string> = {
  APPENDIX_IMAGES: "Appendix",
  MAIN_PRODUCT_IMAGES: "Main products",
  PARTNER_IMAGES: "Partners",
};

/** accent-900 at 80% — the overlay chip ground (prototype line 2231). */
const OVERLAY_CHIP: CSSProperties = {
  background: "color-mix(in srgb, var(--color-accent-900) 80%, transparent)",
  color: "#fff",
  fontSize: 10.5,
  padding: "3px 7px",
};

export interface CameraScreenProps {
  /** The seeded frame standing in for the live viewfinder. */
  src: string;
  /** Photos already captured today — also the base for the next photo number. */
  todayCount: number;
  /** A photo was filed: bump the counters upstream. */
  onPhotoSaved: () => void;
  /** Leave the camera (Done). */
  onExit: () => void;
}

export function CameraScreen({
  src,
  todayCount,
  onPhotoSaved,
  onExit,
}: CameraScreenProps) {
  const { toast } = useToast();
  const [section, setSection] = useState<ImageRegion>("APPENDIX_IMAGES");
  const [caption, setCaption] = useState<string | null>(null);

  // `caption === null` is the viewfinder; a string is the open caption sheet.
  const captured = caption !== null;
  const photoNumber = todayCount + 1;

  function file(message: string) {
    setCaption(null);
    onPhotoSaved();
    toast(message);
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <div
        style={{
          flex: 1,
          position: "relative",
          background: "#111",
          minHeight: 330,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- seeded frame,
            no known intrinsic size, and it must fill the viewfinder. */}
        <img
          src={src}
          alt="Viewfinder — sample frame, the device camera is not connected"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.92,
            position: "absolute",
            inset: 0,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            right: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              ...OVERLAY_CHIP,
              letterSpacing: ".06em",
              textTransform: "uppercase",
            }}
          >
            {SECTION_CHIP[section]} · auto
          </span>
          <div style={{ flex: 1 }} />
          <span style={OVERLAY_CHIP}>{todayCount} today</span>
        </div>
        <div style={{ position: "absolute", bottom: 12, left: 12, right: 12 }}>
          <Select
            aria-label="Destination section"
            value={section}
            onChange={(event) => setSection(event.target.value as ImageRegion)}
            // The confirmed touch-target decision, the one control it cannot be
            // met on invisibly: a native <select> renders no ::after, and a
            // transparent wrapper cannot open its popup. So this is the "unless
            // required" case and the box itself grows 36px → 44px. What it gives
            // up is not an approved Visit Mode measurement — the prototype sets
            // no height here and the 36px came from `.input`, the shared desktop
            // form-control height, against README §24's "Touch targets in Visit
            // Mode: ≥44px".
            style={{
              fontSize: 12.5,
              minHeight: 44,
              background: "color-mix(in srgb, var(--color-bg) 92%, transparent)",
              borderColor: "transparent",
            }}
          >
            {SECTION_OPTIONS.map((region) => (
              <option key={region} value={region}>
                Section · {IMAGE_REGION_LABELS[region]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {captured ? (
        <CaptionSheet
          src={src}
          photoNumber={photoNumber}
          sectionLabel={IMAGE_REGION_LABELS[section]}
          value={caption}
          onChange={setCaption}
          onRetake={() => setCaption(null)}
          onAiLater={() =>
            file(`Photo ${photoNumber} saved · flagged for AI captioning`)
          }
          onSave={() =>
            file(
              caption.trim()
                ? `Photo ${photoNumber} saved with caption · queued for upload`
                : `Photo ${photoNumber} saved · caption pending, AI will draft it on sync`,
            )
          }
        />
      ) : (
        <div
          style={{
            padding: 16,
            display: "flex",
            alignItems: "center",
            gap: 14,
            borderTop: "1px solid var(--color-divider)",
            flex: "none",
          }}
        >
          <Button
            variant="secondary"
            onClick={() =>
              toast("The photo library picker lands in Phase 2 with the upload pipeline")
            }
            style={{ fontSize: 13, minHeight: 46 }}
          >
            Photo Library
          </Button>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={() => setCaption("")}
            aria-label="Capture photo"
            title="Capture"
            style={{
              width: 64,
              height: 64,
              flex: "none",
              borderRadius: "50%",
              border: "3px solid var(--color-accent-900)",
              background: "var(--color-accent)",
              cursor: "pointer",
            }}
          />
          <div style={{ flex: 1 }} />
          <Button variant="secondary" onClick={onExit} style={{ fontSize: 13, minHeight: 46 }}>
            Done
          </Button>
        </div>
      )}
    </div>
  );
}
