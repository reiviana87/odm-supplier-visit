/**
 * Completion algorithm — Phase 2 §35.
 *
 * The number this file protects is the one the whole app repeats: the editor
 * header, the reports table, the dashboard progress bars and the export modal
 * all print it, so a drift of one predicate is a drift everywhere. The seed is
 * imported rather than rebuilt, because "the approved capture reads 69%" is the
 * assertion — a hand-made fixture could only prove the arithmetic against
 * itself.
 */

import { describe, expect, it } from "vitest";

import { HUATONG_REPORT, REPORT_PHOTOS, getReport } from "@/lib/mock-data";
import { reportCompletion, sectionCompletion } from "@/lib/reports/completion";
import {
  SECTIONS,
  type Observation,
  type Report,
  type ReportPhoto,
  type ReportSections,
} from "@/types/domain";

/** The seed, with one part of its body replaced. */
function withSections(patch: Partial<ReportSections>): Report {
  return {
    ...HUATONG_REPORT,
    sections: { ...HUATONG_REPORT.sections, ...patch },
  };
}

function passingCount(report: Report, photos: readonly ReportPhoto[]): number {
  const done = sectionCompletion(report, photos);
  return SECTIONS.filter((section) => done[section.id]).length;
}

/** Real observations, repeated: only the count is under test here. */
function observations(count: number): Observation[] {
  const source = HUATONG_REPORT.sections.observations;
  return Array.from({ length: count }, (_, index) => ({
    ...source[index % source.length],
    id: `obs-test-${index}`,
  }));
}

const MAIN_PRODUCT_PHOTOS = REPORT_PHOTOS.filter(
  (photo) => photo.region === "MAIN_PRODUCT_IMAGES",
);

describe("the HUATONG seed", () => {
  it("comes out at the approved 69%", () => {
    expect(reportCompletion(HUATONG_REPORT, REPORT_PHOTOS)).toBe(69);
  });

  it("passes 9 of the 13 predicates, and fails the four that are unwritten", () => {
    const done = sectionCompletion(HUATONG_REPORT, REPORT_PHOTOS);

    expect(passingCount(HUATONG_REPORT, REPORT_PHOTOS)).toBe(9);
    // §6 has four observations of the eight it needs, §9 is not written, and
    // §8.1 / §10 still hold AI captions nobody has accepted (README §11).
    expect(done.visit).toBe(false);
    expect(done.conclusion).toBe(false);
    expect(done["partner-images"]).toBe(false);
    expect(done.appendix).toBe(false);
  });
});

describe("prose predicates", () => {
  it("completes at 41 characters and not at 40", () => {
    expect(sectionCompletion(withSections({ conclusion: "x".repeat(41) }), REPORT_PHOTOS).conclusion).toBe(true);
    expect(sectionCompletion(withSections({ conclusion: "x".repeat(40) }), REPORT_PHOTOS).conclusion).toBe(false);
  });

  it.each([
    ["spaces and newlines", "   \n\t  ".repeat(20)],
    ["an empty paragraph", "<p></p>"],
    ["a paragraph holding one break", "<p><br></p>"],
    ["a paragraph holding non-breaking spaces", `<p>${"&nbsp;".repeat(10)}</p>`],
    ["non-breaking spaces alone", "&nbsp;".repeat(30)],
  ])("does not count %s as written", (_label: string, body: string) => {
    expect(sectionCompletion(withSections({ conclusion: body }), REPORT_PHOTOS).conclusion).toBe(false);
  });

  it("does not let a long run of whitespace pass the threshold", () => {
    // Phase 2 §20 — the measurement is of writing, not of the string: this body
    // is 60 characters long and says nothing.
    const body = " ".repeat(60);

    expect(body.length).toBeGreaterThan(40);
    expect(sectionCompletion(withSections({ conclusion: body }), REPORT_PHOTOS).conclusion).toBe(false);
  });

  it("measures the text inside a rich-text wrapper, not the tags", () => {
    // 40 characters of writing stays incomplete however it is wrapped …
    expect(
      sectionCompletion(withSections({ conclusion: `<p>${"x".repeat(40)}</p>` }), REPORT_PHOTOS).conclusion,
    ).toBe(false);
    // … and 41 completes, wrapped or not.
    expect(
      sectionCompletion(withSections({ conclusion: `<p>${"x".repeat(41)}</p>` }), REPORT_PHOTOS).conclusion,
    ).toBe(true);
    expect(
      sectionCompletion(withSections({ conclusion: `  ${"x".repeat(41)}  ` }), REPORT_PHOTOS).conclusion,
    ).toBe(true);
  });
});

describe("image predicates", () => {
  it("does not complete a region whose single photo has no caption", () => {
    const uncaptioned: ReportPhoto[] = [{ ...MAIN_PRODUCT_PHOTOS[0], caption: "" }];

    expect(sectionCompletion(HUATONG_REPORT, uncaptioned)["product-images"]).toBe(false);
  });

  it("fails the whole region when one photo of several is uncaptioned", () => {
    const [first, ...rest] = MAIN_PRODUCT_PHOTOS;

    expect(sectionCompletion(HUATONG_REPORT, MAIN_PRODUCT_PHOTOS)["product-images"]).toBe(true);
    expect(
      sectionCompletion(HUATONG_REPORT, [{ ...first, caption: "   " }, ...rest])["product-images"],
    ).toBe(false);
  });

  it("does not complete an empty region", () => {
    expect(sectionCompletion(HUATONG_REPORT, [])["product-images"]).toBe(false);
  });
});

describe("the §6 observation count", () => {
  it("completes at 8 observations and not at 7", () => {
    expect(sectionCompletion(withSections({ observations: observations(8) }), REPORT_PHOTOS).visit).toBe(true);
    expect(sectionCompletion(withSections({ observations: observations(7) }), REPORT_PHOTOS).visit).toBe(false);
  });
});

describe("an empty report", () => {
  it("still reads 3 of 13 — the three sections that are true on creation", () => {
    // GSO-2608002x00 is seeded as a shell: real header, empty body.
    const empty = getReport("gso-2608002x00");
    if (!empty) {
      throw new Error("Report seed GSO-2608002x00 is missing.");
    }

    const done = sectionCompletion(empty, []);
    expect(done.general).toBe(true);
    expect(done.company).toBe(true);
    expect(done.certificates).toBe(true);
    expect(passingCount(empty, [])).toBe(3);
    expect(reportCompletion(empty, [])).toBe(23);
  });
});
