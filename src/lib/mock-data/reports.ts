/**
 * Report seed data — Phase 1.
 *
 * Every string here is copied from the approved prototype
 * (`design-handoff/ODM Supplier Visit.dc.html`) and the approved captures
 * `screenshots/01-dashboard.png`, `02-reports-list.png`, `04-report-editor.png`
 * and `05-editor-visit-relevant-information.png`. Do not paraphrase it.
 *
 * Only GSO-2608001x00 (HEBEI HUATONG) is a fully-written report. The other five
 * rows are list-level seed data: they exist so the reports table, the dashboard
 * and the routes have something honest to render, and their section bodies are
 * deliberately blank.
 */

import type { TagTone } from "@/components/ui/badge";
import type {
  Observation,
  ProductRow,
  Report,
  ReportSections,
  ReportSummary,
  Supplier,
  SupplierSnapshot,
  TargetProduct,
} from "@/types/domain";

import { SUPPLIERS } from "./suppliers";

// ─────────────────────────────────────────────────────────────────────────────
// Reports list — prototype `REPORTS` (row = document №, supplier, visit date,
// employee, status, completion, last-edit label, location).
//
// `lastUpdatedAt` is written WITHOUT a timezone suffix on purpose: these are
// seed values, and a local-time string renders as the wall-clock time the
// approved captures show (11:42 in the editor header) no matter where the app
// is opened. Rows coming from Supabase carry real UTC timestamps and are
// rendered in the viewer's own zone, which is the correct behaviour there.
// ─────────────────────────────────────────────────────────────────────────────

export const REPORTS: readonly ReportSummary[] = [
  {
    id: "gso-2608001x00",
    documentNumber: "GSO-2608001x00",
    supplierId: "huatong",
    supplierShortName: "HEBEI HUATONG",
    visitDate: "Aug 12, 2026",
    location: "Tangshan, Hebei",
    employee: "Reinaldo Alves",
    status: "draft",
    completion: 68,
    lastUpdatedLabel: "2h ago",
    lastUpdatedAt: "2026-09-11T11:42:00",
  },
  {
    id: "gso-2608002x00",
    documentNumber: "GSO-2608002x00",
    supplierId: "tesk",
    supplierShortName: "TESK",
    visitDate: "Oct 08, 2026",
    location: "Deqing, Zhejiang",
    employee: "Reinaldo Alves",
    status: "draft",
    completion: 41,
    lastUpdatedLabel: "Yesterday",
    lastUpdatedAt: "2026-09-10T17:05:00",
  },
  {
    id: "gso-2607003x00",
    documentNumber: "GSO-2607003x00",
    supplierId: "shimge",
    supplierShortName: "SHIMGE",
    visitDate: "Jul 21, 2026",
    location: "Wenling, Zhejiang",
    employee: "Reinaldo Alves",
    status: "in_review",
    completion: 92,
    lastUpdatedLabel: "Sep 10",
    lastUpdatedAt: "2026-09-10T08:40:00",
  },
  {
    id: "gso-2607004x00",
    documentNumber: "GSO-2607004x00",
    supplierId: "dafu",
    supplierShortName: "DAFU",
    visitDate: "Jul 23, 2026",
    location: "Shangrao, Jiangxi",
    employee: "Corrado Braconi",
    status: "final",
    completion: 100,
    lastUpdatedLabel: "Jul 30",
    lastUpdatedAt: "2026-07-30T14:10:00",
  },
  {
    id: "gso-2606002x00",
    documentNumber: "GSO-2606002x00",
    supplierId: "lingxiao",
    supplierShortName: "Lingxiao",
    visitDate: "Jun 18, 2026",
    location: "Yangchun, Guangdong",
    employee: "Xu Jianping",
    status: "final",
    completion: 100,
    lastUpdatedLabel: "Jun 29",
    lastUpdatedAt: "2026-06-29T10:25:00",
  },
  {
    id: "gso-2605001x00",
    documentNumber: "GSO-2605001x00",
    supplierId: "hande",
    supplierShortName: "HANDURO",
    visitDate: "May 14, 2026",
    location: "Wenling, Zhejiang",
    employee: "Corrado Braconi",
    status: "archived",
    completion: 100,
    lastUpdatedLabel: "May 28",
    lastUpdatedAt: "2026-05-28T15:40:00",
  },
];

/** Screenshot 02 — the line under the "Reports" title. */
export const REPORTS_PAGE_SUBTITLE = "18 visit reports · 5 open · 11 exported to DOCX";

/**
 * Period label, ISO visit date and creation timestamp per report.
 *
 * `createdAt` follows the same local-time convention as `lastUpdatedAt` above,
 * and tells the only story the rest of the seed supports: a report is opened on
 * the visit day, in the evening, and edited afterwards. GSO-2608002x00 is the
 * exception — TESK's visit is still ahead (Oct 08), so its report was opened in
 * advance of it.
 */
const REPORT_DETAIL: Record<
  string,
  { period: string; visitDateIso: string; createdAt: string }
> = {
  "gso-2608001x00": {
    period: "August 2026",
    visitDateIso: "2026-08-12",
    createdAt: "2026-08-12T18:05:00",
  },
  "gso-2608002x00": {
    period: "October 2026",
    visitDateIso: "2026-10-08",
    createdAt: "2026-09-09T09:15:00",
  },
  "gso-2607003x00": {
    period: "July 2026",
    visitDateIso: "2026-07-21",
    createdAt: "2026-07-21T19:30:00",
  },
  "gso-2607004x00": {
    period: "July 2026",
    visitDateIso: "2026-07-23",
    createdAt: "2026-07-23T17:50:00",
  },
  "gso-2606002x00": {
    period: "June 2026",
    visitDateIso: "2026-06-18",
    createdAt: "2026-06-18T18:20:00",
  },
  "gso-2605001x00": {
    period: "May 2026",
    visitDateIso: "2026-05-14",
    createdAt: "2026-05-14T17:15:00",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Supplier snapshots — README §8.3. A report reads the frozen copy, never the
// live supplier row.
// ─────────────────────────────────────────────────────────────────────────────

function snapshotFrom(supplier: Supplier, takenAt: string): SupplierSnapshot {
  return {
    supplierId: supplier.id,
    takenAt,
    shortName: supplier.shortName,
    legalName: supplier.legalName,
    establishedYear: supplier.establishedYear,
    companyCapital: supplier.companyCapital,
    employees: supplier.employees,
    factorySizeM2: supplier.factorySizeM2,
    certifications: supplier.certifications,
    productionCapacity: supplier.productionCapacity,
    presidentName: supplier.presidentName,
    websiteUrl: supplier.websiteUrl,
    country: supplier.country,
    region: supplier.region,
    city: supplier.city,
    address: supplier.address,
    tel: supplier.tel,
    trackRecordEbara: supplier.trackRecordEbara,
  };
}

function snapshotFor(supplierId: string, takenAt: string): SupplierSnapshot {
  const supplier = SUPPLIERS.find((s) => s.id === supplierId);
  if (!supplier) {
    throw new Error(`Report seed references an unknown supplier id: ${supplierId}`);
  }
  return snapshotFrom(supplier, takenAt);
}

// ─────────────────────────────────────────────────────────────────────────────
// GSO-2608001x00 — HEBEI HUATONG. The one fully-written report.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * §6 observations — category tag + priority tag + sentence.
 *
 * Only the four transcript findings the author has already accepted appear
 * here. README §12 and the §6 banner both say "9 AI findings from the
 * transcript are waiting for review · 4 already added", and the approved
 * capture (screenshots/05-editor-visit-relevant-information.png) shows exactly
 * four observation cards. The other nine live in `findings.ts` with status
 * 'open' until a human accepts them — README §11: "AI output is a proposal
 * until a human accepts it."
 *
 * This is also what makes the derived completion come out at the approved 69%:
 * §6 needs >= 8 observations (README §6.2), so with four it is still open.
 */
const HUATONG_OBSERVATIONS: Observation[] = [
  {
    id: "obs-01",
    category: "Quality",
    priority: "Normal",
    text: "Five separate inspection stages are applied along the cable manufacturing process, from raw material to finished product.",
    sourceFindingId: "f0",
    imageId: null,
  },
  {
    id: "obs-02",
    category: "Production Capacity",
    priority: "Normal",
    text: "The rubber cable workshop reported 14,237,954 km of output and RMB 1.2 billion of value in 2025.",
    sourceFindingId: "f1",
    imageId: null,
  },
  {
    id: "obs-03",
    category: "Lead Time",
    priority: "Normal",
    text: "Target production lead time is approximately 6 weeks.",
    sourceFindingId: "f2",
    imageId: null,
  },
  {
    id: "obs-04",
    category: "Supply Chain",
    priority: "Normal",
    text: "EBARA orders would be manufactured at the South Korea plant; the Panama plant is dedicated to oil and gas customers (Baker Hughes, Shell).",
    sourceFindingId: "f3",
    imageId: null,
  },
];

/** Prototype `QA_BULLETS` — the optional §6 Q&A block. */
const HUATONG_QA_BULLETS: string[] = [
  "Preventive maintenance is split into technical and routine; daily activities, including lubrication, are performed and recorded.",
  "Raw materials carry batch and origin identification; inspection and documentation maintain full traceability.",
  "Finished-product records are linked to raw-material batches; the Production Department demonstrated the complete trace-back route.",
  "Top three quality issues of the last 12 months — pending; the factory will provide the information in English.",
  "Outer-diameter stability for the 7+1 core design is monitored continuously along the full cable length; OD control limits and inspection methods to be confirmed.",
  "Reported supply history with Furukawa, WW and RIKEN; references for active projects to be confirmed.",
];

/** Prototype `PRODUCT_ROWS` — the optional §4 construction table. */
const HUATONG_PRODUCT_ROWS: ProductRow[] = [
  {
    id: "pr-1",
    type: "H07RN8-F",
    standard: "EN 50525-2-21",
    voltage: "450/750 V",
    description: "Water-resistant European flexible cable",
  },
  {
    id: "pr-2",
    type: "H07RN-F",
    standard: "EN 50525-2-21",
    voltage: "450/750 V",
    description: "European rubber flexible cable",
  },
  {
    id: "pr-3",
    type: "H05BN4-F",
    standard: "EN 50525-2-21",
    voltage: "300/500 V",
    description: "European flexible cable",
  },
  {
    id: "pr-4",
    type: "SOOW",
    standard: "UL 62",
    voltage: "600 V",
    description: "North American portable power cable",
  },
  {
    id: "pr-5",
    type: "RHW-2",
    standard: "UL 44",
    voltage: "600 / 2,000 V",
    description: "North American thermoset-insulated wire",
  },
  {
    id: "pr-6",
    type: "Type W",
    standard: "UL 1650",
    voltage: "2,000 V",
    description: "Heavy-duty portable power cable",
  },
  {
    id: "pr-7",
    type: "2PNCT",
    standard: "JIS C 3306",
    voltage: "600 V",
    description: "Japanese pump / portable cable",
  },
];

/**
 * Prototype `targets` (lines 2536..2539), field for field: the §5 card carries
 * six labelled values — Target Product · Model / Product Family · Application ·
 * Expected Market · Technical Requirements · Comments — and `TargetProduct` now
 * holds each of them separately, so nothing has to be folded into one string.
 *
 * The prototype's per-card image caption has no home on `TargetProduct`; it
 * belongs to the photo, and photos are Phase 4.
 */
const HUATONG_TARGET_PRODUCTS: TargetProduct[] = [
  {
    id: "tp-1",
    name: "RHW-2 submersible pump cable",
    model: "14×4C+14×4C / 10×4C+14×4C",
    application: "Submersible pump power supply",
    expectedMarket: "North America (US, CA)",
    technicalRequirements:
      "UL 44 / CSA C22.2, 600–2000 V, 90 °C wet rating, OD per EPAC drawing",
    comments:
      "Alternative 7+1 core design under evaluation; jacket thickness deviation pending EPAC approval.",
    photoId: "f07",
    sortOrder: 0,
  },
  {
    id: "tp-2",
    name: "2PNCT portable pump cable",
    model: "3C×3.5 mm² / 4C×5.5 mm²",
    application: "Portable dewatering pumps",
    expectedMarket: "Japan",
    technicalRequirements: "JIS C 3306, 600 V, rubber sheath",
    comments: "Second-phase qualification. Sample request not yet issued.",
    photoId: null,
    sortOrder: 1,
  },
];

const HUATONG_SECTIONS: ReportSections = {
  purpose:
    "Due to the current shortage of DKE cable supply, EPAC is evaluating Hebei Huatong Cable Group as a potential alternative supplier of RHW-2 electrical cables. The visit aims to assess the factory’s production facilities, manufacturing capacity, quality control systems, testing laboratories, and compliance with applicable UL, CSA and ISO certifications.\n\nThe goal is to confirm Hebei Huatong’s capability to consistently meet EBARA’s technical and quality requirements. Subject to a satisfactory factory assessment, the qualification process will proceed with sample validation, followed by production orders upon successful approval.",
  overview:
    "Hebei Huatong is a publicly listed international cable group serving oil and gas, marine, port-crane, mining and industrial applications. The presentation describes a multi-country manufacturing footprint and overseas warehouse reserves.\n\nThe supplier presents constructions aligned with European, North American and Japanese markets, potentially supporting regional product strategies.",
  mainProducts:
    "The corporate presentation lists cables for oil and gas, marine, port cranes, mining, fixed installations, industrial and tunneling applications. The following pump-related constructions were specifically presented; all remain subject to datasheet, construction and certification validation.",
  partners:
    "Supplies cables to Lindsay (center-pivot irrigation systems), a relevant reference for pump and water-application segments. The group also reported supply to WW Cables and to data-centre customers including NVIDIA, indicating acceptance by high-requirement global accounts.",
  // §9 is deliberately unwritten — README §6.2 (completion predicate) and the
  // dashboard's "2 need conclusion" both depend on it being empty.
  conclusion: "",
  certificateNote:
    "Certificate copies were collected on site. Surveillance status was not independently verified during the visit; ISO 45001 evidence is the current OH&S standard.",
  targetNotes:
    "Datasheet TDS_RHW-2_Submersible_Pump shared with the supplier before the visit. Jacket thickness deviation requires EPAC engineering confirmation before sample order.",
  observations: HUATONG_OBSERVATIONS,
  qaBullets: HUATONG_QA_BULLETS,
  qaIncluded: true,
  targetProducts: HUATONG_TARGET_PRODUCTS,
  productRows: HUATONG_PRODUCT_ROWS,
};

const HUATONG_SUMMARY = REPORTS[0];

export const HUATONG_REPORT: Report = {
  ...HUATONG_SUMMARY,
  // The editor header reads 69% (screenshot 04 / 05) while the reports table
  // reads 68% (screenshot 02); both are approved captures of the prototype.
  completion: 69,
  period: REPORT_DETAIL["gso-2608001x00"].period,
  reportOwner: "Reinaldo Alves",
  members: ["Reinaldo Alves", "Corrado Braconi", "Xu Jianping"],
  createdAt: REPORT_DETAIL["gso-2608001x00"].createdAt,
  startTime: "09:30",
  endTime: "16:45",
  project: "RHW-2 alternative source (EPAC)",
  businessUnit: "Building Service & Industrial",
  productCategory: "Electrical cables",
  supplierSnapshot: snapshotFor("huatong", "2026-08-12"),
  sections: HUATONG_SECTIONS,
};

// ─────────────────────────────────────────────────────────────────────────────
// Report lookup
// ─────────────────────────────────────────────────────────────────────────────

/** A report body with nothing written yet — every section predicate fails. */
function emptySections(): ReportSections {
  return {
    purpose: "",
    overview: "",
    mainProducts: "",
    partners: "",
    conclusion: "",
    certificateNote: "",
    targetNotes: "",
    observations: [],
    qaBullets: [],
    qaIncluded: true,
    targetProducts: [],
    productRows: [],
  };
}

/**
 * GSO-2608001x00 returns the written report. The other five return a shell:
 * real header metadata and a real supplier snapshot, but an empty body — they
 * are list-level seed data only.
 */
export function getReport(id: string): Report | undefined {
  if (id === HUATONG_REPORT.id) {
    return HUATONG_REPORT;
  }

  const summary = REPORTS.find((report) => report.id === id);
  if (!summary) {
    return undefined;
  }

  const detail = REPORT_DETAIL[summary.id];
  return {
    ...summary,
    period: detail.period,
    reportOwner: summary.employee,
    members: [summary.employee],
    createdAt: detail.createdAt,
    startTime: null,
    endTime: null,
    project: null,
    businessUnit: null,
    productCategory: null,
    supplierSnapshot: snapshotFor(summary.supplierId, detail.visitDateIso),
    sections: emptySections(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard — screenshot 01 / README §1.2
// ─────────────────────────────────────────────────────────────────────────────

export const DASHBOARD_DATE_LINE =
  "Wednesday, 11 September 2026 · 14 suppliers tracked across 6 provinces";

/** Ink of the delta line under a KPI value. */
export type KpiTone = "accent" | "warning" | "muted";

export interface DashboardKpi {
  id: string;
  label: string;
  value: string;
  delta: string;
  tone: KpiTone;
}

export const DASHBOARD_KPIS: readonly DashboardKpi[] = [
  {
    id: "total-suppliers",
    label: "Total Suppliers",
    value: "14",
    delta: "+2 this quarter",
    tone: "accent",
  },
  {
    id: "open-reports",
    label: "Open Reports",
    value: "5",
    delta: "2 need conclusion",
    tone: "warning",
  },
  {
    id: "in-review",
    label: "In Review",
    value: "2",
    delta: "awaiting Manager",
    tone: "muted",
  },
  {
    id: "completed",
    label: "Completed",
    value: "11",
    delta: "exported to DOCX",
    tone: "muted",
  },
  {
    id: "visits-this-month",
    label: "Visits This Month",
    value: "3",
    delta: "Hebei · Zhejiang",
    tone: "muted",
  },
  {
    id: "visits-this-year",
    label: "Visits This Year",
    value: "17",
    delta: "6 provinces · 2026",
    tone: "muted",
  },
];

/** Colour of the 5px dot in front of an attention row. */
export type AttentionTone = "accent" | "warning";

export interface DashboardAttentionItem {
  id: string;
  text: string;
  tone: AttentionTone;
}

export const DASHBOARD_ATTENTION: readonly DashboardAttentionItem[] = [
  { id: "missing-conclusion", text: "3 reports missing conclusion", tone: "warning" },
  { id: "missing-captions", text: "2 reports with images without captions", tone: "warning" },
  { id: "ready-for-review", text: "1 report ready for final review", tone: "accent" },
  { id: "transcript-pending", text: "1 transcript uploaded but not analysed", tone: "accent" },
];

export interface DashboardVisit {
  id: string;
  /** Three-letter month, rendered uppercase. */
  month: string;
  day: string;
  supplier: string;
  place: string;
  tagLabel: string;
  tagTone: TagTone;
}

export const DASHBOARD_VISITS: readonly DashboardVisit[] = [
  {
    id: "visit-tesk",
    month: "Oct",
    day: "08",
    supplier: "TESK",
    place: "Deqing, Zhejiang · planned",
    tagLabel: "Planned",
    tagTone: "warning",
  },
  {
    id: "visit-huatong",
    month: "Aug",
    day: "12",
    supplier: "HEBEI HUATONG",
    place: "Tangshan, Hebei · completed",
    tagLabel: "Draft",
    tagTone: "neutral",
  },
  {
    id: "visit-dafu",
    month: "Jul",
    day: "23",
    supplier: "DAFU",
    place: "Taizhou, Zhejiang · completed",
    tagLabel: "Final",
    tagTone: "accent",
  },
];
