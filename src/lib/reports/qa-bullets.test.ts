import { describe, expect, it } from "vitest";

import { bulletsFromPaste } from "@/lib/reports/qa-bullets";

/**
 * Pasting a block of notes into §6.
 *
 * The rule is one line, one bullet. The cases below are what people actually
 * paste: a list copied out of a notes app that brings its bullet characters
 * with it, a transcript with blank lines between paragraphs, and Windows line
 * endings from anything that has been through Notepad.
 */
describe("bulletsFromPaste", () => {
  it("makes one bullet per line", () => {
    expect(bulletsFromPaste("First point\nSecond point\nThird point")).toEqual([
      "First point",
      "Second point",
      "Third point",
    ]);
  });

  it("drops blank lines rather than making empty bullets", () => {
    expect(bulletsFromPaste("One\n\n\nTwo\n   \nThree")).toEqual(["One", "Two", "Three"]);
  });

  it("strips the bullet characters a notes app pastes in", () => {
    expect(
      bulletsFromPaste("• Lead time is four weeks\n- Two shifts on the line\n* ISO 9001 seen"),
    ).toEqual(["Lead time is four weeks", "Two shifts on the line", "ISO 9001 seen"]);
  });

  it("handles Windows line endings and en/em dashes", () => {
    expect(bulletsFromPaste("– Primeiro ponto\r\n— Segundo ponto\r\n· Terceiro")).toEqual([
      "Primeiro ponto",
      "Segundo ponto",
      "Terceiro",
    ]);
  });

  it("leaves a dash inside the sentence alone", () => {
    expect(bulletsFromPaste("Lead time — four weeks for the standard model")).toEqual([
      "Lead time — four weeks for the standard model",
    ]);
  });

  it("keeps accents and CJK intact", () => {
    expect(bulletsFromPaste("Fundição sem rastreabilidade\n従業員 320 人\n产能 3,465,000")).toEqual([
      "Fundição sem rastreabilidade",
      "従業員 320 人",
      "产能 3,465,000",
    ]);
  });

  it("answers an empty paste with no bullets", () => {
    expect(bulletsFromPaste("")).toEqual([]);
    expect(bulletsFromPaste("   \n \n")).toEqual([]);
  });
});

describe("bulletsFromPaste with paragraphs", () => {
  it("makes one bullet per paragraph when blank lines separate them", () => {
    // The shape of a block copied out of Word or a PDF: each paragraph is one
    // point, and the newlines inside it are where the source happened to wrap.
    const pasted = [
      "Factory Tour: A visit to the on-site parts production line,",
      "specifically including the 4-inch and surface pumps series.",
      "",
      "EBARA Italy vs. EBAS Comparison: We would like to evaluate",
      "the EBARA pump samples you have already purchased.",
      "",
      "Packaging/Manual: Please show us the packaging.",
    ].join("\n");

    const bullets = bulletsFromPaste(pasted);
    expect(bullets).toHaveLength(3);
    expect(bullets[0]).toContain("Factory Tour:");
    expect(bullets[0]).toContain("4-inch and surface pumps");
    expect(bullets[1]).toContain("EBARA Italy vs. EBAS Comparison:");
    expect(bullets[2]).toBe("Packaging/Manual: Please show us the packaging.");
  });

  it("still gives one bullet per line when there is no blank line", () => {
    expect(bulletsFromPaste("Lead time four weeks\nTwo shifts\nISO 9001 seen")).toHaveLength(3);
  });

  it("keeps the wrapping inside a paragraph rather than flattening it", () => {
    const bullets = bulletsFromPaste("First line\nsecond line\n\nAnother point");
    expect(bullets[0]).toBe("First line\nsecond line");
    expect(bullets[1]).toBe("Another point");
  });

  it("treats a run of blank lines as one boundary", () => {
    expect(bulletsFromPaste("One\n\n\n\nTwo")).toEqual(["One", "Two"]);
  });
});
