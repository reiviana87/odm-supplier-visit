/**
 * GSO document numbers — Phase 2 §35.
 *
 * The number is the report's identity on paper: it is printed on the DOCX, it
 * is what a colleague quotes in an email, and a duplicate is a filing mistake
 * nobody notices until an audit. The allocation tests run against the real
 * report seed, so "the next free sequence in August 2026" is asserted against
 * the numbers the app actually holds.
 */

import { describe, expect, it } from "vitest";

import { REPORTS } from "@/lib/mock-data";
import {
  DOCUMENT_NUMBER_EXAMPLE,
  documentNumberSchema,
  duplicateDocumentNumber,
  formatDocumentNumber,
  nextDocumentNumber,
  parseDocumentNumber,
} from "@/lib/reports/document-number";

const SEEDED_NUMBERS = REPORTS.map((report) => report.documentNumber);

describe("parse / format", () => {
  it("round-trips a document number through its parts", () => {
    const parts = parseDocumentNumber(DOCUMENT_NUMBER_EXAMPLE);

    expect(parts).toEqual({ year: 26, month: 8, sequence: 1, revision: 0 });
    expect(parts && formatDocumentNumber(parts)).toBe(DOCUMENT_NUMBER_EXAMPLE);
  });

  it("round-trips parts through a string", () => {
    const parts = { year: 5, month: 12, sequence: 999, revision: 7 };
    const formatted = formatDocumentNumber(parts);

    expect(formatted).toBe("GSO-0512999x07");
    expect(parseDocumentNumber(formatted)).toEqual(parts);
  });

  it("parses whatever casing it is pasted in, and formats one canonical form", () => {
    const pasted = parseDocumentNumber("  gso-2608001X00  ");

    expect(pasted).toEqual(parseDocumentNumber(DOCUMENT_NUMBER_EXAMPLE));
    expect(pasted && formatDocumentNumber(pasted)).toBe(DOCUMENT_NUMBER_EXAMPLE);
  });

  it.each([
    ["month 00", "GSO-2600001x00"],
    ["month 13", "GSO-2613001x00"],
    ["month 99", "GSO-2699001x00"],
  ])("rejects %s", (_label: string, value: string) => {
    expect(parseDocumentNumber(value)).toBeNull();
  });

  it.each([
    ["a four-digit sequence", "GSO-26080001x00"],
    ["a missing revision", "GSO-2608001"],
    ["the wrong prefix", "EBA-2608001x00"],
    ["prose", "not a document number"],
    ["an empty string", ""],
  ])("rejects %s", (_label: string, value: string) => {
    expect(parseDocumentNumber(value)).toBeNull();
  });

  it("refuses to format parts the pattern cannot express", () => {
    expect(() => formatDocumentNumber({ year: 26, month: 13, sequence: 1, revision: 0 })).toThrow(RangeError);
    expect(() => formatDocumentNumber({ year: 26, month: 8, sequence: 1000, revision: 0 })).toThrow(RangeError);
    expect(() => formatDocumentNumber({ year: 26, month: 8, sequence: -1, revision: 0 })).toThrow(RangeError);
  });
});

describe("duplication — README §1.3", () => {
  it("keeps the number and bumps the revision", () => {
    expect(duplicateDocumentNumber("GSO-2608001x00")).toBe("GSO-2608001x01");
  });

  it("carries across the tens digit", () => {
    expect(duplicateDocumentNumber("GSO-2608001x09")).toBe("GSO-2608001x10");
  });

  it("normalises the casing of what it is given", () => {
    expect(duplicateDocumentNumber("gso-2608001X00")).toBe("GSO-2608001x01");
  });

  it("throws rather than inventing a number", () => {
    expect(() => duplicateDocumentNumber("GSO-2608001x99")).toThrow(RangeError);
    expect(() => duplicateDocumentNumber("nonsense")).toThrow();
  });
});

describe("allocation — README §9", () => {
  it("takes the next free sequence inside the month", () => {
    // The seed holds GSO-2608001x00 and GSO-2608002x00 in August 2026.
    expect(nextDocumentNumber(SEEDED_NUMBERS, new Date(2026, 7, 20))).toBe("GSO-2608003x00");
    // … and GSO-2607003x00 / GSO-2607004x00 in July.
    expect(nextDocumentNumber(SEEDED_NUMBERS, new Date(2026, 6, 2))).toBe("GSO-2607005x00");
  });

  it("starts at 001 in a month that has no reports", () => {
    expect(nextDocumentNumber(SEEDED_NUMBERS, new Date(2026, 0, 5))).toBe("GSO-2601001x00");
    expect(nextDocumentNumber([], new Date(2026, 7, 12))).toBe("GSO-2608001x00");
  });

  it("counts from the highest sequence, not from how many numbers it was given", () => {
    const sparse = ["GSO-2608007x00", "GSO-2608002x00"];

    expect(nextDocumentNumber(sparse, new Date(2026, 7, 12))).toBe("GSO-2608008x00");
  });

  it("ignores other months, other revisions and anything unparseable", () => {
    const noise = ["GSO-2607009x00", "GSO-2708009x00", "draft", "GSO-2608004x03"];

    // The x03 revision of 004 still occupies sequence 004 in August 2026.
    expect(nextDocumentNumber(noise, new Date(2026, 7, 12))).toBe("GSO-2608005x00");
  });
});

describe("the field schema", () => {
  it("accepts a document number and trims it", () => {
    expect(documentNumberSchema.parse(`  ${DOCUMENT_NUMBER_EXAMPLE}  `)).toBe(DOCUMENT_NUMBER_EXAMPLE);
    // Case-insensitive like the parser: the form does not fight the clipboard.
    expect(documentNumberSchema.safeParse("gso-2608001X00").success).toBe(true);
  });

  it.each([
    ["an empty field", ""],
    ["blank space", "   "],
    ["the wrong shape", "GSO-260801x00"],
    ["a month outside 01–12", "GSO-2613001x00"],
  ])("rejects %s", (_label: string, value: string) => {
    expect(documentNumberSchema.safeParse(value).success).toBe(false);
  });

  it("explains the format in the message rather than only failing", () => {
    const result = documentNumberSchema.safeParse("GSO-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain(DOCUMENT_NUMBER_EXAMPLE);
    }
  });
});
