import { describe, expect, it } from "vitest";

import {
  COLUMNS,
  PHOTO_HEIGHT_MM,
  appendixGeometry,
  mmToPt,
  mmToTwip,
  photoBoxPt,
  planAppendix,
} from "@/lib/reports/appendix-layout";

/**
 * The appendix is the one part of the export whose correctness is arithmetic
 * rather than judgement, so it is worth pinning: a regression here silently
 * ships a report with overlapping photographs or a shrunken 4 cm image.
 */
describe("appendix geometry", () => {
  const g = appendixGeometry();

  it("uses the A4 content area left by the appendix margins", () => {
    expect(g.contentWidthMm).toBe(180);
    expect(g.contentHeightMm).toBe(267);
  });

  it("splits the width into two equal columns with a gutter", () => {
    expect(g.columnWidthMm).toBe(87);
    expect(g.columnWidthMm * COLUMNS).toBeLessThan(g.contentWidthMm);
  });

  it("gives a 4:3 landscape photo room for the full 6.5 cm height", () => {
    // This is why the appendix margin is 15mm and not 20mm: 6.5 * 4/3 = 8.67cm.
    expect(g.columnWidthMm).toBeGreaterThanOrEqual((PHOTO_HEIGHT_MM * 4) / 3 / 10 * 10);
  });

  it("fits three rows per page, not the twelve the brief asks for", () => {
    // 65 photo + 11 caption + 5 gap = 81mm per row; 267 / 81 = 3.3
    expect(g.rowHeightMm).toBe(81);
    expect(g.rowsPerPage).toBe(3);
    expect(g.rowsFirstPage).toBe(3);
  });

  it("never claims room for a row that would overflow the page", () => {
    expect(g.rowsPerPage * g.rowHeightMm).toBeLessThanOrEqual(g.contentHeightMm);
    expect(g.rowsFirstPage * g.rowHeightMm + 14).toBeLessThanOrEqual(g.contentHeightMm);
  });
});

describe("planAppendix", () => {
  const photos = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

  it("lays photos out two per row", () => {
    const plan = planAppendix(photos(4));
    expect(plan.pages[0].rows).toEqual([["p1", "p2"], ["p3", "p4"]]);
  });

  it("leaves a single trailing photo alone rather than stretching it", () => {
    const plan = planAppendix(photos(5));
    const last = plan.pages.at(-1)!.rows.at(-1)!;
    expect(last).toEqual(["p5"]);
  });

  it("paginates once the page is full", () => {
    const plan = planAppendix(photos(14));
    expect(plan.totalRows).toBe(7);
    expect(plan.pages.length).toBe(3); // 3 + 3 + 1 rows
    expect(plan.pages[0].rows.length).toBe(3);
    expect(plan.pages[2].rows.length).toBe(1);
  });

  it("covers every photo exactly once", () => {
    const plan = planAppendix(photos(23));
    const flat = plan.pages.flatMap((p) => p.rows.flat());
    expect(flat).toEqual(photos(23));
    expect(plan.photoCount).toBe(23);
  });

  it("is empty, not broken, with no photos", () => {
    const plan = planAppendix([]);
    expect(plan.pages).toEqual([]);
    expect(plan.warning).toBeNull();
  });

  it("warns instead of shrinking when the brief's 12 rows are requested", () => {
    const plan = planAppendix(photos(24), 12);
    expect(plan.warning).toContain("do not fit on A4");
    expect(plan.warning).toContain("6.5 cm");
    // The photo height is still the required one — the warning is the answer,
    // not a smaller image.
    expect(PHOTO_HEIGHT_MM).toBe(65);
  });

  it("does not warn when the request fits", () => {
    expect(planAppendix(photos(6), 3).warning).toBeNull();
  });
});

describe("photo sizing", () => {
  const { columnWidthMm } = appendixGeometry();

  it("prints a 4:3 photo at exactly the required height", () => {
    const box = photoBoxPt(4000, 3000, columnWidthMm);
    expect(box.height).toBeCloseTo(mmToPt(65), 5);
    expect(box.width).toBeLessThanOrEqual(mmToPt(columnWidthMm));
  });

  it("preserves aspect ratio for a portrait photo", () => {
    const box = photoBoxPt(3000, 4000, columnWidthMm);
    expect(box.width / box.height).toBeCloseTo(0.75, 5);
    expect(box.height).toBeCloseTo(mmToPt(65), 5);
  });

  it("bounds a panorama by the column instead of overflowing it", () => {
    const box = photoBoxPt(8000, 1000, columnWidthMm);
    expect(box.width).toBeCloseTo(mmToPt(columnWidthMm), 5);
    expect(box.height).toBeLessThan(mmToPt(65));
  });

  it("assumes 4:3 when the dimensions are unknown", () => {
    const box = photoBoxPt(0, 0, columnWidthMm);
    expect(box.width / box.height).toBeCloseTo(4 / 3, 5);
  });
});

describe("unit conversion", () => {
  it("converts millimetres to twips", () => {
    expect(mmToTwip(25.4)).toBe(1440);
    expect(mmToTwip(20)).toBe(1134);
  });

  it("converts millimetres to points", () => {
    expect(mmToPt(25.4)).toBeCloseTo(72, 6);
  });
});
