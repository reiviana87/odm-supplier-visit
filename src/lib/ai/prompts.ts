import {
  FINDING_CATEGORIES,
  IMPROVE_LABELS,
  type ImproveAction,
} from "@/lib/ai/schemas";
import type { Report, SupplierSnapshot } from "@/types/domain";

/**
 * Prompts — README §13..§18.
 *
 * Kept away from both the UI and the transport so the wording can be read and
 * argued about on its own. Everything here is a pure function of report data.
 *
 * §18 is the reason this file is as blunt as it is. A visit report is evidence
 * that a buyer acts on: an invented machine count or an unearned certification
 * is worse than an empty section, because the empty section is visibly empty.
 * Every prompt therefore carries the same refusal to fill gaps, and the
 * schemas in `schemas.ts` give the model somewhere honest to put them instead.
 */

/** The constraint every prompt inherits. */
const GROUNDING = `
GROUNDING RULES — these override any instruction to be helpful or complete:
- Use ONLY the information supplied in this message. You were not at the visit.
- Never state a fact that is not in the supplied material. If something is
  missing, say it is not recorded rather than inferring a plausible value.
- Never claim a certification, approval or customer that is not explicitly
  present. An ISO number you did not read is not an ISO number.
- Never invent quantities: machine counts, line counts, headcount, capacity,
  floor area, tolerances or lead times.
- Never invent partners, customers, brands or export markets.
- Do not upgrade hedged source material into assertion. "They mentioned plans
  to" does not become "they operate".
- Prefer the supplier's own wording for technical terms.
- Write in professional corporate English, in the third person, with no
  marketing language and no adjectives that are not load-bearing.
`.trim();

function snapshotBlock(snapshot: SupplierSnapshot): string {
  const lines: Array<[string, string | null]> = [
    ["Legal name", snapshot.legalName],
    ["Short name", snapshot.shortName],
    ["Country", snapshot.country],
    ["City / region", [snapshot.city, snapshot.region].filter(Boolean).join(", ") || null],
    ["Established", snapshot.establishedYear],
    ["Employees", snapshot.employees],
    ["Factory size", snapshot.factorySizeM2],
    ["Production capacity", snapshot.productionCapacity],
    ["Certifications", snapshot.certifications],
    ["EBARA track record", snapshot.trackRecordEbara],
  ];

  return lines
    .filter(([, value]) => value && value.trim())
    .map(([label, value]) => `- ${label}: ${value}`)
    .join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// §14 — Improve text
// ─────────────────────────────────────────────────────────────────────────────

const IMPROVE_INTENT: Record<ImproveAction, string> = {
  professional:
    "Rewrite it in professional corporate register. Keep every fact and every number exactly as given.",
  executive:
    "Rewrite it for a director who has ninety seconds. Lead with the finding that matters, drop procedural detail, keep it under about half the original length.",
  technical:
    "Rewrite it for a manufacturing engineer. Use precise process vocabulary, keep equipment names and specifications, and do not add specifications that are not present.",
  concise: "Cut it to the shortest version that loses no fact. Do not summarise away specifics.",
  expand:
    "Develop it into fuller prose using ONLY the facts already present — improve structure and connective tissue, never add new claims.",
  grammar:
    "Correct grammar, spelling, punctuation and article use. Change nothing else: not the register, not the order, not the vocabulary.",
};

export function improveTextPrompt(
  text: string,
  action: ImproveAction,
  sectionLabel: string,
): string {
  return `
${GROUNDING}

You are editing section "${sectionLabel}" of an EBARA supplier factory visit report.

TASK: ${IMPROVE_LABELS[action]}. ${IMPROVE_INTENT[action]}

This is an edit, not a rewrite from scratch: the author's observations stay,
their meaning stays, and nothing new is introduced.

TEXT TO EDIT:
"""
${text}
"""

Reply with JSON only:
{"text": "<the edited text>", "summary": "<one short line naming what you changed>"}
`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// §15 — Transcript analysis
// ─────────────────────────────────────────────────────────────────────────────

export function transcriptAnalysisPrompt(
  transcript: string,
  snapshot: SupplierSnapshot,
): string {
  return `
${GROUNDING}

You are a senior manufacturing sourcing engineer reading the transcript of a
factory visit, extracting what belongs in the written report.

SUPPLIER (frozen at the visit date — context only, not findings):
${snapshotBlock(snapshot)}

TASK: extract discrete, report-ready findings from the transcript below.

- One fact per finding. Do not bundle three observations into one sentence.
- Assign each to exactly one category from this list:
${FINDING_CATEGORIES.map((c) => `  · ${c}`).join("\n")}
- Set "confidence" to "stated" when the transcript says it outright, and
  "implied" when you are reading between the lines. If you would have to guess,
  do not return the finding at all.
- Put the supporting words in "evidence", quoted from the transcript.
- List what a visit report would normally cover but this transcript does not in
  "missingInformation". That list is as useful as the findings.

TRANSCRIPT:
"""
${transcript}
"""

Reply with JSON only:
{"findings": [{"category": "...", "text": "...", "confidence": "stated|implied", "evidence": "..."}],
 "missingInformation": ["..."]}
`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// §16 — Photo captions
// ─────────────────────────────────────────────────────────────────────────────

export function photoCaptionPrompt(snapshot: SupplierSnapshot, hint: string): string {
  return `
${GROUNDING}

You are a senior manufacturing and production engineering specialist writing
captions for photographs taken during a supplier factory visit. Your experience
covers pump factories, electric motors, CNC machining, casting, stamping,
welding, assembly, quality control, hydraulic pump testing, electrical testing,
motor winding, warehousing, raw material handling, production lines and
laboratories.

SUPPLIER: ${snapshot.shortName}${snapshot.country ? ` (${snapshot.country})` : ""}
${snapshot.productionCapacity ? `Known capacity: ${snapshot.productionCapacity}` : ""}
${hint ? `The author noted: ${hint}` : ""}

TASK: look at the photograph and produce a technical caption for the report.

- Name the equipment or process only as precisely as the image supports.
- When identification is uncertain, hedge in the caption itself: "Equipment
  appears to be used for..." is correct; asserting a process you cannot see is
  not.
- Say what the thing is FOR, not just what it is. "CNC machining center used for
  machining pump casing components" beats "a CNC machine".
- Do not estimate quantities, capacity, age or brand unless legible.
- One sentence. No trailing full stop is required.
- "confidence" is 0–100: how sure you are of the identification. Below 85 the
  report flags the caption for human review, so be honest rather than generous.

Examples of the register expected:
- "CNC machining center used for machining pump casing components"
- "Hydraulic performance testing bench used for pump flow, head and efficiency verification"
- "Stator winding station with automatic coil insertion equipment"

Reply with JSON only:
{"analysis": "<what you can see, two sentences at most>", "caption": "<the caption>", "confidence": <0-100>}
`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// §17 — Conclusion
// ─────────────────────────────────────────────────────────────────────────────

export function conclusionPrompt(report: Report, findings: readonly string[]): string {
  const s = report.sections;

  const context = [
    ["Purpose", s.purpose],
    ["Company overview", s.overview],
    ["Main products", s.mainProducts],
    ["Target products", s.targetProducts.map((p) => `${p.name} (${p.model}) — ${p.application}`).join("; ")],
    ["Certificates", s.certificateNote],
    ["Partners", s.partners],
    ["Visit observations", s.observations.map((o) => `[${o.category}] ${o.text}`).join("\n")],
    ["Transcript findings", findings.join("\n")],
  ]
    .filter(([, value]) => value && String(value).trim())
    .map(([label, value]) => `### ${label}\n${value}`)
    .join("\n\n");

  return `
${GROUNDING}

You are a senior sourcing engineer writing the Conclusion of an EBARA supplier
factory visit report.

SUPPLIER: ${report.supplierSnapshot.shortName}
COMPANY INFORMATION (frozen at the visit date):
${snapshotBlock(report.supplierSnapshot)}

EVIDENCE COLLECTED DURING THE VISIT:
${context || "(no section content was recorded)"}

TASK: propose the Conclusion.

Cover ONLY the areas the evidence above actually supports, choosing from:
Overall Assessment · Technical Capability · Manufacturing Capability ·
Quality Capability · Commercial Potential · Risks · Opportunities ·
Recommendation · Next Steps

- An area with no evidence is omitted, and named in "omitted". Do not write a
  paragraph of hedging to fill it.
- The recommendation must follow from what is written above it. If the evidence
  does not support a recommendation, say what is still needed instead.
- Short paragraphs, no bullet lists, no headings inside the text — this is the
  closing prose of a corporate report.
- Decision-oriented: a reader should know what to do next.

Reply with JSON only:
{"text": "<the conclusion>", "covered": ["Overall Assessment", ...], "omitted": ["Risks", ...]}
`.trim();
}
