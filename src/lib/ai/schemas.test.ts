import { describe, expect, it } from "vitest";

import {
  conclusionSchema,
  extractJsonObject,
  findingSchema,
  parseAiJson,
  photoCaptionSchema,
  transcriptAnalysisSchema,
} from "@/lib/ai/schemas";

/**
 * A model's JSON is input, not truth (README §18). These tests are the boundary
 * where that becomes enforceable: everything the assistant returns has to
 * survive this before it reaches a screen or the database.
 */

describe("extractJsonObject", () => {
  it("finds a bare object", () => {
    expect(extractJsonObject('{"a":1}')).toBe('{"a":1}');
  });

  it("finds an object inside a fenced block with prose around it", () => {
    const raw = 'Here you go:\n```json\n{"a": 1, "b": {"c": 2}}\n```\nHope that helps.';
    expect(extractJsonObject(raw)).toBe('{"a": 1, "b": {"c": 2}}');
  });

  it("is not fooled by braces inside strings", () => {
    const raw = '{"text": "a } brace and a { brace", "n": 1}';
    expect(extractJsonObject(raw)).toBe(raw);
  });

  it("handles escaped quotes inside strings", () => {
    const raw = '{"text": "he said \\"hello\\" }", "n": 1}';
    expect(extractJsonObject(raw)).toBe(raw);
  });

  it("returns null when there is no object", () => {
    expect(extractJsonObject("I cannot help with that.")).toBeNull();
    expect(extractJsonObject("{unbalanced")).toBeNull();
  });
});

describe("parseAiJson", () => {
  it("accepts a well-formed caption", () => {
    const result = parseAiJson(
      '{"analysis":"A CNC machining centre.","caption":"CNC machining center used for pump casings","confidence":91}',
      photoCaptionSchema,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.confidence).toBe(91);
  });

  it("rejects a confidence outside 0-100 instead of clamping it", () => {
    const result = parseAiJson(
      '{"analysis":"A machining centre.","caption":"CNC machining center","confidence":140}',
      photoCaptionSchema,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("confidence");
  });

  it("rejects an invented finding category", () => {
    const result = parseAiJson(
      '{"findings":[{"category":"Vibes","text":"good factory","confidence":"stated"}],"missingInformation":[]}',
      transcriptAnalysisSchema,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a confidence value the report cannot display", () => {
    const result = findingSchema.safeParse({
      category: "Manufacturing",
      text: "Four CNC lathes observed.",
      confidence: "definitely",
    });
    expect(result.success).toBe(false);
  });

  it("defaults the optional fields rather than failing", () => {
    const result = parseAiJson(
      '{"findings":[{"category":"Risks","text":"Single source for castings.","confidence":"implied"}]}',
      transcriptAnalysisSchema,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.missingInformation).toEqual([]);
      expect(result.data.findings[0].evidence).toBe("");
    }
  });

  it("reports the reason when the reply is not JSON at all", () => {
    const result = parseAiJson("I'm sorry, I can't do that.", conclusionSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("no JSON object");
  });

  it("reports the reason when JSON is malformed", () => {
    const result = parseAiJson('{"text": "abc",}', conclusionSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("not valid JSON");
  });

  it("keeps the covered/omitted split on a conclusion", () => {
    const result = parseAiJson(
      '{"text":"' + "x".repeat(40) + '","covered":["Overall Assessment"],"omitted":["Risks"]}',
      conclusionSchema,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.covered).toEqual(["Overall Assessment"]);
      expect(result.data.omitted).toEqual(["Risks"]);
    }
  });

  it("refuses a conclusion too short to be one", () => {
    expect(parseAiJson('{"text":"Good."}', conclusionSchema).ok).toBe(false);
  });
});
