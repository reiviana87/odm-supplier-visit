import { afterEach, describe, expect, it, vi } from "vitest";

import { prepareImage } from "@/lib/photos/prepare-image";

/**
 * `prepareImage` is the half that needs a browser, so the browser is faked:
 * an `Image` that reports the dimensions the test wants, and a canvas that
 * records what was drawn on it. The point is not to test canvas — it is to
 * test that this module drives it correctly, which is exactly the kind of
 * wiring mistake the pure tests next door cannot see.
 */

interface DrawnCall {
  width: number;
  height: number;
}

function fakeBrowser(options: {
  natural?: { width: number; height: number };
  decodes?: boolean;
  encodes?: boolean;
  bytes?: number;
}) {
  const natural = options.natural ?? { width: 4032, height: 3024 };
  const drawn: DrawnCall[] = [];
  const canvases: { width: number; height: number }[] = [];
  const revoked: string[] = [];

  vi.stubGlobal("URL", {
    createObjectURL: () => "blob:fake",
    revokeObjectURL: (url: string) => revoked.push(url),
  });

  vi.stubGlobal(
    "Image",
    class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = natural.width;
      naturalHeight = natural.height;
      set src(_value: string) {
        // Asynchronous, the way a real decode is.
        queueMicrotask(() => {
          if (options.decodes === false) this.onerror?.();
          else this.onload?.();
        });
      }
    },
  );

  vi.stubGlobal("document", {
    createElement: () => {
      const canvas = {
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage: (_image: unknown, _x: number, _y: number, width: number, height: number) =>
            drawn.push({ width, height }),
        }),
        toBlob: (callback: (blob: Blob | null) => void, type: string, quality: number) => {
          expect(type).toBe("image/jpeg");
          expect(quality).toBeGreaterThan(0.5);
          expect(quality).toBeLessThan(1);
          callback(
            options.encodes === false
              ? null
              : new Blob([new Uint8Array(options.bytes ?? 420_000)], { type: "image/jpeg" }),
          );
        },
      };
      canvases.push(canvas);
      return canvas;
    },
  });

  return { drawn, canvases, revoked };
}

function pickedFile(name: string, type: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type, lastModified: 1_700_000_000_000 });
}

afterEach(() => vi.unstubAllGlobals());

describe("prepareImage", () => {
  it("turns an iPhone HEIC into a JPEG the appendix can place", async () => {
    const browser = fakeBrowser({ natural: { width: 4032, height: 3024 } });

    const result = await prepareImage(pickedFile("IMG_4213.HEIC", "image/heic", 2_600_000));

    expect(result).not.toBeNull();
    expect(result!.converted).toBe(true);
    expect(result!.file.type).toBe("image/jpeg");
    expect(result!.file.name).toBe("IMG_4213.jpg");
    // The stored dimensions are the ones actually drawn, not the ones picked:
    // the appendix lays photographs out from the aspect ratio of the file it is
    // given, so reporting 4032 x 3024 for a 1600 x 1200 image would place it
    // wrong on the page.
    expect(result!.width).toBe(1600);
    expect(result!.height).toBe(1200);
    expect(browser.drawn).toEqual([{ width: 1600, height: 1200 }]);
    expect(browser.canvases[0]).toMatchObject({ width: 1600, height: 1200 });
  });

  it("keeps the capture time of the original photograph", async () => {
    fakeBrowser({});
    const result = await prepareImage(pickedFile("IMG_1.HEIC", "image/heic", 2_600_000));
    expect(result!.file.lastModified).toBe(1_700_000_000_000);
  });

  it("passes a photograph that is already right through untouched", async () => {
    const browser = fakeBrowser({ natural: { width: 1400, height: 1050 } });
    const file = pickedFile("line.jpg", "image/jpeg", 380_000);

    const result = await prepareImage(file);

    expect(result!.converted).toBe(false);
    expect(result!.file).toBe(file);
    expect(browser.drawn).toEqual([]);
  });

  it("answers null when the browser cannot decode the file", async () => {
    fakeBrowser({ decodes: false });
    expect(await prepareImage(pickedFile("IMG_9.HEIC", "image/heic", 2_000_000))).toBeNull();
  });

  it("falls back to the original rather than losing a photograph to a failed encode", async () => {
    fakeBrowser({ natural: { width: 4032, height: 3024 }, encodes: false });
    const file = pickedFile("IMG_7.jpg", "image/jpeg", 3_000_000);

    const result = await prepareImage(file);

    expect(result!.file).toBe(file);
    expect(result!.converted).toBe(false);
  });

  it("releases the object URL it made to decode with", async () => {
    const browser = fakeBrowser({});
    await prepareImage(pickedFile("IMG_2.jpg", "image/jpeg", 3_000_000));
    expect(browser.revoked).toEqual(["blob:fake"]);
  });
});
