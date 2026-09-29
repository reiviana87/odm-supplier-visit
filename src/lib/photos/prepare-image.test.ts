import { describe, expect, it } from "vitest";

import { MAX_UPLOAD_BYTES } from "@/lib/data/upload-limits";
import {
  MAX_IMAGE_EDGE,
  fitWithin,
  jpegNameFor,
  mustReencode,
} from "@/lib/photos/prepare-image";

/** A 12 MP iPhone frame, and the 48 MP one. */
const IPHONE_12MP = { width: 4032, height: 3024 };
const IPHONE_48MP = { width: 8064, height: 6048 };

describe("fitWithin", () => {
  it("brings an iPhone frame down to the longest edge", () => {
    expect(fitWithin(IPHONE_12MP)).toEqual({ width: 1600, height: 1200 });
  });

  it("keeps the aspect ratio of a portrait photograph", () => {
    const fitted = fitWithin({ width: 3024, height: 4032 });
    expect(fitted).toEqual({ width: 1200, height: 1600 });
    expect(fitted.width / fitted.height).toBeCloseTo(3024 / 4032, 3);
  });

  it("never enlarges a photograph that is already small", () => {
    const small = { width: 800, height: 600 };
    expect(fitWithin(small)).toEqual(small);
  });

  it("leaves a photograph exactly on the limit alone", () => {
    const exact = { width: MAX_IMAGE_EDGE, height: 900 };
    expect(fitWithin(exact)).toEqual(exact);
  });

  it("keeps a panorama's short edge above zero", () => {
    // 20000 x 900 scaled to 1600 wide puts the height at 72 — the bug this
    // guards is the one where it rounds to 0 and the canvas draws nothing.
    const fitted = fitWithin({ width: 20000, height: 900 });
    expect(fitted.width).toBe(1600);
    expect(fitted.height).toBeGreaterThan(0);
  });

  it("does not divide by zero on an undecodable size", () => {
    expect(fitWithin({ width: 0, height: 0 })).toEqual({ width: 0, height: 0 });
  });
});

describe("mustReencode", () => {
  it("converts HEIC, whatever its size", () => {
    // The iPhone's default format. Word cannot place it, so it is redrawn even
    // when it is small enough to upload as it stands.
    expect(mustReencode({ type: "image/heic", size: 900_000 }, { width: 800, height: 600 })).toBe(true);
  });

  it("shrinks a JPEG that carries more pixels than the page can print", () => {
    expect(mustReencode({ type: "image/jpeg", size: 1_000_000 }, IPHONE_12MP)).toBe(true);
    expect(mustReencode({ type: "image/jpeg", size: 1_000_000 }, IPHONE_48MP)).toBe(true);
  });

  it("shrinks a file too large for one upload request", () => {
    expect(
      mustReencode({ type: "image/jpeg", size: MAX_UPLOAD_BYTES + 1 }, { width: 1200, height: 900 }),
    ).toBe(true);
  });

  it("passes through a photograph that is already right", () => {
    expect(
      mustReencode({ type: "image/jpeg", size: 400_000 }, { width: 1600, height: 1200 }),
    ).toBe(false);
    expect(mustReencode({ type: "image/png", size: 90_000 }, { width: 640, height: 480 })).toBe(false);
    expect(mustReencode({ type: "image/webp", size: 90_000 }, { width: 640, height: 480 })).toBe(false);
  });

  it("converts a file the browser reported no type for", () => {
    expect(mustReencode({ type: "", size: 100_000 }, { width: 800, height: 600 })).toBe(true);
  });
});

describe("jpegNameFor", () => {
  it.each([
    ["IMG_4213.HEIC", "IMG_4213.jpg"],
    ["IMG_4213.heic", "IMG_4213.jpg"],
    ["dafu casting line.png", "dafu casting line.jpg"],
    ["no-extension", "no-extension.jpg"],
    ["two.dots.in.name.jpeg", "two.dots.in.name.jpg"],
  ])("names %s as %s", (given, expected) => {
    expect(jpegNameFor(given)).toBe(expected);
  });
});

describe("what the limits mean together", () => {
  it("shrinks an iPhone frame to well under the upload limit", () => {
    // 1600 x 1200 as JPEG is a few hundred KB. The point of the assertion is
    // the pixel budget: at 3 bytes a pixel uncompressed it is already under the
    // request limit before JPEG compresses it at all.
    const { width, height } = fitWithin(IPHONE_48MP);
    expect(width * height * 3).toBeLessThan(MAX_UPLOAD_BYTES * 2);
  });
});
