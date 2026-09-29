/**
 * Getting a phone photograph ready to be a report photograph — README §29.
 *
 * A visit produces forty photographs taken with a phone, and a phone does not
 * shoot for a Word document. It shoots the largest thing its sensor can make,
 * in whatever format the operating system prefers this year. Sending that
 * straight to the server fails twice over: an iPhone in its default High
 * Efficiency mode hands the browser HEIC, which Word cannot place, and a single
 * frame can be larger than one request is allowed to carry.
 *
 * Both problems have the same answer. The browser already decoded the image to
 * show a thumbnail; drawing that decoded image onto a canvas and reading it
 * back as JPEG resizes it and changes its format in one step, with no decoder
 * library shipped to the phone. HEIC works because the phone's own codec is
 * doing the reading.
 *
 * The scaling decisions live here as pure functions so they can be tested
 * without a canvas; {@link prepareImage} is the part that needs a browser.
 */

import { ACCEPTED_IMAGE_MIME, MAX_UPLOAD_BYTES } from "@/lib/data/upload-limits";

/**
 * The longest edge a stored photograph needs to have.
 *
 * The appendix prints each photograph in a 7 cm box (`appendix-layout.ts`). At
 * 300 dpi — print resolution for a Word document — 7 cm is 827 pixels, so 1600
 * is already twice what the page can use. An iPhone shoots 4032 × 3024, and its
 * 48 MP modes 8064 × 6048: between 6 and 24 times more pixels than will ever
 * reach paper, at 2 to 5 MB each.
 *
 * Keeping those pixels would cost an upload the field wifi cannot afford, and a
 * forty-photograph report would arrive as a document too large to email.
 */
export const MAX_IMAGE_EDGE = 1600;

/**
 * Deliberately not 1.0. Above roughly 0.85 a JPEG grows quickly while a
 * photograph of a machine on a factory floor stops looking any different, and
 * the difference is invisible at 7 cm on paper.
 */
const JPEG_QUALITY = 0.82;

/** What a re-encoded photograph becomes. Word places JPEG everywhere. */
export const OUTPUT_MIME = "image/jpeg";

export interface ImageSize {
  width: number;
  height: number;
}

export interface PreparedImage {
  /** The file to upload — the original when nothing had to change. */
  file: File;
  /** Dimensions of that file, which the DOCX appendix needs for the aspect ratio. */
  width: number;
  height: number;
  /** True when the photograph was redrawn rather than passed through. */
  converted: boolean;
}

/**
 * The size that fits inside a square of `maxEdge`, keeping the aspect ratio.
 *
 * Never enlarges: a photograph that is already small stays exactly as it is,
 * because upscaling invents detail and costs bytes to store the invention.
 */
export function fitWithin(size: ImageSize, maxEdge: number = MAX_IMAGE_EDGE): ImageSize {
  const longest = Math.max(size.width, size.height);
  if (longest <= maxEdge || longest === 0) return { width: size.width, height: size.height };

  const scale = maxEdge / longest;
  return {
    // `round`, then a floor of 1: a panorama scaled far enough down would
    // otherwise reach zero on its short edge and draw nothing.
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}

/**
 * Whether the picked file has to be redrawn before it can be stored.
 *
 * Three reasons, in the order they matter: the format cannot go into a Word
 * document at all; the image carries more pixels than the page can print; the
 * file is larger than one upload request may carry.
 */
export function mustReencode(
  file: { type: string; size: number },
  size: ImageSize,
  maxEdge: number = MAX_IMAGE_EDGE,
): boolean {
  const accepted = (ACCEPTED_IMAGE_MIME as readonly string[]).includes(file.type);
  if (!accepted) return true;
  if (Math.max(size.width, size.height) > maxEdge) return true;
  return file.size > MAX_UPLOAD_BYTES;
}

/** `IMG_4213.HEIC` → `IMG_4213.jpg`, so what is stored is named what it is. */
export function jpegNameFor(fileName: string): string {
  const base = fileName.replace(/\.[^.\/]+$/, "");
  return `${base || "photo"}.jpg`;
}

/**
 * Decode the file the way the browser would display it.
 *
 * An `<img>` rather than `createImageBitmap`, for two reasons: it applies the
 * EXIF orientation tag on every current browser, so a photograph taken with the
 * phone held sideways is not stored on its side; and on iOS it goes through the
 * system image decoder, which is what makes HEIC readable at all.
 *
 * Resolves to null when the browser cannot decode the file — a HEIC on a
 * desktop browser with no codec for it. The caller says so rather than storing
 * a photograph that would be missing from the report weeks later.
 */
async function decode(file: File): Promise<HTMLImageElement | null> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement | null>((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Canvas → Blob, as a promise, resolving to null when the encode fails. */
function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, OUTPUT_MIME, JPEG_QUALITY));
}

/**
 * Measure the photograph, and shrink or convert it when it needs it.
 *
 * Returns null only when the file could not be decoded at all. Everything else
 * comes back ready to upload, with the dimensions of what is actually being
 * sent rather than of what was picked — the appendix lays photographs out from
 * their aspect ratio, and a resized image that reported its original size would
 * be placed wrong.
 */
export async function prepareImage(file: File): Promise<PreparedImage | null> {
  const image = await decode(file);
  if (!image || image.naturalWidth === 0) return null;

  const natural: ImageSize = { width: image.naturalWidth, height: image.naturalHeight };
  if (!mustReencode(file, natural)) {
    return { file, width: natural.width, height: natural.height, converted: false };
  }

  const target = fitWithin(natural);
  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;

  const context = canvas.getContext("2d");
  if (!context) return { file, width: natural.width, height: natural.height, converted: false };

  context.drawImage(image, 0, 0, target.width, target.height);

  const blob = await toBlob(canvas);
  // A failed encode is not a reason to lose the photograph: the original still
  // goes up, and the server's own size check is the backstop if it is too big.
  if (!blob) return { file, width: natural.width, height: natural.height, converted: false };

  const jpeg = new File([blob], jpegNameFor(file.name), {
    type: OUTPUT_MIME,
    lastModified: file.lastModified,
  });

  return { file: jpeg, width: target.width, height: target.height, converted: true };
}
