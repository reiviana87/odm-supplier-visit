import { describe, expect, it } from "vitest";

import {
  COLUMNS,
  HEADING_MM,
  PHOTO_BOX_MM,
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
 *
 * The numbers asserted below are the ones measured in the corporate template —
 * a 7 cm photo box, six photographs to a page — not preferences.
 */
describe("appendix geometry", () => {
  const g = appendixGeometry();

  it("uses the A4 content area left by the corporate margins", () => {
    expect(g.contentWidthMm).toBe(170);
    expect(g.contentHeightMm).toBe(257);
  });

  it("splits the width into two equal columns with a gutter", () => {
    expect(g.columnWidthMm).toBe(82);
    expect(g.columnWidthMm * COLUMNS).toBeLessThan(g.contentWidthMm);
  });

  it("leaves a column wider than the photo box, so nothing is bounded by width", () => {
    // Why the appendix no longer needs a margin of its own: the widest a
    // photograph can print is the 7 cm box, and 8.2 cm columns clear it.
    expect(g.columnWidthMm).toBeGreaterThan(PHOTO_BOX_MM / 10);
    expect(g.columnWidthMm).toBeGreaterThan(PHOTO_BOX_MM);
  });

  it("fits six photographs per page, as the template does", () => {
    // 70 photo + 8 caption + 2 slack = 80mm per row; 257 / 80 = 3.2
    expect(g.rowHeightMm).toBe(80);
    expect(g.rowsPerPage).toBe(3);
    expect(g.rowsFirstPage).toBe(3);
    expect(g.rowsPerPage * COLUMNS).toBe(6);
    expect(g.rowsFirstPage * COLUMNS).toBe(6);
  });

  it("never claims room for a row that would overflow the page", () => {
    expect(g.rowsPerPage * g.rowHeightMm).toBeLessThanOrEqual(g.contentHeightMm);
    expect(g.rowsFirstPage * g.rowHeightMm + HEADING_MM).toBeLessThanOrEqual(g.contentHeightMm);
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
    expect(plan.warning).toContain("7 cm");
    // The photo box is still the measured one — the warning is the answer, not a
    // smaller image.
    expect(PHOTO_BOX_MM).toBe(70);
  });

  it("does not warn when the request fits", () => {
    expect(planAppendix(photos(6), 3).warning).toBeNull();
  });
});

describe("photo sizing", () => {
  const { columnWidthMm } = appendixGeometry();

  it("prints a 4:3 landscape photo at the template's measured 7.00 x 5.25 cm", () => {
    const box = photoBoxPt(4000, 3000, columnWidthMm);
    expect(box.width).toBeCloseTo(mmToPt(70), 5);
    expect(box.height).toBeCloseTo(mmToPt(52.5), 5);
  });

  it("prints a 3:4 portrait photo at the measured 5.25 x 7.00 cm", () => {
    const box = photoBoxPt(3000, 4000, columnWidthMm);
    expect(box.width).toBeCloseTo(mmToPt(52.5), 5);
    expect(box.height).toBeCloseTo(mmToPt(70), 5);
    expect(box.width / box.height).toBeCloseTo(0.75, 5);
  });

  it("fits a square photo to the whole box", () => {
    const box = photoBoxPt(2000, 2000, columnWidthMm);
    expect(box.width).toBeCloseTo(mmToPt(70), 5);
    expect(box.height).toBeCloseTo(mmToPt(70), 5);
  });

  it("keeps a panorama inside the box rather than filling the column", () => {
    const box = photoBoxPt(8000, 1000, columnWidthMm);
    expect(box.width).toBeCloseTo(mmToPt(70), 5);
    expect(box.height).toBeCloseTo(mmToPt(70) / 8, 5);
    // The column is wider than the box; the box is what bounds the photograph.
    expect(box.width).toBeLessThan(mmToPt(columnWidthMm));
  });

  it("is bounded by a column narrower than the box", () => {
    const box = photoBoxPt(3000, 4000, 40);
    expect(box.width).toBeCloseTo(mmToPt(40), 5);
    expect(box.height).toBeCloseTo(mmToPt(40) / 0.75, 5);
  });

  it("assumes 4:3 when the dimensions are unknown", () => {
    const box = photoBoxPt(0, 0, columnWidthMm);
    expect(box.width / box.height).toBeCloseTo(4 / 3, 5);
    expect(box.width).toBeCloseTo(mmToPt(70), 5);
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
