/**
 * Supplier persistence mapping and the seeded read path.
 *
 * Two things are protected here.
 *
 * `buildSnapshot()` is the §8.3 guarantee: a report keeps the supplier as it
 * was on the visit date, so the snapshot must carry the data-sheet fields and
 * nothing that keeps moving. A field added to it by accident — a status, a
 * report count — would make every stored report claim something about today
 * that it cannot know, and it would only be noticed years later.
 *
 * `listSuppliers()` is the list every screen opens on. `isMockMode()` is true
 * under vitest (no `NEXT_PUBLIC_USE_MOCK_DATA=false` in the environment), so
 * calling it exercises the seeded fallback in `suppliers.ts` with no network
 * and no Supabase project — the same filtering and the same order the query
 * asks the database for.
 */

import { describe, expect, it } from "vitest";

import { listSuppliers, supplierExistsByCode } from "@/lib/data/suppliers";
import {
  buildSnapshot,
  deriveShortName,
  supplierToInsert,
  supplierToUpdate,
  toCertificateDate,
  toDisplayDate,
  toNullable,
} from "@/lib/data/supplier-mappers";
import { SUPPLIERS } from "@/lib/mock-data";
import {
  emptySupplierFormValues,
  supplierToFormValues,
} from "@/lib/suppliers/supplier-schema";
import type { Supplier, SupplierSnapshot } from "@/types/domain";

function seeded(id: string): Supplier {
  const supplier = SUPPLIERS.find((candidate) => candidate.id === id);
  if (!supplier) throw new Error(`Supplier seed ${id} is missing.`);
  return supplier;
}

/** The short names a `listSuppliers()` result is carrying. */
async function shortNames(options?: Parameters<typeof listSuppliers>[0]): Promise<string[]> {
  const result = await listSuppliers(options);
  if (!result.ok) throw new Error(`listSuppliers failed: ${result.error.code}`);
  return result.data.map((supplier) => supplier.shortName);
}

// ─────────────────────────────────────────────────────────────────────────────
// §8.3 — the frozen supplier copy
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exhaustive by construction: a field added to `SupplierSnapshot` that
 * `buildSnapshot()` does not write, or a key it writes that the type does not
 * declare, fails the typecheck here before the assertion below ever runs.
 */
const SNAPSHOT_KEYS: Record<keyof SupplierSnapshot, true> = {
  supplierId: true,
  takenAt: true,
  shortName: true,
  legalName: true,
  establishedYear: true,
  companyCapital: true,
  employees: true,
  factorySizeM2: true,
  certifications: true,
  productionCapacity: true,
  presidentName: true,
  websiteUrl: true,
  country: true,
  region: true,
  city: true,
  address: true,
  tel: true,
  trackRecordEbara: true,
};

describe("buildSnapshot", () => {
  const supplier = seeded("shimge");
  const snapshot = buildSnapshot(supplier, "2026-07-21T09:00:00.000Z");

  it("writes exactly the SupplierSnapshot key set", () => {
    expect(Object.keys(snapshot).sort()).toEqual(Object.keys(SNAPSHOT_KEYS).sort());
  });

  it("copies the data-sheet fields verbatim and pins takenAt to the parameter", () => {
    expect(snapshot).toEqual({
      supplierId: "shimge",
      takenAt: "2026-07-21T09:00:00.000Z",
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
    });
  });

  it("carries nothing that keeps moving after the visit", () => {
    // The §8.3 guarantee. A report is what was true on the visit date, so a
    // qualification decision, a report count or an internal note taken later
    // must never be readable out of it.
    for (const key of [
      "status",
      "dataSheetState",
      "reportCount",
      "internalNotes",
      "lastVisitDate",
      "contacts",
      "archivedAt",
      "updatedAt",
      "id",
    ]) {
      expect(snapshot).not.toHaveProperty(key);
    }
  });

  it("freezes a copy, not a reference to the live record", () => {
    const later: Supplier = { ...supplier, city: "Somewhere else", reportCount: 99 };

    expect(buildSnapshot(later, "2026-07-21T09:00:00.000Z").city).toBe("Somewhere else");
    expect(snapshot.city).toBe(supplier.city);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The seeded read path — README §19
// ─────────────────────────────────────────────────────────────────────────────

describe("listSuppliers over the seed", () => {
  it("opens A–Z on the short name, which is not the order of the seed", () => {
    // Both halves matter: the first shows the collation, the second shows a
    // sort actually happened rather than the seed being returned as written.
    expect(SUPPLIERS[0].shortName).toBe("HEBEI HUATONG");

    return shortNames().then((names) => {
      expect(names).toEqual([
        "AMOS",
        "Bedford",
        "CNP NM",
        "DAFU",
        "Doyin",
        "HANDURO",
        "HEBEI HUATONG",
        "Lingxiao",
        "Nanfang / CNP",
        "SHIMGE",
        "TESK",
        "Wendy Pump",
        "Wenling Yuanda",
        "Zhongke Huanli",
      ]);
    });
  });

  it("does not reorder the shared seed while sorting its own answer", async () => {
    await shortNames();

    // The fixture is a module constant: an in-place sort would silently change
    // every later read in the same process.
    expect(SUPPLIERS.map((supplier) => supplier.id).slice(0, 3)).toEqual([
      "huatong",
      "tesk",
      "wendy",
    ]);
  });

  it("matches the short name, the legal name, the Chinese name and the city", async () => {
    expect(await shortNames({ query: "shimge" })).toEqual(["SHIMGE"]);
    // Only in the legal name — "Wires & Cables" is not part of "HEBEI HUATONG".
    expect(await shortNames({ query: "wires" })).toEqual(["HEBEI HUATONG"]);
    // Only in the Chinese name, which is the one the top-bar search is for.
    expect(await shortNames({ query: "新界泵业" })).toEqual(["SHIMGE"]);
    // Only in the city column.
    expect(await shortNames({ query: "tangshan" })).toEqual(["HEBEI HUATONG"]);
  });

  it("matches case-insensitively, trims the term and answers an empty query with everything", async () => {
    expect(await shortNames({ query: "HANDURO" })).toEqual(["HANDURO"]);
    expect(await shortNames({ query: "  handuro  " })).toEqual(["HANDURO"]);
    expect(await shortNames({ query: "   " })).toHaveLength(SUPPLIERS.length);
    expect(await shortNames({ query: "no such supplier" })).toEqual([]);
  });

  it("searches records whose Chinese name and supplier code are not set", async () => {
    // Thirteen of the fourteen seeded records hold `chineseName: null` and all
    // fourteen hold `supplierCode: null`. The match has to skip a null column
    // rather than call `toLowerCase()` on it, or the whole list throws.
    expect(SUPPLIERS.filter((supplier) => supplier.chineseName !== null)).toHaveLength(1);
    expect(SUPPLIERS.every((supplier) => supplier.supplierCode === null)).toBe(true);

    // Four records answer "wenling": three by city and one by both city and
    // legal name. None of them is lost to a null column beside the match.
    expect(await shortNames({ query: "wenling" })).toEqual([
      "Doyin",
      "HANDURO",
      "Wenling Yuanda",
      "Zhongke Huanli",
    ]);
  });

  it("filters on status and on the data-sheet state, and keeps the order", async () => {
    expect(await shortNames({ status: "approved" })).toEqual(["DAFU", "Lingxiao", "SHIMGE"]);
    expect(await shortNames({ status: "on_hold" })).toEqual(["HANDURO"]);

    const received = await shortNames({ dataSheetState: "received" });
    expect(received).not.toContain("HEBEI HUATONG"); // 'partial'
    expect(received).not.toContain("TESK"); // 'pending'
    expect(received).toHaveLength(12);
  });

  it("combines a filter with a query", async () => {
    expect(await shortNames({ query: "pump", country: "China", status: "approved" })).toEqual([
      "Lingxiao",
      "SHIMGE",
    ]);
    expect(await shortNames({ query: "pump", status: "on_hold" })).toEqual(["HANDURO"]);
  });
});

describe("supplierExistsByCode over the seed", () => {
  it("answers false for a blank code without consulting anything", async () => {
    const result = await supplierExistsByCode("   ");
    expect(result).toEqual({ ok: true, data: false });
  });

  it("answers false while no seeded record carries a code", async () => {
    const result = await supplierExistsByCode("EB-CN-0001");
    expect(result).toEqual({ ok: true, data: false });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scalars the stored record depends on
// ─────────────────────────────────────────────────────────────────────────────

describe("date columns", () => {
  it("prints a visit date without letting a timezone shift the day", () => {
    // The reason both helpers parse by hand: `new Date("2026-01-01")` is UTC
    // midnight, which is 31 December west of Greenwich.
    expect(toDisplayDate("2026-01-01")).toBe("Jan 01, 2026");
    expect(toDisplayDate("2026-08-12T23:30:00Z")).toBe("Aug 12, 2026");
    expect(toDisplayDate(null)).toBeNull();
    expect(toDisplayDate("not a date")).toBeNull();
  });

  it("keeps the leading zero a certificate prints", () => {
    // The approved prototype writes "02 Feb 2022"; stripping the zero would
    // print a different string in Supabase mode than in demo mode.
    expect(toCertificateDate("2022-02-02")).toBe("02 Feb 2022");
    expect(toCertificateDate("2024-03-18")).toBe("18 Mar 2024");
    expect(toCertificateDate(null)).toBe("");
    expect(toCertificateDate("2024-13-01")).toBe("");
  });
});

describe("deriveShortName", () => {
  it("drops the legal suffixes and the parenthesised qualifier", () => {
    expect(deriveShortName("Shimge Pump Industry (Zhejiang) Co., Ltd")).toBe("Shimge Pump");
    expect(deriveShortName("Amos Fluid Technology Co., Ltd")).toBe("Amos Fluid Technology");
    expect(deriveShortName("Nanfang Pumps Co., Ltd.")).toBe("Nanfang Pumps");
  });

  it("falls back to the company name when stripping would leave nothing", () => {
    expect(deriveShortName("Ltd.")).toBe("Ltd.");
    expect(deriveShortName("  Doyin  ")).toBe("Doyin");
  });
});

describe("supplierToInsert", () => {
  const values = {
    ...emptySupplierFormValues(),
    companyName: "  Zhejiang Tesk Pump Industry Co., Ltd  ",
    country: " China ",
    city: "",
    contacts: [
      { name: "", role: "", email: "", phone: "", wechat: "" },
      { name: " Jason Xu ", role: "Sales director", email: "jason@tesk.com", phone: "", wechat: "" },
    ],
  };

  it("stores an unfilled field as null rather than as an empty string", () => {
    // The UI draws its em dash from `null`; storing "" would make the blank
    // itself data, and `—` would make the dash data.
    const row = supplierToInsert(values, "user-1");

    expect(row.city).toBeNull();
    expect(row.tel).toBeNull();
    expect(row.internal_notes).toBeNull();
    expect(toNullable("  ")).toBeNull();
  });

  it("trims the two required columns and mirrors the first named sales contact", () => {
    const row = supplierToInsert(values, "user-1");

    expect(row.legal_name).toBe("Zhejiang Tesk Pump Industry Co., Ltd");
    expect(row.country).toBe("China");
    // The §8.1 sheet has these four as columns of the supplier, so they follow
    // the first card that carries a name — not the first card.
    expect(row.contact_name).toBe("Jason Xu");
    expect(row.contact_title).toBe("Sales director");
    expect(row.contact_email).toBe("jason@tesk.com");
    expect(row.created_by).toBe("user-1");
  });

  it("derives a short name when the caller has none, and defers the lifecycle enums", () => {
    const row = supplierToInsert(values, "user-1");

    expect(row.short_name).toBe("Zhejiang Tesk Pump");
    // A record typed by hand is a prospect whose sheet has not arrived: the
    // columns' own defaults say so, and the insert must not overrule them.
    expect(row).not.toHaveProperty("status");
    expect(row).not.toHaveProperty("data_sheet_state");

    expect(supplierToInsert({ ...values, shortName: "TESK" }, "user-1").short_name).toBe("TESK");
  });
});

/**
 * Round-tripping a supplier through the edit form must not lose columns.
 *
 * Both of these shipped broken: the form mapper never read the commercial
 * block, and `supplierColumns` wrote the Chinese name and the supplier code
 * unconditionally even though the approved form draws neither. Either way,
 * correcting an address silently nulled columns the user never touched.
 */
describe("edit round trip preserves every column", () => {
  const stored: Supplier = {
    ...SUPPLIERS[0],
    chineseName: "河北华通线缆集团股份有限公司",
    supplierCode: "EBR-CN-0042",
    annualRevenue: "CNY 7.53 billion (2025)",
    ownershipType: "Public (listed)",
    mainMarkets: "Europe, North America, Japan",
    mainProducts: "Submersible pump cable, control cable",
    productionCapabilities: "Copper drawing, extrusion, in-house type testing",
  };

  it("carries the commercial block back into the update", () => {
    const update = supplierToUpdate(supplierToFormValues(stored), "user-1");

    expect(update.annual_revenue).toBe(stored.annualRevenue);
    expect(update.ownership_type).toBe(stored.ownershipType);
    expect(update.main_markets).toBe(stored.mainMarkets);
    expect(update.main_products).toBe(stored.mainProducts);
    expect(update.production_capabilities).toBe(stored.productionCapabilities);
  });

  it("leaves the columns the form does not draw untouched", () => {
    const update = supplierToUpdate(supplierToFormValues(stored), "user-1");

    // Absent from the payload entirely, so PostgREST does not write them.
    expect(update).not.toHaveProperty("chinese_name");
    expect(update).not.toHaveProperty("supplier_code");
  });

  it("still clears a drawn field the user emptied", () => {
    const update = supplierToUpdate(
      { ...supplierToFormValues(stored), chineseName: "", supplierCode: "" },
      "user-1",
    );

    expect(update.chinese_name).toBeNull();
    expect(update.supplier_code).toBeNull();
  });

  it("writes both on insert, where there is nothing to lose", () => {
    const insert = supplierToInsert(supplierToFormValues(stored), "user-1");

    expect(insert.chinese_name).toBeNull();
    expect(insert.supplier_code).toBeNull();
  });
});
