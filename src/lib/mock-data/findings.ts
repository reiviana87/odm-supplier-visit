/**
 * Transcript findings for report GSO-2608001x00 — README §12.
 *
 * Transcribed from the `FINDINGS` array of the approved prototype
 * (`design-handoff/ODM Supplier Visit.dc.html`, line 2448) and its
 * `componentDidMount` mapping (`status: i < 4 ? 'added' : 'open'`, `id: 'f' + i`).
 * That split is what produces the §6 banner in screenshot 05: "9 AI findings
 * from the transcript are waiting for review · 4 already added".
 *
 * Every finding lands in §6 Visit Relevant Information.
 */

import type { TranscriptFinding } from "@/types/domain";

/** The Plaud transcript attached to the report, as shown in the Sources rail. */
export interface TranscriptMeta {
  fileName: string;
  words: number;
  /** Rendered next to the word count, e.g. "· uploaded Aug 12". */
  uploadedLabel: string;
}

export const TRANSCRIPT_META: TranscriptMeta = {
  fileName: "HUATONG_Visit_2026-08-12.txt",
  words: 14206,
  uploadedLabel: "uploaded Aug 12",
};

export const TRANSCRIPT_FINDINGS: readonly TranscriptFinding[] = [
  {
    id: "f0",
    category: "Quality",
    text: "Five separate inspection stages are applied along the cable manufacturing process, from raw material to finished product.",
    confidence: 96,
    targetSection: "visit",
    status: "added",
  },
  {
    id: "f1",
    category: "Production Capacity",
    text: "The rubber cable workshop reported 14,237,954 km of output and RMB 1.2 billion of value in 2025.",
    confidence: 91,
    targetSection: "visit",
    status: "added",
  },
  {
    id: "f2",
    category: "Lead Time",
    text: "Target production lead time is approximately 6 weeks.",
    confidence: 94,
    targetSection: "visit",
    status: "added",
  },
  {
    id: "f3",
    category: "Supply Chain",
    text: "EBARA orders would be manufactured at the South Korea plant; the Panama plant is dedicated to oil and gas customers (Baker Hughes, Shell).",
    confidence: 88,
    targetSection: "visit",
    status: "added",
  },
  {
    id: "f4",
    category: "Manufacturing",
    text: "Preventive maintenance is split into technical and routine activities; daily lubrication is performed and recorded.",
    confidence: 93,
    targetSection: "visit",
    status: "open",
  },
  {
    id: "f5",
    category: "Quality",
    text: "Raw materials are fully inspected, identified and documented to maintain traceability records.",
    confidence: 90,
    targetSection: "visit",
    status: "open",
  },
  {
    id: "f6",
    category: "Testing Facilities",
    text: "The company has obtained CNAS national laboratory accreditation.",
    confidence: 97,
    targetSection: "visit",
    status: "open",
  },
  {
    id: "f7",
    category: "Engineering",
    text: "An ERP system is in use. SAP implementation was postponed from 2025 to 2027 due to overseas factory expansion.",
    confidence: 86,
    targetSection: "visit",
    status: "open",
  },
  {
    id: "f8",
    category: "Risks",
    text: "Certification scope is currently limited to UL and CSA; no European or Japanese scheme certificates were evidenced.",
    confidence: 82,
    targetSection: "visit",
    status: "open",
  },
  {
    id: "f9",
    category: "Risks",
    text: "Jacket thickness must be adjusted from the specified values to hold the outer diameter required by EPAC.",
    confidence: 79,
    targetSection: "visit",
    status: "open",
  },
  {
    id: "f10",
    category: "Open Points",
    text: "Top three quality issues of the last 12 months not yet provided; the factory will supply the information in English.",
    confidence: 88,
    targetSection: "visit",
    status: "open",
  },
  {
    id: "f11",
    category: "Opportunities",
    text: "Supplies cables to NVIDIA data-centre projects and to Lindsay center-pivot irrigation systems.",
    confidence: 84,
    targetSection: "visit",
    status: "open",
  },
  {
    id: "f12",
    category: "Cost / Commercial Information",
    text: "2025 sales RMB 7.53 billion; 2026 forecast above RMB 10 billion (+33%).",
    confidence: 92,
    targetSection: "visit",
    status: "open",
  },
];

/** Counts behind the §6 findings banner and the Transcript Analysis modal. */
export interface TranscriptFindingCounts {
  open: number;
  added: number;
  dismissed: number;
  total: number;
}

/**
 * Derives the banner counts — the sentence itself belongs to the §6 component,
 * which reads `open` ("waiting for review") and `added` ("already added").
 */
export function transcriptFindingCounts(
  findings: readonly TranscriptFinding[] = TRANSCRIPT_FINDINGS,
): TranscriptFindingCounts {
  return {
    open: findings.filter((finding) => finding.status === "open").length,
    added: findings.filter((finding) => finding.status === "added").length,
    dismissed: findings.filter((finding) => finding.status === "dismissed").length,
    total: findings.length,
  };
}
