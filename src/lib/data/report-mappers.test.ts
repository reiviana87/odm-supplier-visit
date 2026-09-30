/**
 * Report persistence mapping.
 *
 * The report is the document EBARA keeps, so the mapping either survives a
 * round trip through the database or the record silently changes meaning: an
 * observation escalated to Critical, a target product reordered, a visit dated
 * to the wrong month, a Q&A bullet grown by a trailing newline. Those are the
 * failures asserted here.
 *
 * Everything in `report-mappers.ts` is pure and takes its clock as a parameter,
 * so nothing below needs a Supabase project, a fake one, or the process clock.
 */

import { describe, expect, it } from "vitest";

import {
  joinQaBullets,
  observationToUpsert,
  periodFromVisitDate,
  relativeLabel,
  reportMetaToUpdate,
  rowToObservation,
  rowToReport,
  rowToSectionRecord,
  rowsToSectionRecords,
  rowToTargetProduct,
  sectionBodyOf,
  snapshotFromJson,
  splitQaBullets,
  targetProductToUpsert,
  toClockTime,
  toTimeValue,
  type ReportJoinedRow,
  type ReportMemberRow,
  type ReportObservationRow,
  type ReportSectionRow,
  type ReportTargetProductRow,
} from "@/lib/data/report-mappers";
import { buildSnapshot } from "@/lib/data/supplier-mappers";
import { HUATONG_REPORT, SUPPLIERS } from "@/lib/mock-data";
import type { Json } from "@/types/database";
import { SECTION_IDS, type Observation, type TargetProduct } from "@/types/domain";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures — row shapes, as PostgREST returns them
// ─────────────────────────────────────────────────────────────────────────────

function observationRow(patch: Partial<ReportObservationRow> = {}): ReportObservationRow {
  return {
    id: "obs-1",
    report_id: "rep-1",
    category: "Quality",
    priority: "High",
    text: "  Copper conductor lot traceability stops at the drawing line.  ",
    source_finding_id: "finding-7",
    image_id: null,
    sort_order: 0,
    created_at: "2026-08-12T09:00:00Z",
    updated_at: "2026-08-12T09:00:00Z",
    created_by: "user-1",
    ...patch,
  };
}

function targetProductRow(patch: Partial<ReportTargetProductRow> = {}): ReportTargetProductRow {
  return {
    id: "tp-1",
    report_id: "rep-1",
    name: "RHW-2 submersible pump cable",
    model: "100-80-160",
    application: "Submersible pump lead",
    expected_market: "North America (UL)",
    technical_requirements: "UL 44, 600 V, 90 °C wet",
    comments: "Sample requested for October.",
    photo_id: "img-3",
    sort_order: 2,
    created_at: "2026-08-12T09:00:00Z",
    updated_at: "2026-08-12T09:00:00Z",
    created_by: "user-1",
    ...patch,
  };
}

function sectionRow(patch: Partial<ReportSectionRow> & { section_id: string }): ReportSectionRow {
  return {
    id: `sec-${patch.section_id}`,
    report_id: "rep-1",
    body: "",
    excluded: false,
    sort_order: 0,
    version: 1,
    created_at: "2026-08-12T09:00:00Z",
    updated_at: "2026-08-12T09:00:00Z",
    created_by: "user-1",
    updated_by: "user-1",
    ...patch,
  };
}

function memberRow(displayName: string, sortOrder: number): ReportMemberRow {
  return {
    id: `mem-${sortOrder}`,
    report_id: "rep-1",
    profile_id: null,
    display_name: displayName,
    sort_order: sortOrder,
    created_at: "2026-08-12T09:00:00Z",
    updated_at: "2026-08-12T09:00:00Z",
    created_by: "user-1",
  };
}

function reportRow(patch: Partial<ReportJoinedRow> = {}): ReportJoinedRow {
  return {
    id: "rep-1",
    document_number: "GSO-2608001x00",
    supplier_id: "huatong",
    status: "draft",
    visit_date: "2026-08-12",
    period: "August 2026",
    employee_id: "user-1",
    owner_id: null,
    location: "Tangshan, Hebei",
    start_time: "09:30:00",
    end_time: "16:00:00",
    project: null,
    business_unit: null,
    product_category: null,
    company_information: null,
    snapshot_taken_at: "2026-08-12T01:00:00.000Z",
    archived_at: null,
    created_at: "2026-08-12T01:00:00Z",
    updated_at: "2026-08-12T18:00:00Z",
    created_by: "user-1",
    updated_by: "user-1",
    suppliers: { short_name: "HEBEI HUATONG" },
    employee: { full_name: "Reinaldo Alves" },
    owner: null,
    ...patch,
  };
}

/** The thirteen rows `create_report_with_snapshot` seeds a new report with. */
const EMPTY_SECTION_ROWS: ReportSectionRow[] = SECTION_IDS.map((id, index) =>
  sectionRow({ section_id: id, sort_order: index }),
);

// ─────────────────────────────────────────────────────────────────────────────
// §1 — the derived period and the two times
// ─────────────────────────────────────────────────────────────────────────────

describe("periodFromVisitDate", () => {
  it("names the month of the visit date, and never the day before it", () => {
    // The whole reason this is parsed by hand: `new Date("2026-01-01")` is UTC
    // midnight, which is 31 December — and December 2025 — west of Greenwich.
    expect(periodFromVisitDate("2026-08-12")).toBe("August 2026");
    expect(periodFromVisitDate("2026-01-01")).toBe("January 2026");
    expect(periodFromVisitDate("2026-12-31")).toBe("December 2026");
  });

  it("answers blank for anything that is not a calendar date", () => {
    // A blank period is a field nobody filled in — the column's own default.
    for (const value of ["", "   ", "12/08/2026", "August 2026", "2026-13-01", "2026-00-05"]) {
      expect(periodFromVisitDate(value)).toBe("");
    }
  });
});

describe("the §1 clock times", () => {
  it("reads a time column back into what the editor's inputs show", () => {
    expect(toClockTime("09:30:00")).toBe("09:30");
    expect(toClockTime("9:30")).toBe("09:30");
    expect(toClockTime(null)).toBeNull();
    expect(toClockTime("not a time")).toBeNull();
  });

  it("normalises a typed time so that comparing the strings compares the clock", () => {
    // README §9's "end must be after start" is a string comparison over these
    // values. Un-normalised, "9:05" would sort after "10:00" and a visit from
    // 09:05 to 10:00 would be refused.
    const start = toTimeValue("9:05");
    const end = toTimeValue("10:00");

    expect(start).toBe("09:05:00");
    expect(end).toBe("10:00:00");
    expect(end! > start!).toBe(true);
  });

  it("stores a half-typed or missing time as null rather than as a guess", () => {
    for (const value of ["", "  ", "9", "09:", "afternoon", null, undefined]) {
      expect(toTimeValue(value)).toBeNull();
    }
  });
});

describe("reportMetaToUpdate", () => {
  it("keeps 'leave it alone' and 'clear it' apart", () => {
    // Two different edits: an absent key must not collapse into a null.
    const untouched = reportMetaToUpdate({ location: "Tangshan, Hebei" }, "user-1");

    expect(untouched).not.toHaveProperty("project");
    expect(untouched.location).toBe("Tangshan, Hebei");

    const cleared = reportMetaToUpdate({ project: null }, "user-1");

    expect(cleared.project).toBeNull();
    expect(cleared).not.toHaveProperty("location");
  });

  it("never touches the supplier snapshot", () => {
    const update = reportMetaToUpdate(
      { documentNumber: " GSO-2608001x01 ", visitDate: "2026-08-13", endTime: "16:30" },
      "user-1",
    );

    expect(update.document_number).toBe("GSO-2608001x01");
    expect(update.end_time).toBe("16:30:00");
    expect(update.updated_by).toBe("user-1");
    expect(update).not.toHaveProperty("company_information");
    expect(update).not.toHaveProperty("supplier_id");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §8.3 — reading the frozen snapshot back
// ─────────────────────────────────────────────────────────────────────────────

describe("snapshotFromJson", () => {
  it("round-trips a snapshot written by buildSnapshot", () => {
    const supplier = SUPPLIERS.find((candidate) => candidate.id === "shimge");
    if (!supplier) throw new Error("Supplier seed shimge is missing.");

    const written = buildSnapshot(supplier, "2026-07-21T09:00:00.000Z");
    // Through `jsonb` and back, which is what the column does to it.
    const read = snapshotFromJson(JSON.parse(JSON.stringify(written)));

    expect(read).toEqual(written);
  });

  it("reads a snapshot it cannot understand as 'not recorded' instead of crashing", () => {
    // A stored snapshot outlives the code that wrote it.
    const unreadable: (Json | undefined)[] = [null, undefined, "a string", 42, ["an", "array"]];

    for (const json of unreadable) {
      const snapshot = snapshotFromJson(json);

      expect(snapshot.supplierId).toBe("");
      expect(snapshot.country).toBe("");
      expect(snapshot.tel).toBeNull();
    }
  });

  it("prints a field an older build stored as a number, and blanks an empty one", () => {
    const snapshot = snapshotFromJson({
      supplierId: "huatong",
      establishedYear: 1993,
      employees: "  ",
      city: "Tangshan",
    });

    expect(snapshot.establishedYear).toBe("1993");
    expect(snapshot.employees).toBeNull();
    expect(snapshot.city).toBe("Tangshan");
    expect(snapshot.legalName).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §6 — the Q&A block, stored as one section body
// ─────────────────────────────────────────────────────────────────────────────

describe("the Q&A bullets", () => {
  it("survives a round trip through the section body", () => {
    const bullets = HUATONG_REPORT.sections.qaBullets;

    expect(bullets.length).toBeGreaterThan(0);
    expect(splitQaBullets(joinQaBullets(bullets))).toEqual(bullets);
  });

  it("does not let blank lines or a trailing newline grow the list", () => {
    expect(splitQaBullets("First\n\n  \nSecond\n")).toEqual(["First", "Second"]);
    expect(splitQaBullets("")).toEqual([]);
    expect(joinQaBullets(["  First  ", "", "Second"])).toBe("First\nSecond");
  });

  it("stores the export toggle as what is left out, and reads it as what is kept", () => {
    // README §25 — the column says `excluded`, the rendering shape says
    // `qaIncluded`. Inverting one of them without the other silently drops the
    // §6 block from the export.
    const included = sectionBodyOf({ ...HUATONG_REPORT.sections, qaIncluded: true }, "visit");
    const excluded = sectionBodyOf({ ...HUATONG_REPORT.sections, qaIncluded: false }, "visit");

    expect(included?.excluded).toBe(false);
    expect(excluded?.excluded).toBe(true);
    expect(excluded?.body).toBe(joinQaBullets(HUATONG_REPORT.sections.qaBullets));
  });

  it("has no body of its own for the sections whose content is rows and photographs", () => {
    for (const id of ["general", "product-images", "partner-images", "appendix"] as const) {
      expect(sectionBodyOf(HUATONG_REPORT.sections, id)).toBeNull();
    }
    expect(sectionBodyOf(HUATONG_REPORT.sections, "purpose")).toEqual({
      body: HUATONG_REPORT.sections.purpose,
      excluded: false,
    });
  });
});

describe("rowsToSectionRecords", () => {
  it("answers in navigator order however the rows arrived", () => {
    const shuffled = [...EMPTY_SECTION_ROWS].reverse();

    expect(rowsToSectionRecords(shuffled).map((record) => record.sectionId)).toEqual([
      ...SECTION_IDS,
    ]);
  });

  it("skips a section this build does not know rather than rendering it unnamed", () => {
    const rows = [sectionRow({ section_id: "purpose" }), sectionRow({ section_id: "sustainability" })];

    expect(rowsToSectionRecords(rows).map((record) => record.sectionId)).toEqual(["purpose"]);
    expect(rowToSectionRecord(sectionRow({ section_id: "sustainability" }))).toBeNull();
  });

  it("carries the version the editor has to patch against", () => {
    const records = rowsToSectionRecords([
      sectionRow({ section_id: "overview", body: "Written.", version: 7, excluded: true }),
    ]);

    expect(records[0]).toEqual({
      sectionId: "overview",
      body: "Written.",
      excluded: true,
      version: 7,
      updatedAt: "2026-08-12T09:00:00Z",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §5 target products and §6 observations — the child rows
// ─────────────────────────────────────────────────────────────────────────────

describe("target product persistence", () => {
  it("maps the Phase 2 field set in both directions", () => {
    const product = rowToTargetProduct(targetProductRow());

    expect(product).toEqual({
      id: "tp-1",
      name: "RHW-2 submersible pump cable",
      model: "100-80-160",
      application: "Submersible pump lead",
      expectedMarket: "North America (UL)",
      technicalRequirements: "UL 44, 600 V, 90 °C wet",
      comments: "Sample requested for October.",
      photoId: "img-3",
      sortOrder: 2,
    });

    const row = targetProductToUpsert("rep-1", product, product.sortOrder, "user-1");

    expect(row).toEqual({
      id: "tp-1",
      report_id: "rep-1",
      name: "RHW-2 submersible pump cable",
      model: "100-80-160",
      application: "Submersible pump lead",
      expected_market: "North America (UL)",
      technical_requirements: "UL 44, 600 V, 90 °C wet",
      comments: "Sample requested for October.",
      photo_id: "img-3",
      sort_order: 2,
      created_by: "user-1",
    });
  });

  it("keeps the card's own order when the caller does not renumber", () => {
    const product = rowToTargetProduct(targetProductRow({ sort_order: 5 }));

    expect(targetProductToUpsert("rep-1", product).sort_order).toBe(5);
    // …and takes the list position when it does, which is how a drag reorders.
    expect(targetProductToUpsert("rep-1", product, 0).sort_order).toBe(0);
  });

  it("trims the typed fields but leaves the photo link alone", () => {
    const product: TargetProduct = {
      ...rowToTargetProduct(targetProductRow()),
      name: "  Booster set  ",
      comments: "   ",
      photoId: null,
    };
    const row = targetProductToUpsert("rep-1", product);

    expect(row.name).toBe("Booster set");
    // Not `null`: `comments` is a plain string column, and the em dash is drawn
    // from an empty value in the UI.
    expect(row.comments).toBe("");
    expect(row.photo_id).toBeNull();
    expect(row.created_by).toBeNull();
  });
});

describe("observation persistence", () => {
  it("maps the row and trims the text", () => {
    expect(rowToObservation(observationRow())).toEqual({
      id: "obs-1",
      category: "Quality",
      priority: "High",
      text: "  Copper conductor lot traceability stops at the drawing line.  ",
      sourceFindingId: "finding-7",
      imageId: null,
    });

    const row = observationToUpsert("rep-1", rowToObservation(observationRow()), 3, "user-1");

    expect(row.text).toBe("Copper conductor lot traceability stops at the drawing line.");
    expect(row.category).toBe("Quality");
    expect(row.source_finding_id).toBe("finding-7");
  });

  it("carries the photograph taken with the observation, both ways", () => {
    // 0008. The column was added after the mapper existed, and a field the
    // mapper forgets is the quietest kind of data loss there is: the write
    // succeeds, the row is correct, and the photograph is simply not on it.
    const withPhoto = rowToObservation(
      observationRow({ image_id: "11111111-2222-3333-4444-555555555555" }),
    );
    expect(withPhoto.imageId).toBe("11111111-2222-3333-4444-555555555555");
    expect(observationToUpsert("rep-1", withPhoto, 0).image_id).toBe(
      "11111111-2222-3333-4444-555555555555",
    );

    // An observation with no photograph writes null, not undefined: the upsert
    // sends every key for every row, and a missing one would leave whatever the
    // column already held.
    const without = rowToObservation(observationRow());
    expect(without.imageId).toBeNull();
    expect(observationToUpsert("rep-1", without, 0).image_id).toBeNull();
  });

  it("reads a priority it does not recognise as Normal, and never as an escalation", () => {
    // The column is CHECK-constrained rather than an enum, so it arrives as a
    // plain string. Widening the constraint must not silently promote an old
    // report's observations.
    expect(rowToObservation(observationRow({ priority: "Blocker" })).priority).toBe("Normal");
    expect(rowToObservation(observationRow({ priority: "" })).priority).toBe("Normal");
    expect(rowToObservation(observationRow({ priority: "critical" })).priority).toBe("Normal");
    expect(rowToObservation(observationRow({ priority: "Critical" })).priority).toBe("Critical");
  });

  it("writes the list position as sort_order, which is the only order there is", () => {
    // `Observation` carries no order of its own — `reports.ts` sorts the rows
    // by `sort_order` on the way in, so the write has to put the array index
    // back or the §6 list reshuffles on the next read.
    const rows: Observation[] = [
      { id: "a", category: "Quality", priority: "High", text: "A", sourceFindingId: null, imageId: null },
      { id: "b", category: "Delivery", priority: "Normal", text: "B", sourceFindingId: null, imageId: null },
      { id: "c", category: "Safety", priority: "Critical", text: "C", sourceFindingId: null, imageId: null },
    ];

    const upserts = rows.map((row, index) => observationToUpsert("rep-1", row, index));

    expect(upserts.map((row) => [row.id, row.sort_order])).toEqual([
      ["a", 0],
      ["b", 1],
      ["c", 2],
    ]);
    // Every object in a PostgREST upsert array has to carry the same keys.
    expect(new Set(upserts.flatMap((row) => Object.keys(row))).size).toBe(
      Object.keys(upserts[0]).length,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The assembled report
// ─────────────────────────────────────────────────────────────────────────────

describe("rowToReport", () => {
  const now = new Date(2026, 7, 12, 20, 0);

  it("computes completion from the children it was handed", () => {
    // Phase 2 §20 — a `Report` can never carry a percentage that disagrees with
    // the sections beside it in the same object. `completion.test.ts` checks the
    // algorithm; this checks that the mapper actually feeds it the rows.
    const empty = rowToReport(reportRow(), { sections: EMPTY_SECTION_ROWS }, now);

    // The three predicates that are true on creation, of thirteen.
    expect(empty.completion).toBe(23);

    const withTarget = rowToReport(
      reportRow(),
      { sections: EMPTY_SECTION_ROWS, targetProducts: [targetProductRow()] },
      now,
    );

    expect(withTarget.completion).toBe(31);
    expect(withTarget.sections.targetProducts).toHaveLength(1);
  });

  it("reads an archived report as archived without losing the status it was in", () => {
    // Phase 2 §33 — `archived_at` and `status` are separate columns so a
    // restore can put the report back exactly where it was.
    const row = reportRow({ status: "in_review", archived_at: "2026-09-01T10:00:00Z" });
    const report = rowToReport(row, { sections: EMPTY_SECTION_ROWS }, now);

    expect(report.status).toBe("archived");
    expect(row.status).toBe("in_review");
  });

  it("takes the snapshot timestamp from the column when the jsonb has none", () => {
    const report = rowToReport(
      reportRow({ company_information: { legalName: "Hebei Huatong Wires & Cables Group Co., Ltd." } }),
      { sections: EMPTY_SECTION_ROWS },
      now,
    );

    expect(report.supplierSnapshot.takenAt).toBe("2026-08-12T01:00:00.000Z");
    expect(report.supplierSnapshot.legalName).toBe("Hebei Huatong Wires & Cables Group Co., Ltd.");
  });

  it("drops a blank attendee chip and keeps the order they were entered in", () => {
    const report = rowToReport(
      reportRow(),
      {
        sections: EMPTY_SECTION_ROWS,
        members: [
          memberRow("Reinaldo Alves", 0),
          memberRow("   ", 1),
          memberRow("Lola Lu", 2),
        ],
      },
      now,
    );

    expect(report.members).toEqual(["Reinaldo Alves", "Lola Lu"]);
  });
});

describe("relativeLabel", () => {
  // The thresholds are read off the approved seed: 17:05 on the 10th is
  // "Yesterday" and 08:40 on the same 10th is "Sep 10", both read on the 11th
  // at about 13:40. Calendar day alone cannot produce both, and elapsed hours
  // alone cannot either.
  const now = new Date(2026, 8, 11, 13, 40);
  const at = (...parts: [number, number, number, number, number]): string =>
    new Date(parts[0], parts[1], parts[2], parts[3], parts[4]).toISOString();

  it("counts minutes and hours inside the same calendar day", () => {
    // Under the minute is "Just now"; a full minute is already "1m ago".
    expect(relativeLabel(new Date(2026, 8, 11, 13, 39, 30).toISOString(), now)).toBe("Just now");
    expect(relativeLabel(at(2026, 8, 11, 13, 39), now)).toBe("1m ago");
    expect(relativeLabel(at(2026, 8, 11, 13, 25), now)).toBe("15m ago");
    expect(relativeLabel(at(2026, 8, 11, 11, 40), now)).toBe("2h ago");
    expect(relativeLabel(at(2026, 8, 11, 0, 5), now)).toBe("13h ago");
  });

  it("says Yesterday only for the previous day inside 24 hours", () => {
    expect(relativeLabel(at(2026, 8, 10, 17, 5), now)).toBe("Yesterday");
    expect(relativeLabel(at(2026, 8, 10, 8, 40), now)).toBe("Sep 10");
  });

  it("reads a row written in the future as the newest thing there is", () => {
    // Clock skew between two machines is not a fact about the report.
    expect(relativeLabel(at(2026, 8, 12, 9, 0), now)).toBe("Just now");
  });

  it("answers blank for a timestamp it cannot read", () => {
    expect(relativeLabel("", now)).toBe("");
    expect(relativeLabel("not a timestamp", now)).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// README §8.3 — the frozen snapshot
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The guarantee the whole report format rests on: a report states what was true
 * on the visit date. Editing the supplier master afterwards corrects the
 * database, and must leave every report already written about it alone.
 *
 * `rowToReport` is where that is decided, so it is where it can be proved
 * without a database: the snapshot has to come from the row's stored
 * `company_information`, never from the joined supplier.
 */
describe("the supplier snapshot does not follow the live record", () => {
  const now = new Date(2026, 7, 12, 20, 0);
  const frozen = {
    supplierId: "huatong",
    takenAt: "2026-08-12T01:00:00.000Z",
    shortName: "HEBEI HUATONG",
    legalName: "Hebei Huatong Wires & Cables Group Co., Ltd.",
    establishedYear: "1999",
    companyCapital: "CNY 1,200,000,000",
    employees: "6,000",
    factorySizeM2: "200,000 m²",
    certifications: "ISO9001, ISO14001",
    productionCapacity: null,
    presidentName: "Xu Longbo",
    websiteUrl: "https://www.hebei-huatong.com",
    country: "China",
    region: "Hebei",
    city: "Tangshan",
    address: "Luanzhou Economic Development Zone",
    tel: "+86 315 7112 888",
    trackRecordEbara: null,
  };

  const row = reportRow({
    company_information: frozen,
    // What the master record says *today* — a different head count, a new
    // address, a renamed company. None of it may reach the report.
    suppliers: { short_name: "HUATONG GROUP" },
  });

  const report = rowToReport(row, { sections: EMPTY_SECTION_ROWS }, now);

  it("reads every company field from the stored snapshot", () => {
    expect(report.supplierSnapshot).toEqual(frozen);
  });

  it("keeps the name the supplier had at the visit", () => {
    expect(report.supplierSnapshot.shortName).toBe("HEBEI HUATONG");
    expect(report.supplierSnapshot.shortName).not.toBe(row.suppliers?.short_name);
  });

  it("survives a snapshot written by an older build", () => {
    const partial = rowToReport(
      reportRow({ company_information: { supplierId: "huatong", shortName: "HEBEI HUATONG" } }),
      { sections: EMPTY_SECTION_ROWS },
      now,
    );

    // Missing keys read as null rather than throwing: a stored document
    // outlives the code that wrote it.
    expect(partial.supplierSnapshot.shortName).toBe("HEBEI HUATONG");
    expect(partial.supplierSnapshot.employees).toBeNull();
    expect(partial.supplierSnapshot.city).toBeNull();
  });
});
